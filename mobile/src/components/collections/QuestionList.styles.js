import { StyleSheet } from 'react-native';

export const makeStyles = colors => StyleSheet.create({
  card: {
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  answer: { color: colors.text, fontSize: 15, lineHeight: 23 },
  correct: { color: colors.accent, fontSize: 14, lineHeight: 23, fontWeight: '600' },
});
