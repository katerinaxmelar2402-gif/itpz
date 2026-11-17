import { StyleSheet } from 'react-native';

export const makeStyles = (colors, dark) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: 24,
    paddingBottom: 40,
  },

  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  illustration: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark ? '#29392F' : '#E2EBDD',
    marginTop: 48,
    marginBottom: 12,
  },
  plus: {
    color: dark ? '#9BC5A4' : '#37654B',
    fontSize: 48,
    fontWeight: '600',
  },
  pasteHint: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 32,
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  error: { color: colors.error, fontSize: 14, lineHeight: 22, marginTop: 18 },
  preview: {
    padding: 20,
    marginTop: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  previewTitle: { color: colors.text, fontSize: 21, fontWeight: '700' },
  previewMeta: { color: colors.muted, fontSize: 14, lineHeight: 22 },

  form: {
    gap: 10,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
  },
  findButton: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 19,
    paddingVertical: 14,
    marginTop: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
  },
  findButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 30,
  },
});
