import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../../ui/theme';
import { makeStyles } from './CreateMethodScreen.styles';

export default function CreateMethodScreen() {
  const { colors, commonStyles, dark } = useAppTheme();
  const styles = makeStyles(colors, dark);

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={commonStyles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <Text accessibilityRole="header" style={styles.title}>
          Создать набор
        </Text>

        <Text style={styles.subtitle}>
          Как будем готовить вопросы?
        </Text>

        <View style={styles.methods}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/create-collection')}
            style={({ pressed }) => [
              styles.methodCard,
              styles.manualCard,
              pressed && { opacity: 0.8 },
            ]}
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
          </Pressable>  

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/create-collection/generate')}
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
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Оба способа сохраняют набор в архиве.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
