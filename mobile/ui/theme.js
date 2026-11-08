import { StyleSheet } from 'react-native';

export const colors = {
  background: '#F6F1E8',
  surface: '#FFFDFA',
  text: '#293D38',
  muted: '#7B8077',
  border: '#DDDCD1',
  primary: '#7B60AD',
  onPrimary: '#FFFFFF',
  error: '#A82A36',
};

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
};

export const commonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  field: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 13,
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 19,
    backgroundColor: colors.primary,
    borderRadius: 15,
  },
  primaryButtonText: { 
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center', 
  },
  errorText: { color: colors.error, fontWeight: '600' , textAlign: 'center'},
  linkText: { color: colors.primary, fontSize: 14 },
});