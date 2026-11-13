import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { useAppTheme } from '../../../ui/theme';

import {
  FormButton,
  FormField,
  FormPage,
  LIMITS,
  useCollectionDraft,
  validateDraft,
} from './CollectionFormUI';

import { makeStyles } from './CreateCollectionScreen.styles';

export default function CreateCollectionScreen() {
  const { draft, setDraft } = useCollectionDraft();
  const { request } = useAuth();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  const busyRef = useRef(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function updateQuestion(id, transform) {
    if (busyRef.current) return;

    setError('');

    setDraft(current => ({
      ...current,
      questions: current.questions.map(question =>
        question.id === id ? transform(question) : question
      ),
    }));
  }

  function addQuestion() {
    if (busyRef.current) return;

    setError('');

    setDraft(current => {
      if (
        !current.title.trim()
        || current.questions.length >= LIMITS.maxQuestions
      ) {
        return current;
      }

      return {
        ...current,
        nextQuestionId: current.nextQuestionId + 1,
        questions: [
          ...current.questions,
          {
            id: current.nextQuestionId,
            text: '',
            answers: ['', ''],
            correctIndex: null,
          },
        ],
      };
    });
  }

  function removeQuestion(id) {
    if (busyRef.current) return;

    setError('');

    setDraft(current => ({
      ...current,
      questions: current.questions.filter(question => question.id !== id),
    }));
  }

  function removeAnswer(questionId, answerIndex) {
    updateQuestion(questionId, question => {
      if (question.answers.length <= LIMITS.minAnswers) {
        return question;
      }

      let correctIndex = question.correctIndex;

      if (correctIndex === answerIndex) {
        correctIndex = null;
      } else if (
        correctIndex !== null
        && correctIndex > answerIndex
      ) {
        correctIndex -= 1;
      }

      return {
        ...question,
        answers: question.answers.filter(
          (_, index) => index !== answerIndex,
        ),
        correctIndex,
      };
    });
  }

  async function goToReview() {
    if (busyRef.current) return;

    const validationError = validateDraft(draft);

    if (validationError) {
      setError(validationError);
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError('');

    try {
      await request('/collections/check-title', {
        method: 'POST',
        body: { title: draft.title },
      });

      router.push('/create-collection/review');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось проверить название.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <FormPage>
      <Text accessibilityRole="header" style={styles.title}>
        Создай свою коллекцию
      </Text>

      <FormField
        label="Название коллекции"
        value={draft.title}
        maxLength={LIMITS.title}
        editable={!busy}
        onChangeText={title => {
          setError('');
          setDraft(current => ({ ...current, title }));
        }}
      />

      <Text style={styles.hint}>
        Добавь от 5 до 20 вопросов. У каждого должен быть один
        правильный ответ.
      </Text>

      {draft.questions.map((question, questionIndex) => (
        <View key={question.id} style={styles.card}>
          <Text style={styles.sectionTitle}>
            Вопрос {questionIndex + 1}
          </Text>

          <FormField
            label="Текст вопроса"
            value={question.text}
            maxLength={LIMITS.question}
            multiline
            editable={!busy}
            onChangeText={text =>
              updateQuestion(question.id, current => ({
                ...current,
                text,
              }))
            }
          />

          {question.answers.map((answer, answerIndex) => {
            const selected = question.correctIndex === answerIndex;

            return (
              <View key={answerIndex} style={styles.answerRow}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={
                    `Выбрать ответ ${answerIndex + 1} правильным`
                  }
                  accessibilityState={{
                    checked: selected,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() =>
                    updateQuestion(question.id, current => ({
                      ...current,
                      correctIndex: answerIndex,
                    }))
                  }
                  style={styles.iconButton}
                >
                  <Text
                    style={[
                      styles.radio,
                      selected && styles.selectedRadio,
                    ]}
                  >
                    {selected ? '●' : '○'}
                  </Text>
                </Pressable>

                <View style={styles.flex}>
                  <FormField
                    label={`Ответ ${answerIndex + 1}`}
                    value={answer}
                    maxLength={LIMITS.answer}
                    editable={!busy}
                    onChangeText={text =>
                      updateQuestion(question.id, current => ({
                        ...current,
                        answers: current.answers.map(
                          (value, index) =>
                            index === answerIndex ? text : value,
                        ),
                      }))
                    }
                  />

                  {selected && (
                    <Text style={styles.correct}>
                      Правильный ответ
                    </Text>
                  )}
                </View>

                {question.answers.length > LIMITS.minAnswers && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      `Удалить ответ ${answerIndex + 1}`
                    }
                    disabled={busy}
                    onPress={() =>
                      removeAnswer(question.id, answerIndex)
                    }
                    style={styles.iconButton}
                  >
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          <Text style={styles.hint}>
            Нажми на кружок рядом с правильным ответом.
          </Text>

          {question.answers.length < LIMITS.maxAnswers && (
            <FormButton
              label="+ Добавить ответ"
              secondary
              disabled={busy}
              onPress={() =>
                updateQuestion(question.id, current => {
                  if (current.answers.length >= LIMITS.maxAnswers) {
                    return current;
                  }

                  return {
                    ...current,
                    answers: [...current.answers, ''],
                  };
                })
              }
            />
          )}

          <FormButton
            label="Удалить вопрос"
            secondary
            disabled={busy}
            onPress={() => removeQuestion(question.id)}
          />
        </View>
      ))}

      <FormButton
        label={
          draft.questions.length >= LIMITS.maxQuestions
            ? 'Добавлено максимум: 20 вопросов'
            : '+ Добавить вопрос'
        }
        secondary
        disabled={
          busy
          || !draft.title.trim()
          || draft.questions.length >= LIMITS.maxQuestions
        }
        onPress={addQuestion}
      />

      <Text style={styles.hint}>
        Добавлено вопросов: {draft.questions.length}/20
        {draft.questions.length < LIMITS.minQuestions
          ? ` · нужно ещё ${LIMITS.minQuestions - draft.questions.length}`
          : ''}
      </Text>

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}

      <FormButton
        label={busy ? 'Проверяем…' : 'Далее: проверить коллекцию'}
        disabled={
          busy
          || draft.questions.length < LIMITS.minQuestions
        }
        onPress={goToReview}
      />
    </FormPage>
  );
}