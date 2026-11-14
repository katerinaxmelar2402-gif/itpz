import { useCallback, useState } from 'react';

import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useAuth } from '../../auth/AuthProvider';
import { useAppTheme } from '../../../ui/theme';

import {
  CollectionFeedback,
} from '../../components/collections/CollectionUI';

import QuestionList from '../../components/collections/QuestionList';

import {
  FormButton,
  FormPage,
} from '../create-collection/CollectionFormUI';

import { makeStyles } from './CollectionDetailsScreen.styles';

export default function CollectionDetailsScreen() {
  const { id, source } = useLocalSearchParams();

  const collectionId = typeof id === 'string' ? id : '';
  const entryPoint = source === 'library' ? 'library' : 'play';

  const { request } = useAuth();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyError, setCopyError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;

    setLoading(true);
    setError('');
    setCopyError('');
    setCopiedKey('');
    setCollection(null);

    async function load() {
      try {
        const data = await request(
          `/collections/${encodeURIComponent(collectionId)}`,
        );

        if (!data?.collection) {
          throw new Error('Сервер вернул некорректную коллекцию.');
        }

        if (active) {
          setCollection(data.collection);
        }
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Не удалось загрузить коллекцию.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };

    // Счётчик нужен для повторной загрузки по кнопке.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, request, attempt]));

  async function copyKey() {
    if (!collection?.accessKey) return;

    setCopyError('');

    try {
      const success = await Clipboard.setStringAsync(
        collection.accessKey,
      );

      if (!success) {
        throw new Error('Не удалось скопировать ключ.');
      }

      setCopiedKey(collection.accessKey);
    } catch (reason) {
      setCopyError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось скопировать ключ.',
      );
    }
  }

  const showKey = (
    entryPoint === 'library'
    && collection?.isPublic
    && !!collection?.accessKey
  );

  return (
    <FormPage>
      <CollectionFeedback
        loading={loading}
        error={error}
        onRetry={() => setAttempt(value => value + 1)}
      />

      {!loading && collection && (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {collection.title}
          </Text>

          <View style={styles.status}>
            <Text style={styles.statusText}>
              {collection.isBuiltIn
                ? 'Встроенная коллекция'
                : collection.isPublic
                  ? 'Публичная коллекция'
                  : 'Личная коллекция'}
            </Text>
          </View>

          <Text style={styles.hint}>
            Вопросов: {collection.questions.length}
          </Text>

          {!collection.isOwner && !collection.isBuiltIn && (
            <Text style={styles.hint}>
              Коллекция добавлена по ключу. Изменять вопросы может
              только её автор.
            </Text>
          )}

          {showKey && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Скопировать публичный ключ"
              onPress={copyKey}
              style={({ pressed }) => [
                styles.keyBox,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.keyLabel}>
                Публичный ключ
              </Text>

              <Text style={styles.keyText}>
                {collection.accessKey}
              </Text>

              <Text
                accessibilityLiveRegion="polite"
                style={styles.hint}
              >
                {copiedKey === collection.accessKey
                  ? 'Скопировано ✓'
                  : 'Нажми, чтобы скопировать'}
              </Text>
            </Pressable>
          )}

          {!!copyError && (
            <Text style={styles.error}>
              {copyError}
            </Text>
          )}

          <QuestionList questions={collection.questions} />

          {collection.canEdit && collection.isOwner && (
            <FormButton
              label="Редактировать вопросы"
              secondary
              onPress={() => router.push({
                pathname: '/create-collection',
                params: {
                  editId: collection.id,
                  source: entryPoint,
                },
              })}
            />
          )}

          <FormButton label="Играть" disabled />

          <Text style={styles.hint}>
            Запуск игры скоро появится.
          </Text>
        </>
      )}
    </FormPage>
  );
}