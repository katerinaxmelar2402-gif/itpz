import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../ui/theme';
import { makeStyles } from './PlayScreen.styles';

const previewSets = [
  { title: 'Биология: клетка', detail: '10 вопросов' },
  { title: 'История Руси', detail: '25 вопросов' },
];

/** @param {{ label: string, value: string, position: `${number}%`, styles: ReturnType<typeof makeStyles> }} props */
function SliderPreview({ label, value, position, styles }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.setting}>
      <View style={styles.settingHeader}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingValue}>{value}</Text>
      </View>
      <View style={styles.sliderSlot}>
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: position }]} />
          <View style={[styles.sliderThumb, { left: position }]} />
        </View>
      </View>
    </View>
  );
}

export default function PlayScreen() {
  const { colors, commonStyles, dark } = useAppTheme();
  const styles = makeStyles(colors, dark);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={commonStyles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Подготовка к бою</Text>
          <Text style={styles.subtitle}>Выбери параметры своей тренировки.</Text>
        </View>

        <View style={styles.sets}>
          {previewSets.map(set => (
            <View key={set.title} style={styles.setCard}>
              <View style={styles.setInfo}>
                <Text style={styles.setTitle}>{set.title}</Text>
                <Text style={styles.setDetail}>{set.detail}</Text>
              </View>
              <View accessible accessibilityRole="button"
                accessibilityLabel={`Убрать набор «${set.title}»`}
                accessibilityState={{ disabled: true }} style={styles.removeButton}>
                <Text style={styles.removeIcon}>×</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.settings}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Настройки боя</Text>
          <SliderPreview label="Здоровье участников" value="8 HP" position="50%" styles={styles} />
          <SliderPreview label="Время на ответ" value="30 сек" position="60%" styles={styles} />

          <View style={styles.orderRow}>
            <Text style={styles.settingLabel}>Порядок вопросов</Text>
            <View style={styles.orderOptions}>
              <View accessible accessibilityRole="radio" accessibilityLabel="По порядку"
                accessibilityState={{ checked: true, disabled: true }}
                style={[styles.orderOption, styles.selectedOrder]}>
                <Text style={styles.selectedOrderText}>По порядку</Text>
              </View>
              <View accessible accessibilityRole="radio" accessibilityLabel="Случайно"
                accessibilityState={{ checked: false, disabled: true }} style={styles.orderOption}>
                <Text style={styles.orderText}>Случайно</Text>
              </View>
            </View>
          </View>
        </View>

        <View accessible accessibilityRole="button" accessibilityState={{ disabled: true }} style={styles.startButton}>
          <Text style={styles.startText}>Начать бой →</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
