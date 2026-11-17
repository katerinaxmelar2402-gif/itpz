const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');

// Запуск: ITPZ_TEST_DATABASE=1 node --test games/routes.test.js
// Все SQL-записи выполняются на одном соединении внутри внешней
// транзакции. commit/rollback обработчиков перехвачены; в конце
// откатываются пользователь, коллекция, бои, ответы и прогресс.
test('game API with MySQL; all test records are rolled back', {
  skip: process.env.ITPZ_TEST_DATABASE !== '1',
}, async t => {
  const realPool = require('../db');
  const db = await realPool.getConnection();
  const dbPath = require.resolve('../db');
  const authPath = require.resolve('../auth/sessions');
  const routesPath = require.resolve('./routes');
  const originalDb = require.cache[dbPath];
  const originalAuth = require.cache[authPath];
  let server;
  let userId;
  let authenticatedId;

  try {
    await db.beginTransaction();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const [user] = await db.execute(`
      INSERT INTO users (
        email, password_hash, name, role, status,
        consent_at, policy_version, created_at
      ) VALUES (?, 'unused-test-password', 'Game API test', 'user', 'active',
        UTC_TIMESTAMP(), 'test', UTC_TIMESTAMP())
    `, [`game-test-${unique}@example.test`]);
    userId = String(user.insertId);
    authenticatedId = userId;
    const [set] = await db.execute(`
      INSERT INTO question_sets (
        author_id, title, creation_method, visibility,
        content_status, created_at, updated_at
      ) VALUES (?, ?, 'manual', 'private', 'ready', UTC_TIMESTAMP(), UTC_TIMESTAMP(6))
    `, [userId, `Game API test ${unique}`]);
    const collectionId = String(set.insertId);
    for (let index = 0; index < 2; index += 1) {
      const [question] = await db.execute(
        'INSERT INTO questions (set_id, text, position) VALUES (?, ?, ?)',
        [collectionId, `Test question ${index}`, index + 1],
      );
      await db.execute(
        'INSERT INTO answer_options (question_id, text, is_correct) VALUES (?, ?, 1), (?, ?, 0)',
        [question.insertId, 'Yes', question.insertId, 'No'],
      );
    }

    const connection = {
      execute: db.execute.bind(db),
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
    };
    require.cache[dbPath] = {
      ...originalDb,
      exports: { ...connection, async getConnection() { return connection; } },
    };
    require.cache[authPath] = {
      id: authPath, filename: authPath, loaded: true,
      exports: {
        readToken: () => 'test',
        findSessionUser: async () => ({ id: authenticatedId }),
      },
    };
    delete require.cache[routesPath];
    const app = express();
    app.use(express.json());
    app.use('/games', require('./routes'));
    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
      instance.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}/games`;
    async function api(suffix, method = 'GET', body) {
      const response = await fetch(baseUrl + suffix, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, data: await response.json() };
    }
    const startBody = {
      clientKey: `test-${unique}`, collectionId, lives: 3, answerSeconds: 5,
    };
    const created = await api('', 'POST', startBody);
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const game = created.data;
    const origin = Date.now();
    function answer(snapshot, index, selectedIndex, turn = index, occurrenceNo = 1) {
      const shown = origin + turn * 6000;
      const responseMs = selectedIndex === null ? 5000 : 100;
      return {
        sessionQuestionId: snapshot.collection.questions[index].sessionQuestionId,
        selectedIndex, responseMs, occurrenceNo,
        shownAt: new Date(shown).toISOString(),
        deadlineAt: new Date(shown + 5000).toISOString(),
        answeredAt: new Date(shown + responseMs).toISOString(),
      };
    }

    await t.test('retrying start does not duplicate a session or snapshots', async () => {
      const duplicate = await api('', 'POST', startBody);
      assert.equal(duplicate.data.sessionId, game.sessionId);
      assert.equal(duplicate.data.collection.questions.length, 2);
    });

    const first = answer(game, 0, 0);
    await t.test('correct answer and retry produce exactly one saved answer', async () => {
      for (let index = 0; index < 2; index += 1) {
        const result = await api(`/${game.sessionId}`, 'PUT', {
          status: 'active', answers: [first],
        });
        assert.equal(result.status, 200, JSON.stringify(result.data));
      }
      const detail = await api(`/${game.sessionId}`);
      assert.equal(detail.data.answers.length, 1);
      assert.equal(detail.data.foxHp, 1);
      assert.equal(detail.data.answers[0].outcome, 'correct');
    });

    await t.test('changing a saved answer is rejected', async () => {
      const result = await api(`/${game.sessionId}`, 'PUT', {
        status: 'active', answers: [{ ...first, selectedIndex: 1 }],
      });
      assert.equal(result.status, 409);
    });

    const wrong = answer(game, 1, 1);
    const corrected = answer(game, 1, 0, 2, 2);
    await t.test('question exhaustion continues battle; repeated answer finishes and saves statistics', async () => {
      const continued = await api(`/${game.sessionId}`, 'PUT', {
        version: 3, status: 'active', answers: [first, wrong],
      });
      assert.equal(continued.status, 200, JSON.stringify(continued.data));
      assert.equal(continued.data.status, 'active');
      const premature = await api(`/${game.sessionId}`, 'PUT', {
        version: 3, status: 'completed', answers: [first, wrong],
      });
      assert.equal(premature.status, 400);
      const skippedError = await api(`/${game.sessionId}`, 'PUT', {
        version: 3, status: 'active',
        answers: [first, wrong, answer(game, 0, 0, 2, 2)],
      });
      assert.equal(skippedError.status, 400);
      const result = await api(`/${game.sessionId}`, 'PUT', {
        version: 3, status: 'completed', answers: [first, wrong, corrected],
      });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      assert.equal(result.data.result, 'win');
      const detail = await api(`/${game.sessionId}`);
      assert.equal(detail.data.answers.length, 3);
      assert.equal(detail.data.answers[2].occurrenceNo, 2);
      assert.equal(detail.data.playerHp, 1);
      assert.equal(detail.data.foxHp, 0);
      const list = await api('');
      assert.equal(Number(list.data.games[0].correctCount), 2);
      assert.equal(Number(list.data.games[0].wrongCount), 1);
    });

    await t.test('stale request cannot regress a completed game', async () => {
      const result = await api(`/${game.sessionId}`, 'PUT', {
        status: 'active', answers: [first],
      });
      assert.equal(result.data.status, 'completed');
      assert.equal((await api(`/${game.sessionId}`)).data.answers.length, 3);
    });

    let repeated;
    await t.test('repeat reads settings from previous game instead of current defaults', async () => {
      const result = await api('', 'POST', {
        ...startBody, clientKey: `repeat-${unique}`,
        repeatSessionId: game.sessionId, lives: 20, answerSeconds: 120,
      });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      repeated = result.data;
      assert.equal(repeated.settings.lives, 2);
      assert.equal(repeated.settings.answerSeconds, 5);
      assert.notEqual(repeated.sessionId, game.sessionId);
    });

    await t.test('timeout damages player and correct answer resolves an old error', async () => {
      const timeout = answer(repeated, 0, null);
      const correct = answer(repeated, 1, 0);
      const result = await api(`/${repeated.sessionId}`, 'PUT', {
        version: 3, status: 'completed',
        answers: [timeout, correct, answer(repeated, 0, 0, 2, 2)],
      });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      const detail = await api(`/${repeated.sessionId}`);
      assert.equal(detail.data.answers[0].outcome, 'timeout');
      const [progress] = await db.execute(`
        SELECT has_unresolved_error, corrected_by_answer_id
        FROM question_progress WHERE user_id = ? AND question_id = ?
      `, [userId, repeated.collection.questions[1].id]);
      assert.equal(Number(progress[0].has_unresolved_error), 0);
      assert.ok(progress[0].corrected_by_answer_id);
    });

    await t.test('lives are capped and order defaults to ordered; random order is supported', async () => {
      assert.equal(game.settings.lives, 2);
      assert.equal(game.settings.questionOrder, 'ordered');
      const random = await api('', 'POST', {
        ...startBody, clientKey: `random-${unique}`, lives: 20, questionOrder: 'random',
      });
      assert.equal(random.status, 200, JSON.stringify(random.data));
      assert.equal(random.data.settings.lives, 2);
      assert.equal(random.data.settings.questionOrder, 'random');
    });

    await t.test('statistics supports partial collection reviews and one battle across all collections', async () => {
      const [otherSet] = await db.execute(`
        INSERT INTO question_sets (author_id, title, creation_method, visibility,
          content_status, created_at, updated_at)
        VALUES (?, 'Second statistics collection', 'manual', 'private', 'ready', UTC_TIMESTAMP(), UTC_TIMESTAMP(6))
      `, [userId]);
      const otherId = String(otherSet.insertId);
      const [question] = await db.execute(
        'INSERT INTO questions (set_id, text, position) VALUES (?, ?, 1)', [otherId, 'Other question']);
      await db.execute('INSERT INTO answer_options (question_id, text, is_correct) VALUES (?, ?, 1), (?, ?, 0)',
        [question.insertId, 'Yes', question.insertId, 'No']);
      const first = await api('', 'POST', { ...startBody, clientKey: `stats-first-${unique}` });
      assert.equal(first.status, 200, JSON.stringify(first.data));
      assert.equal((await api(`/${first.data.sessionId}`, 'PUT', {
        version: 3, status: 'completed', answers: [answer(first.data, 0, 1), answer(first.data, 1, 1)],
      })).status, 200);
      const second = await api('', 'POST', { ...startBody, collectionId: otherId, clientKey: `stats-second-${unique}` });
      assert.equal(second.status, 200, JSON.stringify(second.data));
      await api(`/${second.data.sessionId}`, 'PUT', {
        version: 3, status: 'completed', answers: [answer(second.data, 0, 1)],
      });
      let statistics = await api('/statistics');
      assert.equal(statistics.status, 200, JSON.stringify(statistics.data));
      assert.equal(statistics.data.total, 3);
      assert.equal(statistics.data.wrong, 3);
      const partial = await api('', 'POST', {
        collectionId, clientKey: `stats-partial-${unique}`,
        statisticsQuestionIds: [statistics.data.collections.find(item => item.id === collectionId).mistakes[0].sessionQuestionId],
        answerSeconds: 5,
      });
      assert.equal(partial.status, 200, JSON.stringify(partial.data));
      await api(`/${partial.data.sessionId}`, 'PUT', {
        version: 3, status: 'completed', answers: [answer(partial.data, 0, 0)],
      });
      statistics = await api('/statistics');
      assert.equal(statistics.data.wrong, 2);
      assert.equal(statistics.data.collections.find(item => item.id === collectionId).accuracy, 50);
      const body = { collectionId: 'all', clientKey: `stats-global-${unique}`, answerSeconds: 5,
        statisticsQuestionIds: statistics.data.mistakes.map(item => item.sessionQuestionId) };
      const global = await api('', 'POST', body);
      assert.equal(global.status, 200, JSON.stringify(global.data));
      assert.equal(global.data.collection.id, 'all');
      assert.equal(global.data.settings.lives, 2);
      assert.equal((await api('', 'POST', body)).data.sessionId, global.data.sessionId);
      assert.equal((await api(`/${global.data.sessionId}`, 'PUT', {
        version: 3, status: 'completed', answers: [answer(global.data, 0, 0), answer(global.data, 1, 0)],
      })).status, 200);
      statistics = await api('/statistics');
      assert.equal(statistics.data.accuracy, 100);
      assert.equal(statistics.data.total, 3);
      assert.equal(statistics.data.wrong, 0);
      assert.ok(statistics.data.collections.every(item => item.accuracy === 100));
      assert.equal((await api('', 'POST', { ...body, clientKey: `stats-stale-${unique}` })).status, 400);
      const repeatedGlobal = await api('', 'POST', {
        collectionId: 'all', clientKey: `stats-repeat-${unique}`, repeatSessionId: global.data.sessionId,
      });
      assert.equal(repeatedGlobal.status, 200, JSON.stringify(repeatedGlobal.data));
      assert.equal(repeatedGlobal.data.collection.questions.length, 2);
      await api(`/${repeatedGlobal.data.sessionId}`, 'PUT', {
        version: 3, status: 'completed', answers: [answer(repeatedGlobal.data, 0, 1), answer(repeatedGlobal.data, 1, 1)],
      });
      const narrowedBody = { collectionId: 'all', clientKey: `stats-narrow-${unique}`,
        reviewSessionId: repeatedGlobal.data.sessionId,
        reviewQuestionIds: [repeatedGlobal.data.collection.questions[0].sessionQuestionId] };
      const narrowed = await api('', 'POST', narrowedBody);
      assert.equal(narrowed.status, 200, JSON.stringify(narrowed.data));
      assert.equal(narrowed.data.collection.questions.length, 1);
      assert.equal((await api('', 'POST', narrowedBody)).data.sessionId, narrowed.data.sessionId);
      authenticatedId = '-1';
      try {
        const privateStatistics = await api('/statistics');
        assert.equal(privateStatistics.data.total, 0);
        assert.equal((await api('', 'POST', { ...body, clientKey: `stats-private-${unique}` })).status, 400);
      } finally { authenticatedId = userId; }
    });

    await t.test('work on mistakes uses selected snapshots, exactly one life, and persists independently', async () => {
      const selectedId = game.collection.questions[1].sessionQuestionId;
      await db.execute('UPDATE questions SET text = ?, revision = revision + 1 WHERE id = ?',
        ['Edited after battle', game.collection.questions[1].id]);
      const review = await api('', 'POST', {
        collectionId, clientKey: `mistakes-${unique}`,
        reviewSessionId: game.sessionId, reviewQuestionIds: [selectedId],
      });
      assert.equal(review.status, 200, JSON.stringify(review.data));
      assert.equal(review.data.mode, 'mistakes');
      assert.equal(review.data.settings.lives, 1);
      assert.equal(review.data.collection.questions.length, 1);
      assert.equal(review.data.collection.questions[0].text, game.collection.questions[1].text);
      const result = await api(`/${review.data.sessionId}`, 'PUT', {
        version: 3, status: 'completed', answers: [answer(review.data, 0, 0)],
      });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      assert.equal(result.data.result, 'win');
      const repeatReview = await api('', 'POST', {
        ...startBody, clientKey: `review-repeat-${unique}`, repeatSessionId: review.data.sessionId,
      });
      assert.equal(repeatReview.status, 200, JSON.stringify(repeatReview.data));
      assert.equal(repeatReview.data.collection.questions.length, 1);
      assert.equal(repeatReview.data.settings.lives, 1);
    });

    await t.test('mistake review rejects correct-only questions and empty selection', async () => {
      for (const reviewQuestionIds of [[], [game.collection.questions[0].sessionQuestionId]]) {
        const result = await api('', 'POST', {
          collectionId, clientKey: `invalid-${unique}`, reviewSessionId: game.sessionId,
          reviewQuestionIds,
        });
        assert.equal(result.status, 400);
      }
    });

    await t.test('another account cannot read or update the game', async () => {
      authenticatedId = '-1';
      try {
        assert.equal((await api(`/${game.sessionId}`)).status, 404);
        assert.equal((await api(`/${game.sessionId}`, 'PUT', {
          status: 'active', answers: [],
        })).status, 404);
      } finally {
        authenticatedId = userId;
      }
    });
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    await db.rollback();
    db.release();
    await realPool.end();
    require.cache[dbPath] = originalDb;
    if (originalAuth) require.cache[authPath] = originalAuth;
    else delete require.cache[authPath];
    delete require.cache[routesPath];
  }
});
