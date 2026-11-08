//Хранит состояние входа. На Android токен сохраняется в SecureStore, 
// а после перезапуска приложение проверяет его через `/me`.
import { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ApiError, authRequest } from './api';

/**
 * @typedef {{token: string, user: {name: string, email: string}}} Session
 * @typedef {{
 *   session: Session | null,
 *   loading: boolean,
 *   error: string,
 *   retry: () => void,
 *   signIn: (email: string, password: string) => Promise<void>,
 *   registerAccount: (data: {name: string, email: string, password: string, consent: boolean}) => Promise<void>,
 *   signOut: () => Promise<void>
 * }} AuthState
 */

const AuthContext = createContext(/** @type {AuthState | null} */ (null));
const tokenKey = 'itpz.session';

/** @param {{children: import('react').ReactNode}} props */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(/** @type {Session | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const token = await SecureStore.getItemAsync(tokenKey);
        if (!token) return;

        const restored = await authRequest('/me', { token }).catch(async error => {
          if (!(error instanceof ApiError) || error.status !== 401) throw error;
          await SecureStore.deleteItemAsync(tokenKey);
          return null;
        });
        if (active && restored) setSession({ token, user: restored.user });
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

  function retry() {
    setError('');
    setLoading(true);
    setAttempt(value => value + 1);
  }

    /** @param {string} path @param {object} body */
  async function startSession(path, body) {
    const nextSession = await authRequest(path, { method: 'POST', body });
    await SecureStore.setItemAsync(tokenKey, nextSession.token);
    setSession(nextSession);
  }

  /** @param {string} email @param {string} password */
  async function signIn(email, password) {
    await startSession('/login', { email, password });
  }

  /** @param {{name: string, email: string, password: string, consent: boolean}} data */
  async function registerAccount(data) {
    await startSession('/register', data);
  }

  async function signOut() {
    if (!session) return;
    await authRequest('/logout', { method: 'POST', token: session.token });
    await SecureStore.deleteItemAsync(tokenKey);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, loading, error, retry, signIn, registerAccount, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth нужно вызывать внутри AuthProvider.');
  return auth;
}