const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGigaChatClient } = require('./gigachat');

const time = 1_800_000_000_000;
const env = { GIGACHAT_AUTH_KEY: 'test-secret', GIGACHAT_MODEL: 'test-model' };
const token = (value = 'temporary-token', expiry = time + 1_800_000) =>
  Response.json({ access_token: value, expires_at: expiry });
const answer = () => Response.json({ choices: [
  { finish_reason: 'stop', message: { content: 'Готово' } },
] });
const messages = [{ role: 'user', content: 'Проверка' }];

test('OAuth, заголовки, сообщения и повторное использование токена', async () => {
  const calls = [];
  const client = createGigaChatClient({ env, now: () => time, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/oauth')) return token();
    return url.endsWith('/models') ? Response.json({ data: [{ id: 'test-model' }] }) : answer();
  } });
  assert.deepEqual(await client.listModels(), ['test-model']);
  assert.equal(await client.chat(messages), 'Готово');
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.headers.Authorization, 'Basic test-secret');
  assert.match(calls[0].options.headers.RqUID, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  assert.equal(calls[0].options.body, 'scope=GIGACHAT_API_PERS');
  assert.equal(calls[1].url, 'https://api.giga.chat/v1/models');
  assert.equal(calls[2].options.headers.Authorization, 'Bearer temporary-token');
  const body = JSON.parse(calls[2].options.body);
  assert.equal(body.model, 'test-model');
  assert.equal(body.function_call, 'none');
  assert.deepEqual(body.messages, messages);
});

test('параллельные вызовы получают один токен, срок в секундах поддерживается', async () => {
  let authorizations = 0;
  const client = createGigaChatClient({ env, now: () => time, fetchImpl: async url => {
    if (url.endsWith('/oauth')) { authorizations += 1; return token('shared', (time + 1_800_000) / 1000); }
    return answer();
  } });
  await Promise.all([client.chat(messages), client.chat(messages), client.chat(messages)]);
  assert.equal(authorizations, 1);
});

test('строгая JSON-схема передаётся в запрос генерации', async () => {
  const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] };
  const client = createGigaChatClient({ env, now: () => time, fetchImpl: async (url, options) => {
    if (url.endsWith('/oauth')) return token();
    assert.deepEqual(JSON.parse(options.body).response_format,
      { type: 'json_schema', schema, strict: true });
    return answer();
  } });
  await client.chat(messages, { schema });
});

test('токен обновляется заранее и один раз после 401', async () => {
  let currentTime = time;
  let authorizations = 0;
  let rejectNext = false;
  const client = createGigaChatClient({ env, now: () => currentTime, fetchImpl: async url => {
    if (url.endsWith('/oauth')) {
      authorizations += 1;
      return token(`token-${authorizations}`, currentTime + 120_000);
    }
    if (rejectNext) { rejectNext = false; return new Response('', { status: 401 }); }
    return answer();
  } });
  await client.chat(messages);
  currentTime += 70_000;
  await client.chat(messages);
  assert.equal(authorizations, 2);
  rejectNext = true;
  await client.chat(messages);
  assert.equal(authorizations, 3);
});

test('повторный 401 завершает запрос; тело ошибки и ключ не выводятся', async () => {
  let calls = 0;
  const client = createGigaChatClient({ env, now: () => time, fetchImpl: async url => {
    calls += 1;
    return url.endsWith('/oauth') ? token() : new Response('test-secret', { status: 401 });
  } });
  await assert.rejects(client.chat(messages), error =>
    error.status === 401 && !error.message.includes('test-secret'));
  assert.equal(calls, 4);
});

test('неверная конфигурация не вызывает сеть', async () => {
  for (const patch of [{ GIGACHAT_AUTH_KEY: '' }, { GIGACHAT_AUTH_KEY: 'Basic secret' },
    { GIGACHAT_SCOPE: 'unknown' }, { GIGACHAT_BASE_URL: 'https://example.com' }]) {
    const client = createGigaChatClient({ env: { ...env, ...patch }, fetchImpl: async () => {
      assert.fail('Сеть не должна вызываться');
    } });
    await assert.rejects(client.listModels(), { code: 'CONFIG' });
  }
});

test('обрезанный ответ, невалидный JSON, TLS, таймаут и лимит различаются', async () => {
  const cases = [
    [() => Response.json({ choices: [{ finish_reason: 'length' }] }), 'TRUNCATED'],
    [() => new Response('not json'), 'RESPONSE'],
    [() => { throw Object.assign(new Error('test-secret'), { cause: { code: 'SELF_SIGNED_CERT_IN_CHAIN' } }); }, 'TLS'],
    [() => { throw Object.assign(new Error(), { name: 'TimeoutError' }); }, 'TIMEOUT'],
    [() => new Response('test-secret', { status: 429 }), 'API'],
  ];
  for (const [reply, code] of cases) {
    const client = createGigaChatClient({ env, now: () => time,
      fetchImpl: async url => url.endsWith('/oauth') ? token() : reply() });
    await assert.rejects(client.chat(messages), error =>
      error.code === code && !error.message.includes('test-secret'));
  }
});

test('пустой ответ, фильтр и неподдерживаемое завершение различаются', async () => {
  const cases = [
    [{ choices: [] }, 'EMPTY_CHOICES'],
    [{ choices: [{ finish_reason: 'blacklist' }] }, 'CONTENT_FILTER'],
    [{ choices: [{ finish_reason: 'content_filter' }] }, 'CONTENT_FILTER'],
    [{ choices: [{ finish_reason: 'function_call' }] }, 'FINISH_REASON'],
    [{ choices: [{ finish_reason: 'stop', message: { content: ' ' } }] }, 'EMPTY_CONTENT'],
  ];
  for (const [data, code] of cases) {
    const client = createGigaChatClient({ env, now: () => time,
      fetchImpl: async url => url.endsWith('/oauth') ? token() : Response.json(data) });
    await assert.rejects(client.chat(messages), { code });
  }
});
