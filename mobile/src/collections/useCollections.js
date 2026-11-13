//Загрузка для главной и страницы коллекций. Включает в себя проверку авторизации и загрузку списка коллекций.
//Обнавляет данные при смене токена авторизации или при вызове reload().
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '../auth/AuthProvider';

export function filterCollections(collections, search) {
  const normalize = value => value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU');

  const query = normalize(search.trim());

  return collections.filter(collection =>
    normalize(collection.title).includes(query)
  );
}

export function sortCollectionsByTitle(collections) {
  return [...collections].sort((first, second) =>
    first.title.localeCompare(second.title, 'ru', {
      sensitivity: 'base',
      numeric: true,
    })
    || first.id.localeCompare(second.id, 'en', { numeric: true })
  );
}

export function sortCollectionsByAdded(collections) {
  return [...collections].sort((first, second) =>
    (second.addedAt ?? '').localeCompare(first.addedAt ?? '')
    || second.id.localeCompare(first.id, 'en', { numeric: true })
  );
}

export function useCollections() {
  const { session, request } = useAuth();
  const userId = session?.user.id;

  const [attempt, setAttempt] = useState(0);

  const [state, setState] = useState({
    userId: null,
    collections: [],
    hasPlayed: false,
    loading: true,
    error: '',
  });

  useFocusEffect(useCallback(() => {
    let active = true;

    setState({
      userId,
      collections: [],
      hasPlayed: false,
      loading: true,
      error: '',
    });

    async function load() {
      try {
        const data = await request('/collections');

        if (
          !Array.isArray(data?.collections)
          || typeof data.hasPlayed !== 'boolean'
        ) {
          throw new Error('Сервер вернул некорректный ответ.');
        }

        if (active) {
          setState({
            userId,
            collections: data.collections,
            hasPlayed: data.hasPlayed,
            loading: false,
            error: '',
          });
        }
      } catch (error) {
        if (active) {
          setState({
            userId,
            collections: [],
            hasPlayed: false,
            loading: false,
            error: error instanceof Error
              ? error.message
              : 'Не удалось загрузить коллекции.',
          });
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [userId, request, attempt]));

  const current = state.userId === userId ? state : {
    collections: [],
    hasPlayed: false,
    loading: true,
    error: '',
  };

  return {
    ...current,
    reload: () => setAttempt(value => value + 1),
  };
}