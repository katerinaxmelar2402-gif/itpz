import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthProvider';

export const GAME_LIMITS = {
  answerSeconds: { min: 5, max: 120 },
  lives: { min: 3, max: 20 },
};

export const DEFAULT_GAME = {
  answerSeconds: 30,
  lives: 8,
  questionOrder: 'ordered',
};

const DEFAULT_APP = { theme: 'light', sound: true, music: false };
const STORAGE_KEY = 'itpz.preferences.v1';
const EMPTY = { app: {}, games: {} };
const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { session } = useAuth();
  const [stored, setStored] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (active) setStored({ app: parsed?.app ?? {}, games: parsed?.games ?? {} });
      } catch {
        if (active) {
          setError('Не удалось загрузить настройки. Перезапустите приложение.');
          setStored(EMPTY);
        }
      }
    }

    load();
    return () => { active = false; };
  }, []);

  const data = stored ?? EMPTY;
  const userId = session?.user.id;
  const app = { ...DEFAULT_APP, ...data.app };
  const savedGame = data.games[userId];
  const game = {
    answerSeconds: savedGame?.answerSeconds ?? DEFAULT_GAME.answerSeconds,
    lives: savedGame?.lives ?? DEFAULT_GAME.lives,
    questionOrder: savedGame?.questionOrder === 'random' ? 'random' : 'ordered',
  };

  async function save(next) {
    if (!stored || error) throw new Error('Хранилище настроек недоступно.');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setStored(next);
  }

  async function saveApp(patch) {
    await save({ ...data, app: { ...app, ...patch } });
  }

  async function saveGame(patch) {
    if (userId == null) throw new Error('Войдите, чтобы изменить настройки игры.');
    await save({
      ...data,
      games: { ...data.games, [userId]: { ...game, ...patch } },
    });
  }

  return (
    <SettingsContext.Provider value={{
      app, game, saveApp, saveGame, loading: stored === null, error,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const settings = useContext(SettingsContext);
  if (!settings) throw new Error('useSettings нужно вызывать внутри SettingsProvider.');
  return settings;
}
