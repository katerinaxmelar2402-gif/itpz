const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(name, dependencies = {}) {
  const file = path.join(__dirname, name);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: id => {
      if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  }, { filename: file });
  return module.exports;
}

const engine = load('battleState.js');
const startTime = Date.parse('2026-11-16T10:00:00Z');
const settings = { lives: 3, answerSeconds: 5 };
const collection = {
  id: '9', title: 'Тест', gameSessionId: '12',
  startedAt: new Date(startTime).toISOString(),
  questions: [0, 1, 2, 3, 4, 5].map(index => ({
    id: String(index + 1), sessionQuestionId: String(index + 20),
    text: `Вопрос ${index}`, answers: ['Да', 'Нет'], correctIndex: 0,
  })),
};
const create = () => engine.createBattle('7', collection, settings, startTime);

test('correct answer damages fox at impact; next question gets a full timer', () => {
  const initial = create();
  const answered = engine.answerBattle(initial, collection, 0, 0, startTime + 1000);
  assert.equal(answered.foxHp, 3);
  assert.equal(answered.record.foxHp, 2);
  assert.equal(answered.record.answers[0].sessionQuestionId, '20');
  const hit = engine.advanceBattle(answered, collection, startTime + 1200);
  assert.equal(hit.foxHp, 2);
  const next = engine.advanceBattle(hit, collection, startTime + 1900);
  assert.equal(next.phase, 'asking');
  assert.equal(next.index, 1);
  assert.equal(next.deadline, startTime + 6900);
  assert.equal(next.shownAt, new Date(startTime + 1900).toISOString());
  assert.equal(initial.record.answers.length, 0);
});

test('wrong answer and timeout damage player; late tap becomes timeout', () => {
  const wrong = engine.answerBattle(create(), collection, 1, 0, startTime + 700);
  assert.equal(wrong.record.playerHp, 2);
  assert.equal(wrong.outcome, 'wrong');
  const timeout = engine.answerBattle(create(), collection, 0, 0, startTime + 5000);
  assert.equal(timeout.outcome, 'timeout');
  assert.equal(timeout.selectedIndex, null);
  assert.equal(timeout.record.answers[0].responseMs, 5000);
  assert.equal(timeout.record.playerHp, 2);
});

test('double taps, invalid answers and events from previous question are ignored', () => {
  const initial = create();
  assert.equal(engine.answerBattle(initial, collection, 8, 0, startTime + 10), initial);
  const answered = engine.answerBattle(initial, collection, 0, 0, startTime + 100);
  assert.equal(engine.answerBattle(answered, collection, 1, 0, startTime + 110), answered);
  const next = engine.advanceBattle(answered, collection, startTime + 1000);
  assert.equal(engine.answerBattle(next, collection, 1, 0, startTime + 1100), next);
});

test('pause excludes paused time from response duration and preserves shownAt', () => {
  const initial = create();
  const paused = engine.pauseBattle(initial, collection, startTime + 1000);
  assert.equal(paused.remainingMs, 4000);
  const resumed = engine.resumeBattle(paused, startTime + 61000);
  const answered = engine.answerBattle(resumed, collection, 0, 0, startTime + 62000);
  assert.equal(answered.record.answers[0].responseMs, 2000);
  assert.equal(answered.record.answers[0].shownAt, initial.shownAt);
  assert.equal(answered.record.answers[0].deadlineAt,
    new Date(startTime + 65000).toISOString());
});

test('question created in background remains paused until explicitly resumed', () => {
  const answered = engine.answerBattle(create(), collection, 0, 0, startTime + 100);
  const paused = engine.advanceBattle(answered, collection, startTime + 1000, false);
  assert.equal(paused.phase, 'paused');
  assert.equal(paused.shownAt, null);
  const resumed = engine.resumeBattle(paused, startTime + 60000);
  assert.equal(resumed.shownAt, new Date(startTime + 60000).toISOString());
  assert.equal(resumed.deadline, startTime + 65000);
});

