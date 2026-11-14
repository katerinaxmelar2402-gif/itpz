const assert = require('node:assert/strict');
const { test, before, after, beforeEach } = require('node:test');
const express = require('express');

// Маршруты проверяем без изменения рабочей базы и пользовательских коллекций.
let row;
let calls;
let failWrite;
const version = '20261114010000000000';
const db = {
  async beginTransaction() { calls.push('begin'); },
  async commit() { calls.push('commit'); },
  async rollback() { calls.push('rollback'); },
  release() { calls.push('release'); },
  async execute(sql, params) {
    if (sql.includes('FROM question_sets AS collection')) return [row ? [row] : []];
    if (sql.includes('FROM questions AS question')) {
      return [Array.from({ length: 5 }, (_, index) => [
        { id: index + 1, text: `Вопрос ${index}`, answer_id: index * 2 + 1,
          answer_text: 'Да', is_correct: 1 },
        { id: index + 1, text: `Вопрос ${index}`, answer_id: index * 2 + 2,
          answer_text: 'Нет', is_correct: 0 },
      ]).flat()];
    }
    calls.push({ sql, params });
    if (failWrite) throw Object.assign(new Error('database failure'), { code: failWrite });
    return [{ insertId: 100, affectedRows: 1 }];
  },
};
const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true,
  exports: { getConnection: async () => db } };
const routes = require('./manage');
let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { res.locals.userId = '7'; next(); });
  app.use('/collections', routes);
  server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/collections/10`;
});

after(() => new Promise(resolve => server.close(resolve)));

beforeEach(() => {
  row = { id: 10, author_id: 7, title: 'Моя коллекция', system_code: null,
    version, is_connected: 0, access_key: null };
  calls = [];
  failWrite = null;
});

function payload() {
  return {
    title: 'Новое название', version,
    questions: Array.from({ length: 5 }, (_, index) => ({
      sourceId: String(index + 1), text: `Вопрос ${index}`,
      answers: ['Да', 'Нет'], correctIndex: 0,
    })),
  };
}

function update(body) {
  return fetch(baseUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) });
}

test('просмотр возвращает все вопросы, ответы и права владельца', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const { collection } = await response.json();
  assert.equal(collection.questions.length, 5);
  assert.deepEqual(collection.questions[0].answers, ['Да', 'Нет']);
  assert.equal(collection.questions[0].correctIndex, 0);
  assert.equal(collection.canEdit, true);
});

test('чужая личная коллекция недоступна даже по известному id', async () => {
  row.author_id = 8;
  assert.equal((await fetch(baseUrl)).status, 404);
  assert.equal((await update(payload())).status, 404);
  assert.equal((await fetch(baseUrl, { method: 'DELETE' })).status, 404);
  assert.equal(calls.some(call => typeof call === 'object'), false);
});

test('встроенную коллекцию можно просмотреть, но нельзя менять или удалять', async () => {
  row.system_code = 'starter';
  row.author_id = null;
  assert.equal((await fetch(baseUrl)).status, 200);
  assert.equal((await update(payload())).status, 403);
  assert.equal((await fetch(baseUrl, { method: 'DELETE' })).status, 403);
});

test('устаревшее редактирование не перезаписывает новые изменения', async () => {
  assert.equal((await update({ ...payload(), version: 'old' })).status, 409);
  assert.ok(calls.includes('rollback'));
  assert.equal(calls.some(call => typeof call === 'object'), false);
});

test('сохранение названия сохраняет неизменённые вопросы и варианты', async () => {
  assert.equal((await update(payload())).status, 200);
  assert.ok(calls.includes('commit'));
  assert.equal(calls.some(call => call.sql?.includes('DELETE FROM answer_options')), false);
  const questions = calls.filter(call => call.sql?.includes('revision = revision'));
  assert.equal(questions.length, 5);
  assert.ok(questions.every(call => call.params[2] === 0));
});

test('изменение текста повышает ревизию только изменённого вопроса', async () => {
  const body = payload();
  body.questions[0].text = 'Изменённый вопрос';
  assert.equal((await update(body)).status, 200);
  const changed = calls.filter(call => call.sql?.includes('revision = revision')
    && call.params[2] === 1);
  assert.equal(changed.length, 1);
  assert.ok(calls.includes('commit'));
});

test('нельзя подставить вопрос из другой коллекции', async () => {
  const body = payload();
  body.questions[0].sourceId = '999';
  assert.equal((await update(body)).status, 400);
  assert.equal(calls.some(call => typeof call === 'object'), false);
});

test('меньше пяти вопросов и неправильная отметка отклоняются', async () => {
  const body = payload();
  body.questions.pop();
  assert.equal((await update(body)).status, 400);
  const invalid = payload();
  invalid.questions[0].correctIndex = null;
  assert.equal((await update(invalid)).status, 400);
});

test('конфликт названий откатывает сохранение', async () => {
  failWrite = 'ER_DUP_ENTRY';
  assert.equal((await update(payload())).status, 409);
  assert.ok(calls.includes('rollback'));
  assert.ok(!calls.includes('commit'));
});

test('удаление владельцем мягкое и отключает ключ', async () => {
  assert.equal((await fetch(baseUrl, { method: 'DELETE' })).status, 204);
  assert.ok(calls.some(call => call.sql?.includes('deleted_at = NOW()')
    && call.sql.includes('access_key = NULL')));
  assert.ok(!calls.some(call => call.sql?.includes('DELETE FROM question_sets')));
  assert.ok(calls.includes('commit'));
});

test('подключённую коллекцию можно только просматривать', async () => {
  row.author_id = 8;
  row.is_connected = 1;

  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);

  const { collection } = await response.json();

  assert.equal(collection.canEdit, false);
  assert.equal(collection.canDelete, false);

  assert.equal((await update(payload())).status, 403);

  assert.equal(
    (await fetch(baseUrl, { method: 'DELETE' })).status,
    403,
  );

  assert.equal(
    calls.some(call => typeof call === 'object'),
    false,
  );
});
