import { StyleSheet } from 'react-native';
import { useSettings } from '../src/settings/SettingsProvider';

export const colors = {
  background: '#F6F1E8',
  surface: '#FFFDFA',
  text: '#293D38',
  muted: '#7B8077',
  border: '#DDDCD1',
  primary: '#7B60AD',
  onPrimary: '#FFFFFF',
  error: '#A82A36',
  accent: '#527A60',
  consentBackground: '#EAE2F3',
  dialogBackground: '#EBD5B6',
};

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
};

const makeCommonStyles = colors => StyleSheet.create({
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

const darkColors = {
  background: '#18161E',
  surface: '#25222E',
  text: '#F4EFF7',
  muted: '#BCB3C5',
  border: '#494252',
  primary: '#C7AEFF',
  onPrimary: '#231638',
  error: '#FF9BA5',
  accent: '#9BC5A4',
  consentBackground: '#3C334A',
  dialogBackground: '#403529',
};

export const commonStyles = makeCommonStyles(colors);

const lightTheme = { colors, commonStyles, dark: false };
const darkTheme = {
  colors: darkColors,
  commonStyles: makeCommonStyles(darkColors),
  dark: true,
};

export function useAppTheme() {
  const { app } = useSettings();
  return app.theme === 'dark' ? darkTheme : lightTheme;
}