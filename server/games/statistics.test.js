const assert = require('node:assert/strict');
const { test } = require('node:test');
const { summarizeStatistics } = require('./statistics');

function row(sessionId, questionId, outcome, extra = {}) {
  return { sessionId: String(sessionId), mode: 'normal',
    startedAt: `2026-11-${String(sessionId).padStart(2, '0')}T10:00:00Z`,
    sessionSetId: sessionId, collectionId: '10', collectionTitle: 'Биология',
    sessionQuestionId: `${sessionId}${questionId}`, questionId: String(questionId),
    revision: 1, questionText: `Вопрос ${questionId}`, outcome, ...extra };
}

test('a review raises 70% to 100% without losing the seven correct answers', () => {
  const rows = Array.from({ length: 10 }, (_, index) => row(1, index + 1, index < 7 ? 'correct' : 'wrong'));
  assert.equal(summarizeStatistics(rows).accuracy, 70);
  for (const id of [8, 9, 10]) rows.push(row(2, id, 'correct', { mode: 'mistakes' }));
  const result = summarizeStatistics(rows);
  assert.equal(result.accuracy, 100);
  assert.equal(result.total, 10);
  assert.equal(result.wrong, 0);
  assert.equal(result.played, 1);
  assert.equal(result.collections[0].accuracy, 100);
});

test('latest normal attempt resets the baseline; partial review changes only selected questions', () => {
  const result = summarizeStatistics([
    row(1, 1, 'correct'), row(1, 2, 'correct'),
    row(2, 1, 'wrong'), row(2, 2, 'timeout'),
    row(3, 1, 'correct', { mode: 'mistakes' }),
  ]);
  assert.equal(result.accuracy, 50);
  assert.equal(result.played, 2);
  assert.equal(result.mistakes[0].sessionQuestionId, '22');
});

test('one review updates multiple collections, with weighted overall accuracy', () => {
  const other = { collectionId: '20', collectionTitle: 'История' };
  const result = summarizeStatistics([
    row(1, 1, 'wrong'), row(1, 2, 'correct'), row(1, 3, 'correct'),
    row(2, 4, 'timeout', other),
    row(3, 1, 'correct', { mode: 'mistakes' }),
    row(3, 4, 'correct', { ...other, mode: 'mistakes' }),
  ]);
  assert.equal(result.accuracy, 100);
  assert.equal(result.collections.length, 2);
  assert.equal(result.total, 4);
  assert.equal(result.played, 2);
});

test('last answer wins within a battle and a changed revision cannot correct the baseline', () => {
  const result = summarizeStatistics([
    row(1, 1, 'wrong'), row(1, 1, 'correct'), row(1, 2, 'wrong'),
    row(2, 2, 'correct', { mode: 'mistakes', revision: 2 }),
  ]);
  assert.equal(result.accuracy, 50);
  assert.equal(result.mistakes.length, 1);
});

test('empty statistics and history limited to the last seven completed battles', () => {
  assert.equal(summarizeStatistics([]).accuracy, 0);
  const result = summarizeStatistics(Array.from({ length: 10 }, (_, i) => row(i + 1, 1, 'correct')));
  assert.equal(result.history.length, 7);
  assert.equal(result.history[0].sessionId, '4');
});
