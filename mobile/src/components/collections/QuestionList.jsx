import { Text, View } from 'react-native';
import { useAppTheme } from '../../../ui/theme';
import { makeStyles } from './QuestionList.styles';

export default function QuestionList({ questions }) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  return questions.map((question, questionIndex) => (
    <View key={question.id} style={styles.card}>
      <Text style={styles.title}>
        {questionIndex + 1}. {question.text.trim()}
      </Text>
      {question.answers.map((answer, answerIndex) => {
        const correct = answerIndex === question.correctIndex;
        return (
          <Text key={answerIndex} style={correct ? styles.correct : styles.answer}>
            {correct ? '✓ ' : '• '}{answer.trim()}
            {correct ? ' — правильный ответ' : ''}
          </Text>
        );
      })}
    </View>
  ));
}
