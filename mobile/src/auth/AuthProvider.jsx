import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ApiError, authRequest } from './api';

/**
 * @typedef {{token: string, refreshToken: string}} Tokens
 * @typedef {Tokens & {user: {id: number, name: string, email: string}}} Session
 * @typedef {{
 *   session: Session | null,
 *   loading: boolean,
 *   error: string,
 *   retry: () => void,
 *   signIn: (email: string, password: string) => Promise<void>,
 *   registerAccount: (data: {name: string, email: string, password: string, consent: boolean}) => Promise<void>,
 *   signOut: () => Promise<void>
 *   updateProfile: (data: {
 *     name: string, email: string, currentPassword: string, newPassword: string
 *   }) => Promise<void>,
 * }} AuthState
 */

const AuthContext = createContext(/** @type {AuthState | null} */ (null));
const tokenKey = 'itpz.session';

/** @param {Tokens} tokens */
async function saveTokens({ token, refreshToken }) {
  await SecureStore.setItemAsync(tokenKey, JSON.stringify({ token, refreshToken }));
}

/** @param {unknown} error */
function isUnauthorized(error) {
  return error instanceof ApiError && error.status === 401;
}

async function restoreSession() {
  const saved = await SecureStore.getItemAsync(tokenKey);
  if (!saved) return null;

  // Старые версии сохраняли только один токен в виде строки.
  if (!saved.startsWith('{')) {
    await SecureStore.deleteItemAsync(tokenKey);
    return null;
  }

  const tokens = /** @type {Tokens} */ (JSON.parse(saved));

  try {
    const { user } = await authRequest('/me', { token: tokens.token });
    return { ...tokens, user };
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
  }

  try {
    const refreshed = await authRequest('/refresh', { method: 'POST', token: tokens.refreshToken });
    await saveTokens(refreshed);
    return refreshed;
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
  }

  await SecureStore.deleteItemAsync(tokenKey);
  return null;
}

/** @param {{children: import('react').ReactNode}} props */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(/** @type {Session | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(/** @type {Promise<Session | null> | null} */ (null));
  const leaving = useRef(false);
  const editing = useRef(false);

  useEffect(() => {
    let active = true;

    async function restore() {
      if (leaving.current) return;
      pending.current ??= restoreSession().finally(() => { pending.current = null; });

      try {
        const restored = await pending.current;
        if (active && !leaving.current) {
          setSession(restored);
          setError('');
        }
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : 'Не удалось восстановить сессию.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    restore();
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const subscription = AppState.addEventListener('change', async state => {
      if (state !== 'active' || leaving.current || editing.current) return;
      pending.current ??= restoreSession().finally(() => { pending.current = null; });
      try {
        const restored = await pending.current;
        if (active && !leaving.current && !editing.current) setSession(restored);
      } catch {
        // При сетевой ошибке сохранённый токен пригодится при следующей попытке.
      }
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [session]);

  function retry() {
    setError('');
    setLoading(true);
    setAttempt(value => value + 1);
  }

  /** @param {string} path @param {object} body */
  async function startSession(path, body) {
    const next = await authRequest(path, { method: 'POST', body });
    await saveTokens(next);
    setSession(next);
  }

  /** @param {string} email @param {string} password */
  async function signIn(email, password) {
    await startSession('/login', { email, password });
  }

  /** @param {{name: string, email: string, password: string, consent: boolean}} data */
  async function registerAccount(data) {
    await startSession('/register', data);
  }

  /** @param {{name: string, email: string, currentPassword: string, newPassword: string}} data */
  async function updateProfile(data) {
    if (!session || leaving.current || editing.current) {
      throw new Error('Сейчас не удалось начать сохранение профиля.');
    }

    editing.current = true;
    try {
      const restoring = pending.current;
      let current = restoring ? await restoring : session;
      if (restoring) setSession(current);
      if (!current) throw new Error('Войдите снова.');

      const send = token => authRequest('/profile', {
        method: 'PATCH',
        body: data,
        token,
      });

      let result;
      try {
        result = await send(current.token);
      } catch (error) {
        if (!isUnauthorized(error)) throw error;
        current = await restoreSession();
        setSession(current);
        if (!current) throw new Error('Войдите снова.');
        result = await send(current.token);
      }

      setSession({ ...current, user: result.user });
    } finally {
      editing.current = false;
    }
  }

  async function signOut() {
    if (!session || leaving.current || editing.current) return;
    leaving.current = true;
    try {
      await pending.current?.catch(() => {});
      await authRequest('/logout', { method: 'POST', token: session.refreshToken });
      await SecureStore.deleteItemAsync(tokenKey);
      setSession(null);
    } finally {
      leaving.current = false;
    }
  }

  return (
    <AuthContext.Provider value={{ session, loading, error, retry, signIn, registerAccount, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth нужно вызывать внутри AuthProvider.');
  return auth;
}