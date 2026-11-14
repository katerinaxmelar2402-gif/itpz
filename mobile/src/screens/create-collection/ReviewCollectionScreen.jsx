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

  const canSave = !validationError && (!!draft.editingId || (
    draft.publicChoice === false
    || (draft.publicChoice === true && !!draft.accessKey)
  ));

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
      'Публичный ключ',
      'Это код доступа к коллекции, которым можно поделиться. '
      + 'Он предназначен для добавления коллекции через раздел '
      + '«Есть ключ?». Ключ начнёт действовать после сохранения. '
      + 'Без ключа коллекция останется личной.',
    );
  }

  async function generateKey() {
    if (busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setError('');
    setCopied(false);

    setDraft(current => ({
      ...current,
      publicChoice: true,
      accessKey: '',
    }));

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

      {!draft.editingId && <View style={styles.card}>
        <View style={styles.answerRow}>
          <Text style={[styles.sectionTitle, styles.flex]}>
            Создать публичный ключ?
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Что такое публичный ключ?"
            onPress={showKeyHelp}
            style={styles.iconButton}
          >
            <Text style={styles.info}>ⓘ</Text>
          </Pressable>
        </View>

        <FormButton
          label={
            draft.publicChoice === false
              ? '● Нет, оставить личной'
              : '○ Нет, оставить личной'
          }
          secondary={draft.publicChoice !== false}
          disabled={busy}
          onPress={choosePrivate}
        />

        <FormButton
          label={
            busy && draft.publicChoice === true && !draft.accessKey
              ? 'Создаём ключ…'
              : draft.accessKey
                ? 'Создать другой ключ'
                : 'Да, создать ключ'
          }
          secondary={draft.publicChoice !== true}
          disabled={busy}
          onPress={generateKey}
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
              Ключ начнёт действовать после сохранения коллекции.
            </Text>
          </>
        )}
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
