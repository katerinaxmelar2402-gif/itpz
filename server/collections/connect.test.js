const assert = require('node:assert/strict');
const { test, before, after, beforeEach } = require('node:test');
const express = require('express');

const key = 'a1'.repeat(24);
let row;
let calls;
let failWrite;
const db = {
  async beginTransaction() { calls.push('begin'); },
  async commit() { calls.push('commit'); },
  async rollback() { calls.push('rollback'); },
  release() { calls.push('release'); },
  async execute(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('FROM question_sets AS collection')) {
      // Моделируем условия видимости запроса, не затрагивая рабочую базу.
      return [row && params[1] === key && row.visibility === 'public'
        && row.content_status === 'ready' && !row.deleted_at ? [row] : []];
    }
    if (failWrite) throw Object.assign(new Error('write failed'), { code: 'ER_TEST' });
    row.is_connected = 1;
    return [{ affectedRows: 1 }];
  },
};
const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true,
  exports: { execute: (...args) => db.execute(...args), getConnection: async () => db } };
const routes = require('./connect');
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
  baseUrl = `http://127.0.0.1:${server.address().port}/collections`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => {
  row = { id: 10, title: 'Набор друга', description: 'Описание', author_id: 8,
    author_name: 'Саша', system_code: null, question_count: 5, is_connected: 0,
    visibility: 'public', content_status: 'ready', deleted_at: null };
  calls = [];
  failWrite = false;
});
function post(path, accessKey = key) {
  return fetch(baseUrl + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessKey }) });
}
const writes = () => calls.filter(call => call.sql?.includes('INSERT INTO set_connections'));

test('предпросмотр нормализует ключ, показывает автора и не подключает набор', async () => {
  const response = await post('/lookup', `  ${key.toUpperCase()}\n`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).collection, {
    id: '10', title: 'Набор друга', description: 'Описание', author: 'Саша',
    questionCount: 5, alreadyAdded: false,
  });
  assert.equal(writes().length, 0);
  const query = calls.find(call => call.sql)?.sql;
  assert.match(query, /visibility = 'public'/);
  assert.match(query, /content_status = 'ready'/);
  assert.match(query, /collection.deleted_at IS NULL/);
});
test('пустые и некорректные ключи отклоняются до обращения к базе', async () => {
  for (const value of ['', 'not-a-key', null, 42, 'a'.repeat(49)]) {
    assert.equal((await post('/lookup', value)).status, 400);
    assert.equal((await post('/connect', value)).status, 400);
  }
  assert.equal(calls.length, 0);
});
test('несуществующий ключ не даёт доступ', async () => {
  assert.equal((await post('/lookup', 'b2'.repeat(24))).status, 404);
  assert.equal((await post('/connect', 'b2'.repeat(24))).status, 404);
  assert.equal(writes().length, 0);
  assert.ok(calls.includes('rollback'));
});
test('подключение сохраняет набор для текущего пользователя под блокировкой', async () => {
  assert.equal((await post('/connect')).status, 200);
  assert.deepEqual(writes()[0].params, ['7', '10']);
  assert.match(calls.find(call => call.sql?.includes('FROM question_sets')).sql, /FOR UPDATE/);
  assert.ok(calls.includes('commit'));
  assert.ok(calls.includes('release'));
  assert.equal((await post('/connect')).status, 200);
  assert.equal(writes().length, 1);
});
test('собственные и встроенные наборы не дублируются', async () => {
  row.author_id = 7;
  assert.equal((await (await post('/connect')).json()).collection.alreadyAdded, true);
  row.author_id = null;
  row.system_code = 'starter';
  assert.equal((await post('/connect')).status, 200);
  assert.equal(writes().length, 0);
});
test('удаление и закрытие доступа после предпросмотра запрещают подключение', async () => {
  assert.equal((await post('/lookup')).status, 200);
  for (const change of [{ visibility: 'private' }, { deleted_at: '2026-11-17' }, { content_status: 'pending' }]) {
    const saved = { ...row };
    Object.assign(row, change);
    assert.equal((await post('/connect')).status, 404);
    row = saved;
  }
  assert.equal(writes().length, 0);
});
test('ошибка записи откатывает транзакцию и освобождает соединение', async () => {
  failWrite = true;
  assert.equal((await post('/connect')).status, 500);
  assert.ok(calls.includes('rollback'));
  assert.ok(calls.includes('release'));
  assert.ok(!calls.includes('commit'));
});
