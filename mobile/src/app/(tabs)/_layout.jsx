import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import swordCross from '../../../assets/sword-cross.png';
import { useAppTheme } from '../../../ui/theme';
import { makeStyles } from '../../navigation/MainTabs.styles';

export const unstable_settings = { anchor: 'home' };

/** @typedef {import('expo-symbols').SymbolViewProps['name']} TabSymbol */
/** @type {{ name: string, label: string, icon?: TabSymbol }[]} */
const sections = [
  {
    name: 'collections',
    label: 'Коллекции',
    icon: {
      ios: 'rectangle.stack.fill',
      android: 'collections_bookmark',
      web: 'collections_bookmark',
    },
  },
  {
    name: 'home',
    label: 'Игра',
  },
  {
    name: 'statistics',
    label: 'Статистика',
    icon: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  },
  {
    name: 'profile',
    label: 'Профиль',
  },
];

/** @param {{ name: string, icon?: TabSymbol, isFocused: boolean }} props */
function TabIcon({ name, icon, isFocused }) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const tint = isFocused ? colors.onPrimary : colors.primary;

  if (name === 'home') {
    return (
      <Image
        accessible={false}
        source={swordCross}
        style={[styles.artwork, isFocused && styles.activeArtwork, { tintColor: tint }]}
      />
    );
  }

  if (name === 'profile') {
    return (
      <View style={[styles.artwork, styles.character, isFocused && styles.activeArtwork]}>
        <View style={styles.legs}>
          <View style={[styles.leg, { backgroundColor: tint }]} />
          <View style={[styles.leg, { backgroundColor: tint }]} />
        </View>
        <View style={[styles.characterBody, { borderColor: tint }]}>
          <View style={[styles.eye, { backgroundColor: tint }]} />
          <View style={[styles.eye, { backgroundColor: tint }]} />
        </View>
      </View>
    );
  }

  return icon ? <SymbolView name={icon} size={isFocused ? 30 : 24} tintColor={tint} /> : null;
}

/** @param {import('expo-router/ui').TabTriggerSlotProps & { name: string, label: string, icon?: TabSymbol }} props */
function TabButton({ name, label, icon, isFocused = false, ...props }) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.iconSlot}>
        <View style={[styles.icon, isFocused && styles.activeIcon]}>
          <TabIcon name={name} icon={icon} isFocused={isFocused} />
        </View>
      </View>

      <Text style={[styles.label, isFocused && styles.activeLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { colors, commonStyles } = useAppTheme();
  const styles = makeStyles(colors);
  return (
    <Tabs style={commonStyles.screen} options={{ backBehavior: 'initialRoute' }}>
      <TabSlot />

      <TabList asChild>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bar}>
          <View pointerEvents="none" style={styles.barBackground} />

          {sections.map(({ name, label, icon }) => (
            <TabTrigger key={name} name={name} href={`/${name}`} asChild>
              <TabButton name={name} label={label} icon={icon} />
            </TabTrigger>
          ))}
        </SafeAreaView>
      </TabList>
    </Tabs>
  );
}
