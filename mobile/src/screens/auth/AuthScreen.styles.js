//Хранит отступы и размеры формы, заголовка и маскота. 
// Цвета и вид общих элементов берутся из существующей темы.
import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../../ui/theme';
const passwordToggleWidth = 48;

export const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 44,
    paddingBottom: spacing.lg,
  },
  inputRow: { position: 'relative' },
  passwordInput: { paddingEnd: passwordToggleWidth + spacing.sm },
  passwordToggle: {
    position: 'absolute',
    end: 0,
    top: 0,
    bottom: 0,
    width: passwordToggleWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center', color: colors.text, fontSize: 19, fontWeight: '700' },
  mascot: { width: 156, height: 138, alignSelf: 'center', marginTop: 42 },
  heading: {
    textAlign: 'center', color: colors.text, fontSize: 27,
    fontWeight: '700', marginTop: 40,
  },
  subtitle: { textAlign: 'center', color: colors.muted, marginTop: spacing.sm },
  form: { marginTop: 36 },
  fieldGroup: { marginBottom: spacing.lg },
  label: { color: colors.muted, fontWeight: '700', marginBottom: spacing.sm },
  forgot: { alignSelf: 'flex-end', paddingVertical: spacing.sm },
  submit: { marginTop: spacing.lg },
  bottomLink: { marginTop: spacing.lg, textAlign: 'center', paddingVertical: spacing.sm },
  feedback: { color: colors.text, marginTop: spacing.sm },
  consent: { paddingVertical: spacing.sm },
  disabled: { opacity: 0.6 },
});