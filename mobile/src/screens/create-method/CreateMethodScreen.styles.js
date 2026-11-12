import { StyleSheet } from 'react-native';

export const makeStyles = (colors, dark) => StyleSheet.create({
  content: {
    padding: 24,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
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
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 32,
    marginBottom: 30,
  },

  methods: {
    gap: 22,
  },
  methodCard: {
    padding: 20,
    minHeight: 207,
    borderRadius: 24,
  },
  manualCard: {
    backgroundColor: dark ? '#403529' : '#EBD5B6',
  },
  notesCard: {
    backgroundColor: dark ? '#372E46' : '#EAE2F3',
  },

  iconBox: {
    width: 48,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 27,
    fontWeight: '700',
  },
  manualAccent: {
    color: dark ? '#E4B485' : '#C88E56',
  },
  notesAccent: {
    color: dark ? '#C7AEFF' : '#7B60AD',
  },

  methodTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 14,
  },
  descriptionBlock: {
    gap: 6,
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  arrow: {
    alignSelf: 'flex-end',
    fontSize: 23,
    fontWeight: '700',
    marginTop: 4,
  },

  footer: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 42,
  },
});