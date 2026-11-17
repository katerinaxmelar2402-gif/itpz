import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../ui/theme';

export default function ShopScreen() {
  const { colors, commonStyles } = useAppTheme();
  const styles = makeStyles(colors);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const contentWidth = Math.min(viewport.width, 560);
  const imageWidth = Math.max(0, contentWidth - 48);
  const imageHeight = Math.min(imageWidth / 1.5, viewport.height * 0.34);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={commonStyles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, viewport.width > 0 && { width: contentWidth }]}
        onLayout={({ nativeEvent: { layout } }) => setViewport({ width: layout.width, height: layout.height })}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <Text accessibilityRole="header" style={styles.title}>Магазин</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>СКОРО ОТКРЫТИЕ</Text>
        </View>
        <Image
          source={require('../../../assets/mascots/shop-coming-soon-v2.png')}
          accessibilityLabel="Жёлтый герой в фиолетовой повязке рядом с маленьким строящимся магазином."
          style={[styles.illustration, { width: imageWidth, height: imageHeight }]}
          resizeMode="contain"
        />
        <Text accessibilityRole="header" style={styles.heading}>Готовим магазин к открытию</Text>
        <Text style={styles.description}>
          Герой уже на месте, а мы ещё наводим порядок.
          Скоро здесь можно будет выбирать новых соперников и наряды.
        </Text>
        <View style={styles.features}>
          <Text style={styles.featureTitle}>Новые соперники</Text>
          <Text style={styles.featureText}>Выбирай, с кем выйти на следующий поединок.</Text>
          <View style={styles.divider} />
          <Text style={styles.featureTitle}>Наряды для героя</Text>
          <Text style={styles.featureText}>Собери образ под своё настроение и стиль игры.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = colors => StyleSheet.create({
  scroll: { flex: 1, width: '100%' },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 24, paddingBottom: 32 },
  title: { color: colors.text, fontSize: 27, fontWeight: '700', marginBottom: 20 },
  badge: { alignSelf: 'center', borderRadius: 20, backgroundColor: colors.consentBackground, paddingHorizontal: 16, paddingVertical: 9, marginBottom: 12 },
  badgeText: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  illustration: { alignSelf: 'center', flexShrink: 0, marginBottom: 16 },
  heading: { color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: '700', textAlign: 'center' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  features: { borderRadius: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 18, marginTop: 20 },
  featureTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  featureText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  footer: { color: colors.accent, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 20 },
});
