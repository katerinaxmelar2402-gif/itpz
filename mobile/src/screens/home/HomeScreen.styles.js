import { StyleSheet } from 'react-native';

export const makeStyles = (colors, dark) => {
  const greenCard = dark ? '#29392F' : '#E2EBDD';
  const sandCard = dark ? '#403529' : '#EBD5B6';
  const purpleCard = dark ? '#372E46' : '#EAE2F3';
  const green = dark ? '#9BC5A4' : '#386C5D';

  return StyleSheet.create({
    content: {
      padding: 24,
      paddingBottom: 32,
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 28,
    },
    greeting: {
      flex: 1,
    },
    eyebrow: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 18,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '700',
    },
    stars: {
      width: 76,
      height: 76,
      flexShrink: 0,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: greenCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: green,
      fontSize: 20,
      fontWeight: '700',
    },

    battleCard: {
      padding: 20,
      borderRadius: 24,
      backgroundColor: greenCard,
    },
    battleLabel: {
      color: green,
      fontSize: 11,
      fontWeight: '700',
    },
    battleBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 20,
      marginBottom: 16,
    },
    battleInfo: {
      flex: 1,
      gap: 8,
    },
    battleTitle: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '700',
    },
    description: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
    mascot: {
      width: 64,
      height: 76,
    },
    battleButton: {
      alignSelf: 'flex-start',
      minHeight: 44,
      paddingHorizontal: 16,
      paddingVertical: 10,
      justifyContent: 'center',
      borderRadius: 11,
      backgroundColor: green,
    },
    battleButtonText: {
      color: dark ? colors.background : '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },

    actions: {
      flexDirection: 'row',
      gap: 14,
      marginTop: 16,
    },
    actionCard: {
      flex: 1,
      padding: 18,
      minHeight: 143,
      borderRadius: 21,
    },
    createCard: {
      backgroundColor: sandCard,
    },
    keyCard: {
      backgroundColor: purpleCard,
    },
    actionIcon: {
      color: green,
      fontSize: 23,
      fontWeight: '700',
      marginBottom: 16,
    },
    actionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 10,
    },
    actionDescription: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
    },

    recentSection: {
      marginTop: 34,
      gap: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    sectionTitle: {
      flexShrink: 1,
      color: colors.text,
      fontSize: 20,
      fontWeight: '700',
    },
    allLink: {
      color: green,
      fontSize: 12,
    },
    collectionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 78,
      padding: 16,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    collectionInfo: {
      flex: 1,
      gap: 8,
    },
    collectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    collectionDescription: {
      color: colors.muted,
      fontSize: 12,
    },
    chevron: {
      color: green,
      fontSize: 24,
    },
    pressed: {
      opacity: 0.75,
    },
    disabled: {
      opacity: 0.55,
    },
    allButton: {
      minWidth: 48,
      minHeight: 44,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
  });
};
