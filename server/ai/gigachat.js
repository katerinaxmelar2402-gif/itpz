const { randomUUID } = require('node:crypto');
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

class GigaChatError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'GigaChatError';
    this.code = code;
    this.status = status;
  }
}

// Отдельный экземпляр нужен в тестах; приложение использует общий gigachat ниже.
function createGigaChatClient({ env = process.env, fetchImpl = globalThis.fetch,
  now = Date.now } = {}) {
  let cachedToken = null;
  let pendingToken = null;

  function settings() {
    const key = (env.GIGACHAT_AUTH_KEY || '').trim();
    if (!key || key === 'PASTE_AUTHORIZATION_KEY_HERE') {
      throw new GigaChatError('Заполни GIGACHAT_AUTH_KEY в server/.env.', 'CONFIG');
    }
    if (/^Basic\s/i.test(key) || /\s/.test(key)) {
      throw new GigaChatError(
        'В GIGACHAT_AUTH_KEY вставь только Authorization Key, без Basic и переносов строк.',
        'CONFIG',
      );
    }
    const scope = env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS';
    if (!['GIGACHAT_API_PERS', 'GIGACHAT_API_B2B', 'GIGACHAT_API_CORP'].includes(scope)) {
      throw new GigaChatError('Проверь GIGACHAT_SCOPE в server/.env.', 'CONFIG');
    }
    const baseUrl = (env.GIGACHAT_BASE_URL || 'https://api.giga.chat/v1').replace(/\/+$/, '');
    // Не отправляем токен на произвольный сервер из ошибочной настройки.
    if (!['https://api.giga.chat/v1', 'https://gigachat.devices.sberbank.ru/api/v1'].includes(baseUrl)) {
      throw new GigaChatError('Неизвестный GIGACHAT_BASE_URL. Используй адрес из инструкции.', 'CONFIG');
    }
    return { key, scope, baseUrl, model: env.GIGACHAT_MODEL || 'GigaChat' };
  }

  async function request(url, options) {
    try {
      return await fetchImpl(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      const code = error.cause?.code || error.code;
      if (/CERT|ISSUER|SELF_SIGNED|VERIFY_LEAF/.test(String(code))) {
        throw new GigaChatError(
          'Node.js не доверяет сертификату GigaChat. Настрой NODE_EXTRA_CA_CERTS по инструкции.',
          'TLS',
        );
      }
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new GigaChatError('GigaChat не ответил за 90 секунд. Попробуй позже.', 'TIMEOUT');
      }
      // Не пробрасываем исходную ошибку: она может содержать детали запроса.
      throw new GigaChatError('Не удалось связаться с GigaChat. Проверь интернет и доступ к API.', 'NETWORK');
    }
  }

  function httpError(status, auth = false) {
    const messages = {
      400: 'GigaChat отклонил параметры запроса. Проверь модель, scope и формат сообщений.',
      401: 'GigaChat отклонил авторизацию. Проверь Authorization Key и соответствие scope.',
      402: 'Недостаточно доступных токенов. Проверь баланс GigaChat API.',
      403: 'Нет доступа. Проверь ключ, scope, доступ к модели и баланс в кабинете GigaChat API.',
      404: 'Адрес API или выбранная модель недоступны. Проверь настройки.',
      413: 'Запрос слишком большой. Уменьши объём текста.',
      422: 'GigaChat не принял содержимое запроса. Проверь формат и объём текста.',
      429: 'Превышен лимит запросов GigaChat. Подожди и повтори попытку.',
    };
    return new GigaChatError(
      messages[status] || `Ошибка GigaChat HTTP ${status}. Попробуй позже.`,
      auth ? 'AUTH' : 'API', status,
    );
  }

  async function json(response) {
    try {
      return await response.json();
    } catch {
      throw new GigaChatError('GigaChat вернул некорректный ответ.', 'RESPONSE');
    }
  }

  async function loadToken() {
    const { key, scope } = settings();
    const response = await request('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${key}`,
        RqUID: randomUUID(),
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ scope }).toString(),
    });
    if (!response.ok) throw httpError(response.status, true);
    const data = await json(response);
    const rawExpiry = Number(data.expires_at);
    // Встречаются представления Unix-времени в секундах и миллисекундах.
    const expiresAt = rawExpiry < 1e12 ? rawExpiry * 1000 : rawExpiry;
    if (typeof data.access_token !== 'string' || !data.access_token
      || !Number.isFinite(expiresAt) || expiresAt <= now()) {
      throw new GigaChatError('GigaChat не вернул действующий токен доступа.', 'RESPONSE');
    }
    cachedToken = { value: data.access_token, expiresAt };
    return cachedToken.value;
  }

  async function accessToken() {
    if (cachedToken && cachedToken.expiresAt > now() + 60_000) return cachedToken.value;
    // Одновременные обращения используют один запрос авторизации.
    if (!pendingToken) pendingToken = loadToken().finally(() => { pendingToken = null; });
    return pendingToken;
  }

  async function api(endpoint, options = {}) {
    const { baseUrl } = settings();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await accessToken();
      const response = await request(`${baseUrl}${endpoint}`, {
        ...options,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 && attempt === 0) {
        if (cachedToken?.value === token) cachedToken = null;
        continue;
      }
      if (!response.ok) throw httpError(response.status);
      return json(response);
    }
  }

  async function listModels() {
    const data = await api('/models');
    if (!Array.isArray(data.data)
      || data.data.some(model => typeof model?.id !== 'string')) {
      throw new GigaChatError('GigaChat не вернул список моделей.', 'RESPONSE');
    }
    return data.data.map(model => model.id);
  }

  async function chat(messages, { schema } = {}) {
    if (!Array.isArray(messages) || !messages.length || messages.some(message =>
      !['system', 'user', 'assistant'].includes(message?.role)
      || typeof message.content !== 'string' || !message.content.trim())) {
      throw new GigaChatError('Передай непустые сообщения с role и content.', 'INPUT');
    }
    const { model } = settings();
    const data = await api('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model, messages, stream: false, temperature: 0.2,
        max_tokens: 4096, function_call: 'none',
        ...(schema ? { response_format: { type: 'json_schema', schema, strict: true } } : {}),
      }),
    });
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') {
      throw new GigaChatError('Ответ ИИ обрезан по лимиту. Уменьши размер задания.', 'TRUNCATED');
    }
    if (!choice) throw new GigaChatError('GigaChat вернул пустой список ответов. Попробуй позже.', 'EMPTY_CHOICES');
    if (['blacklist', 'content_filter'].includes(choice.finish_reason)) {
      throw new GigaChatError('GigaChat остановил ответ фильтром содержимого. Попробуй другой фрагмент конспекта.', 'CONTENT_FILTER');
    }
    if (choice.finish_reason !== 'stop') {
      const reason = ['function_call', 'tool_calls', 'error'].includes(choice.finish_reason)
        ? choice.finish_reason : (choice.finish_reason == null ? 'отсутствует' : 'неизвестный');
      throw new GigaChatError(`GigaChat завершил ответ с неподдерживаемым статусом: ${reason}.`, 'FINISH_REASON');
    }
    if (typeof choice.message?.content !== 'string' || !choice.message.content.trim()) {
      throw new GigaChatError('GigaChat завершил запрос, но вернул пустой текст. Попробуй позже.', 'EMPTY_CONTENT');
    }
    return choice.message.content;
  }

  return { listModels, chat };
}

const gigachat = createGigaChatClient();
module.exports = { gigachat, createGigaChatClient, GigaChatError };
