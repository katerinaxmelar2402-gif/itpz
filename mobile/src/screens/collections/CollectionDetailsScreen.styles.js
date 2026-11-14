import { StyleSheet } from 'react-native';

export const makeStyles = colors => StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
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
  },

  status: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  statusText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },

  keyBox: {
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },

  keyLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  keyText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },

  pressed: {
    opacity: 0.75,
  },
});