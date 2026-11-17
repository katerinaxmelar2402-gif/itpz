import { StyleSheet } from 'react-native';

export const makeStyles = colors => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 16 },
  title: { color: colors.text, fontSize: 25, fontWeight: '700' },
  text: { color: colors.text, fontSize: 16, lineHeight: 23 },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  question: {
    padding: 16, borderRadius: 16, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
    flexDirection: 'row', gap: 12, alignItems: 'center',
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.consentBackground },
  check: { width: 25, color: colors.primary, fontSize: 22, fontWeight: '700' },
  questionText: { flex: 1, color: colors.text, fontSize: 16, lineHeight: 23 },
  button: {
    minHeight: 52, padding: 16, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary,
  },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text },
  dimmed: { opacity: 0.6 },
  error: { color: colors.error, fontSize: 14, lineHeight: 21 },
});
