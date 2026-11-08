//Отправляет запросы к серверу, передаёт токен при необходимости и обрабатывает сетевые ошибки.
const baseUrl = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {string} path
 * @param {{method?: string, body?: object, token?: string}} [options]
 */
export async function authRequest(path, { method = 'GET', body = undefined, token = undefined } = {}) {
  if (!baseUrl) throw new Error('Укажите EXPO_PUBLIC_API_URL в mobile/.env.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(baseUrl + '/api/auth' + path, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(response.status, data?.message || 'Ошибка сервера.');
    }
    if (!data) throw new Error('Сервер вернул некорректный ответ.');
    return data;
  } catch (error) {
    if (error instanceof TypeError || controller.signal.aborted) {
      throw new Error('Нет связи с сервером. Проверьте запуск сервера и подключение.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}