test('zero lives finishes battle without showing another question', () => {
  let state = create();
  for (let index = 0; index < 3; index += 1) {
    const now = startTime + index * 2000 + 100;
    state = engine.answerBattle(state, collection, 1, index, now);
    state = engine.advanceBattle(state, collection, now + 900);
  }
  assert.equal(state.phase, 'finished');
  assert.equal(state.record.result, 'loss');
  assert.equal(state.record.playerHp, 0);
  assert.equal(state.record.answers.length, 3);
  assert.equal(engine.abandonBattle(state, startTime + 9000), state);
});

test('exhausting questions starts another round with mistakes first and records occurrence', () => {
  const short = { ...collection, questions: collection.questions.slice(0, 2) };
  let state = engine.createBattle('7', short, { ...settings, lives: 2 }, startTime);
  state = engine.answerBattle(state, short, 0, 0, startTime + 100);
  state = engine.advanceBattle(state, short, startTime + 1000);
  state = engine.answerBattle(state, short, 1, 1, startTime + 1100);
  state = engine.advanceBattle(state, short, startTime + 2000);
  assert.equal(state.record.status, 'active');
  assert.equal(state.phase, 'asking');
  assert.equal(state.round, 2);
  assert.equal(state.questionIndex, 1);
  state = engine.answerBattle(state, short, 0, 2, startTime + 2100);
  assert.equal(state.record.answers[2].occurrenceNo, 2);
  assert.equal(state.record.answers[2].sessionQuestionId, short.questions[1].sessionQuestionId);
  state = engine.advanceBattle(state, short, startTime + 3000);
  assert.equal(state.record.status, 'completed');
  assert.equal(state.record.result, 'win');
});

test('new rounds prioritize only unresolved mistakes and shuffle remaining questions without duplicates', () => {
  const queue = engine.nextQuestionQueue(collection, [
    { questionIndex: 0, outcome: 'wrong' },
    { questionIndex: 0, outcome: 'correct' },
    { questionIndex: 2, outcome: 'timeout' },
    { questionIndex: 4, outcome: 'wrong' },
  ], () => 0);
  assert.deepEqual([...queue].slice(0, 2), [2, 4]);
  assert.equal(new Set(queue).size, collection.questions.length);
  assert.deepEqual([...queue].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
});

function historyHarness() {
  const values = new Map();
  const storage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async getAllKeys() { return [...values.keys()]; },
  };
  return {
    values,
    history: load('history.js', { '@react-native-async-storage/async-storage': storage }),
  };
}

test('failed upload leaves durable pending record; retry marks it synchronized', async () => {
  const { values, history } = historyHarness();
  const record = create().record;
  await assert.rejects(history.saveBattle(record, async () => { throw new Error('offline'); }));
  assert.equal(JSON.parse([...values.values()][0]).pending, true);
  const paths = [];
  await history.syncPendingBattles('7', async url => { paths.push(url); });
  assert.equal(paths[0], '/games/12');
  assert.equal(JSON.parse([...values.values()][0]).pending, false);
});

test('new answer during upload is also sent and cannot be marked synchronized early', async () => {
  const { values, history } = historyHarness();
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const counts = [];
  const request = async (url, options) => {
    counts.push(options.body.answers.length);
    if (counts.length === 1) { entered(); await blocked; }
  };
  const first = history.saveBattle(create().record, request);
  await started;
  const answered = engine.answerBattle(create(), collection, 0, 0, startTime + 100);
  const second = history.saveBattle(answered.record, request);
  release();
  await Promise.all([first, second]);
  assert.equal(counts[counts.length - 1], 1);
  const final = JSON.parse([...values.values()][0]);
  assert.equal(final.record.answers.length, 1);
  assert.equal(final.pending, false);
});

test('stale active snapshot cannot overwrite terminal record; sync is account-scoped', async () => {
  const { values, history } = historyHarness();
  const initial = create().record;
  const terminal = { ...initial, status: 'abandoned' };
  const offline = async () => { throw new Error('offline'); };
  await assert.rejects(history.saveBattle(terminal, offline));
  await assert.rejects(history.saveBattle(initial, offline));
  assert.equal(JSON.parse([...values.values()][0]).record.status, 'abandoned');
  let calls = 0;
  await history.syncPendingBattles('8', async () => { calls += 1; });
  assert.equal(calls, 0);
});
