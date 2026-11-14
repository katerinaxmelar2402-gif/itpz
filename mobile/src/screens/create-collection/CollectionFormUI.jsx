import { createContext, useContext, useEffect, useState } from 'react';

import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../../ui/theme';
import { useAuth } from '../../auth/AuthProvider';
import { makeStyles } from './CreateCollectionScreen.styles';

const DraftContext = createContext(null);

export const LIMITS = {
  title: 100,
  question: 500,
  answer: 200,
  minQuestions: 5,
  maxQuestions: 20,
  minAnswers: 2,
  maxAnswers: 6,
};

export function cleanText(value) {
  return value.normalize('NFKC').trim();
}

export function validateDraft(draft) {
  const title = cleanText(draft.title);

  if (!title || title.length > LIMITS.title) {
    return 'Введи название коллекции: от 1 до 100 символов.';
  }

  if (
    draft.questions.length < LIMITS.minQuestions
    || draft.questions.length > LIMITS.maxQuestions
  ) {
    return 'В коллекции должно быть от 5 до 20 вопросов.';
  }

  for (const [index, question] of draft.questions.entries()) {
    const number = index + 1;
    const text = cleanText(question.text);
    const answers = question.answers.map(cleanText);

    if (!text || text.length > LIMITS.question) {
      return `Вопрос ${number}: введи от 1 до 500 символов в поле "Вопрос".`;
    }

    if (
      answers.length < LIMITS.minAnswers
      || answers.length > LIMITS.maxAnswers
      || answers.some(answer =>
        !answer
        || answer.length > LIMITS.answer
        || /[\r\n]/.test(answer)
      )
    ) {
      return `Вопрос ${number}: заполни от 2 до 6 ответов, до 200 символов каждый.`;
    }

    const uniqueAnswers = new Set(
      answers.map(answer => answer.toLocaleLowerCase('ru-RU')),
    );

    if (uniqueAnswers.size !== answers.length) {
      return `Вопрос ${number}: варианты ответа должны различаться.`;
    }

    if (
      !Number.isInteger(question.correctIndex)
      || question.correctIndex < 0
      || question.correctIndex >= answers.length
    ) {
      return `Вопрос ${number}: отметь правильный ответ.`;
    }
  }

  return '';
}

export function CollectionDraftProvider({ children, editId = '' }) {
  const { request } = useAuth();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState({
    title: '',
    questions: [],
    nextQuestionId: 1,
    publicChoice: null,
    accessKey: '',
  });

  useEffect(() => {
    if (!editId) return;
    let active = true;
    request(`/collections/${encodeURIComponent(editId)}`)
      .then(({ collection }) => {
        if (!collection.canEdit) {
          throw new Error('Можно редактировать только свои коллекции.');
        }
        if (active) setDraft({
          editingId: collection.id,
          version: collection.version,
          canDelete: collection.canDelete && collection.isOwner,
          title: collection.title,
          questions: collection.questions.map((question, index) => ({
            ...question, sourceId: question.id, id: index + 1,
          })),
          nextQuestionId: collection.questions.length + 1,
          publicChoice: !!collection.accessKey,
          accessKey: collection.accessKey || '',
        });
      })
      .catch(reason => {
        if (active) setLoadError(reason.message || 'Не удалось загрузить коллекцию.');
      });
    return () => { active = false; };
  }, [editId, request, attempt]);

  if (editId && draft.editingId !== editId) {
    return (
      <FormPage>
        <Text style={styles.hint}>{loadError || 'Загружаем коллекцию…'}</Text>
        {!!loadError && (
          <FormButton label="Повторить" onPress={() => {
            setLoadError('');
            setAttempt(value => value + 1);
          }} />
        )}
      </FormPage>
    );
  }

  return (
    <DraftContext.Provider value={{ draft, setDraft }}>
      {children}
    </DraftContext.Provider>
  );
}

export function useCollectionDraft() {
  const context = useContext(DraftContext);

  if (!context) {
    throw new Error(
      'Экраны создания должны находиться внутри CollectionDraftProvider.',
    );
  }

  return context;
}

export function FormButton({
  label,
  onPress,
  disabled = false,
  secondary = false,
}) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function FormField({
  label,
  value,
  onChangeText,
  maxLength,
  multiline = false,
  editable = true,
}) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        accessibilityLabel={label}
        value={value}
        editable={editable}
        onChangeText={text =>
          onChangeText(
            multiline ? text : text.replace(/[\r\n]/g, ''),
          )
        }
        maxLength={maxLength}
        multiline={multiline}
        placeholder={label}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          multiline && styles.multiline,
          !editable && styles.disabled,
        ]}
      />

      <Text style={styles.hint}>
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

export function FormPage({ children }) {
  const { colors, commonStyles } = useAppTheme();
  const styles = makeStyles(colors);

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={commonStyles.screen}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
