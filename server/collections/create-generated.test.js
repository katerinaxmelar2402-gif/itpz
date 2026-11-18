const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const calls = [];
const db = {
  async beginTransaction() { calls.push('begin'); },
  async commit() { calls.push('commit'); },
  async rollback() { calls.push('rollback'); },
  release() {},
  async execute(sql, params) { calls.push({ sql, params }); return [{ insertId: 123 }]; },
};
const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true,
  exports: { getConnection: async () => db } };
const routes = require('./create');

test('сгенерированная коллекция сохраняется личной вместе со всеми ответами', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { res.locals.userId = 7; next(); });
  app.use(routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Конспект', creationMethod: 'notes',
        questions: Array.from({ length: 5 }, (_, i) => ({ text: `Вопрос ${i}`,
          answers: ['Да', 'Нет'], correctIndex: 0 })) }),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).collection.id, '123');
    const writes = calls.filter(c => typeof c === 'object');
    assert.deepEqual(writes[0].params, [7, 'Конспект', 'notes', 'private', null]);
    assert.equal(writes.filter(c => c.sql.includes('INSERT INTO questions')).length, 5);
    assert.equal(writes.filter(c => c.sql.includes('INSERT INTO answer_options')).length, 10);
    assert.equal(calls.at(-1), 'commit');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
