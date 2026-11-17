import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../ui/theme';
import { makeStyles } from './MistakePicker.styles';

export default function MistakePicker({ questions, busy, error, onClose, onStart, backLabel = 'Назад к результату' }) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [selected, setSelected] = useState(() =>
    questions.map(question => question.sessionQuestionId),
  );

  function toggle(id) {
    setSelected(previous => previous.includes(id)
      ? previous.filter(value => value !== id) : [...previous, id]);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>Работа над ошибками</Text>
          <Text style={styles.hint}>
            Выбери вопросы для нового боя. Сюда входят ошибки и ответы, на которые не хватило времени.
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.text}>
            Выбрано вопросов: {selected.length}. Жизней у каждого: {selected.length}.
          </Text>
          {questions.map(question => {
            const checked = selected.includes(question.sessionQuestionId);
            return (
              <Pressable
                key={question.sessionQuestionId}
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled: busy }}
                disabled={busy}
                onPress={() => toggle(question.sessionQuestionId)}
                style={[styles.question, checked && styles.selected]}
              >
                <Text accessible={false} style={styles.check}>{checked ? '✓' : '○'}</Text>
                <Text style={styles.questionText}>
                  {question.collectionTitle ? `${question.collectionTitle}\n` : ''}{question.text}
                </Text>
              </Pressable>
            );
          })}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            accessibilityRole="button"
            disabled={busy || selected.length === 0}
            onPress={() => onStart(selected)}
            style={[styles.button, (busy || selected.length === 0) && styles.dimmed]}
          >
            <Text style={styles.buttonText}>{busy ? 'Сохраняем…' : 'Начать работу над ошибками'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onClose}
            style={[styles.button, styles.secondary, busy && styles.dimmed]}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>{backLabel}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
