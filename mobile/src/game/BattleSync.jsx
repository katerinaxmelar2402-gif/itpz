import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { syncPendingBattles } from './history';

export default function BattleSync() {
  const { session, request } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (userId == null) return;

    function sync() {
      syncPendingBattles(userId, request).catch(() => {
        // Очередь остаётся на устройстве.
        // Следующая попытка — при возвращении в приложение
        // или через интервал.
      });
    }

    sync();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') sync();
    });

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') sync();
    }, 30000);

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [userId, request]);

  return null;
}