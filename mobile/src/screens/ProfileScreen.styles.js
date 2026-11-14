import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 24, gap: 16 },
  identity: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarMascot: { width: 68, height: 74, marginTop: 8 },
  name: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  email: { textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: '700' },
  action: { minHeight: 44, justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },

  settingLabel: {
    flex: 1,
    fontSize: 15,
  },

  switchSlot: {
    width: 72,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },

  largeSwitch: {
    transform: [
      { scaleX: 1.3 },
      { scaleY: 1.3 },
    ],
  },

  themeOptions: {
    flexDirection: 'row',
    gap: 6,
  },

  themeOption: {
    minHeight: 44,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sliderLabel: {
    fontSize: 15,
    fontWeight: '600',
  },

  slider: {
    width: '100%',
    height: 48,
  },
});