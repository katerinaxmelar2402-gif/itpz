import { useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useAuth } from '../../auth/AuthProvider';
import { useAppTheme } from '../../../ui/theme';

import {
  cleanText,
  FormButton,
  FormPage,
  useCollectionDraft,
  validateDraft,
} from './CollectionFormUI';

import { makeStyles } from './CreateCollectionScreen.styles';
import QuestionList from '../../components/collections/QuestionList';

export default function ReviewCollectionScreen() {
  const { source } = useLocalSearchParams();

  const entryPoint = source === 'library'
    ? 'library'
    : 'play';
  const { draft, setDraft } = useCollectionDraft();
  const { request } = useAuth();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  const busyRef = useRef(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const validationError = validateDraft(draft);

  const canSave = !validationError && (
    draft.publicChoice === false
    || (draft.publicChoice === true && !!draft.accessKey)
  );

  const showAccessSettings = !draft.editingId || entryPoint === 'library';

  function choosePrivate() {
    if (busyRef.current) return;

    setError('');
    setCopied(false);

    setDraft(current => ({
      ...current,
      publicChoice: false,
      accessKey: '',
    }));
  }

  function showKeyHelp() {
    Alert.alert(
      'Доступ к коллекции',
      'Личная коллекция доступна только тебе. '
      + 'Публичную коллекцию можно добавить по ключу. '
      + 'Если сделать её личной, старый ключ перестанет работать, '
      + 'а коллекция исчезнет из списков подключивших её пользователей. '
      + 'Изменения вступают в силу после сохранения.',
    );
  }

  async function generateKey() {
    if (busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setError('');
    setCopied(false);

    try {
      const result = await request('/collections/key', {
        method: 'POST',
      });

      if (
        typeof result?.accessKey !== 'string'
        || !/^[a-f0-9]{48}$/.test(result.accessKey)
      ) {
        throw new Error('Сервер вернул некорректный ключ.');
      }

      setDraft(current => ({
        ...current,
        publicChoice: true,
        accessKey: result.accessKey,
      }));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось создать ключ.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function copyKey() {
    if (busyRef.current || !draft.accessKey) return;

    setError('');

    try {
      const success = await Clipboard.setStringAsync(draft.accessKey);

      if (!success) {
        throw new Error('Не удалось скопировать ключ.');
      }

      setCopied(true);
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : 'Не удалось скопировать ключ.',
      );
    }
  }

  async function saveCollection() {
    if (busyRef.current || !canSave) return;

    busyRef.current = true;
    setBusy(true);
    setError('');

    try {
      await request(draft.editingId ? `/collections/${draft.editingId}` : '/collections', {
        method: draft.editingId ? 'PUT' : 'POST',
        body: {
          version: draft.version,
          title: draft.title,
          questions: draft.questions.map(question => ({
            text: question.text,
            answers: question.answers,
            correctIndex: question.correctIndex,
            sourceId: question.sourceId,
          })),
          accessKey: draft.publicChoice ? draft.accessKey : null,
        },
      });

      if (draft.editingId) {
        router.dismissTo({ pathname: '/collection/[id]', params: { id: draft.editingId, source: entryPoint, }, });
      } else {
        router.dismissTo('/home');
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось сохранить коллекцию.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (validationError) {
    return (
      <FormPage>
        <Text style={styles.title}>Проверь коллекцию</Text>

        <Text style={styles.error}>{validationError}</Text>

        <FormButton
          label="Вернуться к редактированию"
          onPress={() => router.replace({
            pathname: '/create-collection',
            params: draft.editingId
              ? {
                  editId: draft.editingId,
                  source: entryPoint,
                }
              : {},
          })}
        />
      </FormPage>
    );
  }

  return (
    <FormPage>
      <Text accessibilityRole="header" style={styles.title}>
        {cleanText(draft.title)}
      </Text>

      <Text style={styles.hint}>
        Вопросов: {draft.questions.length}. Проверь всё перед сохранением.
      </Text>

      <QuestionList questions={draft.questions} />

      <FormButton
        label="Редактировать вопросы"
        secondary
        disabled={busy}
        onPress={() => router.back()}
      />

      {showAccessSettings && <View style={styles.card}>
        <View style={styles.answerRow}>
          <Text style={[styles.sectionTitle, styles.flex]}>
            Доступ к коллекции
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Как работает доступ к коллекции?"
            onPress={showKeyHelp}
            style={styles.iconButton}
          >
            <Text style={styles.info}>ⓘ</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          {draft.publicChoice === true
            ? 'Публичная — можно добавить по ключу.'
            : draft.publicChoice === false
              ? 'Личная — доступна только тебе.'
              : 'Выбери, кому будет доступна коллекция.'}
        </Text>

        <FormButton
          label={
            draft.publicChoice === false
              ? '● Личная'
              : '○ Сделать личной'
          }
          secondary={draft.publicChoice !== false}
          disabled={busy}
          onPress={choosePrivate}
        />

        <FormButton
          label={
            draft.publicChoice === true && draft.accessKey
              ? '● Публичная'
              : '○ Сделать публичной'
          }
          secondary={draft.publicChoice !== true}
          disabled={busy}
          onPress={() => {
            if (draft.publicChoice === true && draft.accessKey) return;
            generateKey();
          }}
        />

        {draft.publicChoice === true && !!draft.accessKey && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Скопировать публичный ключ"
              disabled={busy}
              onPress={copyKey}
              style={styles.keyBox}
            >
              <Text style={styles.keyText}>{draft.accessKey}</Text>

              <Text style={styles.hint}>
                {copied ? 'Скопировано ✓' : 'Нажми, чтобы скопировать'}
              </Text>
            </Pressable>

            <Text style={styles.hint}>
              {draft.accessKey === draft.originalAccessKey
                ? 'Это действующий ключ коллекции.'
                : 'Новый ключ начнёт действовать после сохранения.'}
            </Text>
          </>
        )}
        {!!draft.originalAccessKey && (
          draft.publicChoice === false
          || draft.accessKey !== draft.originalAccessKey
        ) && (
          <Text style={styles.error}>
            После сохранения прежний ключ перестанет работать.
            Коллекция исчезнет из списков пользователей, которые добавили её раньше.
          </Text>
        )}

        <Text style={styles.hint}>
          Изменения доступа применятся после сохранения коллекции.
        </Text>
      </View>}

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}

      <FormButton
        label={busy ? 'Подожди…' : draft.editingId ? 'Сохранить изменения' : 'Сохранить коллекцию'}
        disabled={busy || !canSave}
        onPress={saveCollection}
      />
    </FormPage>
  );
}
