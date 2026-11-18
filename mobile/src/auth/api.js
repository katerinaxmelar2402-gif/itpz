//Отправляет запросы к серверу, передаёт токен при необходимости и обрабатывает сетевые ошибки.
const baseUrl = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {string} path
 * @param {{method?: string, body?: object, token?: string, timeoutMs?: number}} [options]
 */
export async function apiRequest(
  path,
  { method = 'GET', body, token, timeoutMs = 15000 } = {},
) {
  if (!baseUrl) {
    throw new Error('Укажите EXPO_PUBLIC_API_URL в mobile/.env.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const multipart = body instanceof FormData;

  try {
    const response = await fetch(
      baseUrl.replace(/\/$/, '') + '/api' + path,
      {
        method,
        signal: controller.signal,
        headers: {
          ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
      },
    );

    if (response.status === 204) return null;

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data?.message || 'Ошибка сервера.',
      );
    }

    if (!data) {
      throw new Error('Сервер вернул некорректный ответ.');
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError || controller.signal.aborted) {
      throw new Error(
        'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function authRequest(path, options = {}) {
  return apiRequest('/auth' + path, options);
}
