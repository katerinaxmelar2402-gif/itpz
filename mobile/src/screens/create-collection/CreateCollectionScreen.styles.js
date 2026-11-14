import { StyleSheet } from 'react-native';

export const makeStyles = colors => StyleSheet.create({
  flex: {
    flex: 1,
  },

  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },

  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },

  text: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
  },

  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },

  error: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },

  field: {
    gap: 6,
  },

  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 13,
    fontSize: 15,
  },

  multiline: {
    minHeight: 110,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: 'top',
  },

  card: {
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },

  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  answerCard: {
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },

  selectedAnswerCard: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '0D',
  },

  answerSelector: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  answerSelectorText: {
    flexShrink: 1,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },

  selectedAnswerText: {
    color: colors.accent,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedRadio: {
    borderColor: colors.accent,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },

  correct: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 23,
  },

  removeText: {
    color: colors.error,
    fontSize: 26,
  },

  info: {
    color: colors.primary,
    fontSize: 25,
  },

  button: {
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 15,
  },

  buttonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },

  secondaryButtonText: {
    color: colors.text,
  },

  disabled: {
    opacity: 0.4,
  },

  pressed: {
    opacity: 0.75,
  },

  keyBox: {
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 12,
  },

  keyText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
});
