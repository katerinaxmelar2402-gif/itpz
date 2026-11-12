import { Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../../ui/theme';
import { makeStyles } from './HomeScreen.styles';

export default function HomeScreen() {
  const { colors, commonStyles, dark } = useAppTheme();
  const styles = makeStyles(colors, dark);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={commonStyles.screen}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Text style={styles.eyebrow}>ПРИВЕТ, КАТЯ</Text>

            <Text accessibilityRole="header" style={styles.title}>
              Что сегодня{'\n'}прокачаем?
            </Text>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>К</Text>
          </View>
        </View>

        <View style={styles.battleCard}>
          <Text style={styles.battleLabel}>ИГРОВОЙ БОЙ</Text>

          <View style={styles.battleBody}>
            <View style={styles.battleInfo}>
              <Text style={styles.battleTitle}>Вызов принят?</Text>

              <Text style={styles.description}>
                Выбери наборы и проверь себя.
              </Text>
            </View>

            <Image
              source={require('../../../assets/login-mascot.png')}
              style={styles.mascot}
              resizeMode="contain"
              accessible={false}
            />
          </View>

          <View
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            style={styles.battleButton}
          >
            <Text style={styles.battleButtonText}>
              Выбрать наборы →
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <View
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            style={[styles.actionCard, styles.createCard]}
          >
            <Text style={styles.actionIcon}>+</Text>
            <Text style={styles.actionTitle}>Создать набор</Text>
            <Text style={styles.actionDescription}>
              Вручную или{'\n'}по конспекту
            </Text>
          </View>

          <View
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            style={[styles.actionCard, styles.keyCard]}
          >
            <Text style={styles.actionIcon}>→</Text>
            <Text style={styles.actionTitle}>Есть ключ?</Text>
            <Text style={styles.actionDescription}>
              Добавь набор{'\n'}в свой архив
            </Text>
          </View>
        </View>

        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Недавние наборы
            </Text>

            <Text style={styles.allLink}>Все →</Text>
          </View>

          <View style={styles.collectionCard}>
            <View style={styles.collectionInfo}>
              <Text style={styles.collectionTitle}>Биология: клетка</Text>

              <Text style={styles.collectionDescription}>
                10 вопросов · Личный набор
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}