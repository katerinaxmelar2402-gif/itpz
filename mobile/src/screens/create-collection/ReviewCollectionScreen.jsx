import { useRef, useState } from 'react';
import { router } from 'expo-router';
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

export default function ReviewCollectionScreen() {
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
      await request('/collections', {
        method: 'POST',
        body: {
          title: draft.title,
          questions: draft.questions.map(question => ({
            text: question.text,
            answers: question.answers,
            correctIndex: question.correctIndex,
          })),
          accessKey: draft.publicChoice ? draft.accessKey : null,
        },
      });

      router.dismissTo('/home');
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
          onPress={() => router.replace('/create-collection')}
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

      {draft.questions.map((question, questionIndex) => (
        <View key={question.id} style={styles.card}>
          <Text style={styles.sectionTitle}>
            {questionIndex + 1}. {cleanText(question.text)}
          </Text>

          {question.answers.map((answer, answerIndex) => {
            const correct = answerIndex === question.correctIndex;

            return (
              <Text
                key={answerIndex}
                style={correct ? styles.correct : styles.text}
              >
                {correct ? '✓ ' : '• '}
                {cleanText(answer)}
                {correct ? ' — правильный ответ' : ''}
              </Text>
            );
          })}
        </View>
      ))}

      <FormButton
        label="Редактировать вопросы"
        secondary
        disabled={busy}
        onPress={() => router.back()}
      />

      <View style={styles.card}>
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
      </View>

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}

      <FormButton
        label={busy ? 'Подожди…' : 'Сохранить коллекцию'}
        disabled={busy || !canSave}
        onPress={saveCollection}
      />
    </FormPage>
  );
}