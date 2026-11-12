import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, spacing } from '../../ui/theme';

export default function SectionScreen({ title, children }) {
  const { colors, commonStyles } = useAppTheme();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[commonStyles.screen, styles.content]}
    >
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  title: { fontSize: 27, fontWeight: '700' },
});