import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../../ui/theme';
import { makeStyles } from './CreateMethodScreen.styles';

export default function CreateMethodScreen() {
  const { colors, commonStyles, dark } = useAppTheme();
  const styles = makeStyles(colors, dark);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={commonStyles.screen}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Создать набор
        </Text>

        <Text style={styles.subtitle}>
          Как будем готовить вопросы?
        </Text>

        <Text style={styles.eyebrow}>
          ДВА СПОСОБА — ОДИН АРХИВ
        </Text>

        <View style={styles.methods}>
          <View
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            style={[styles.methodCard, styles.manualCard]}
          >
            <View style={styles.iconBox}>
              <Text style={[styles.icon, styles.manualAccent]}>+</Text>
            </View>

            <Text style={styles.methodTitle}>Вручную</Text>

            <View style={styles.descriptionBlock}>
              <Text style={styles.description}>
                Напиши свои вопросы и варианты.
              </Text>
              <Text style={styles.description}>
                Отметь правильный ответ.
              </Text>
            </View>

            <Text style={[styles.arrow, styles.manualAccent]}>→</Text>
          </View>

          <View
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            style={[styles.methodCard, styles.notesCard]}
          >
            <View style={styles.iconBox}>
              <Text style={[styles.icon, styles.notesAccent]}>✦</Text>
            </View>

            <Text style={styles.methodTitle}>По конспекту</Text>

            <View style={styles.descriptionBlock}>
              <Text style={styles.description}>
                Загрузи TXT, DOCX или PDF.
              </Text>
              <Text style={styles.description}>
                Проверь и отредактируй результат.
              </Text>
            </View>

            <Text style={[styles.arrow, styles.notesAccent]}>→</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Оба способа сохраняют набор в архиве.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}