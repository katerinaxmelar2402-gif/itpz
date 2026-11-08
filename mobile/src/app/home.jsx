import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles, spacing } from '../../ui/theme';
import { useAuth } from '../auth/AuthProvider';

export default function HomeRoute() {
  const { session, signOut } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    setError('');
    try {
      await signOut();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось выйти.');
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;

  return (
    <SafeAreaView style={[commonStyles.screen, styles.content]}>
      <Text accessibilityRole="header" style={styles.title}>Привет, {session.user.name}!</Text>
      <Text style={styles.text}>{session.user.email}</Text>
      <Link href="/help" style={commonStyles.linkText}>Открыть справку</Link>
      {!!error && <Text accessibilityLiveRegion="polite" style={styles.text}>{error}</Text>}
      <Pressable accessibilityRole="button" style={commonStyles.primaryButton} onPress={leave} disabled={busy}>
        <Text style={commonStyles.primaryButtonText}>{busy ? 'Подождите…' : 'Выйти'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  title: { color: colors.text, fontSize: 27, fontWeight: '700' },
  text: { color: colors.text },
});