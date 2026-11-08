import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Button, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '../../ui/theme';
import { AuthProvider, useAuth } from '../auth/AuthProvider';

function Navigation() {
  const { session, loading, error, retry } = useAuth();

  if (loading || error) {
    return (
      <SafeAreaView style={[commonStyles.screen, { justifyContent: 'center', padding: 24 }]}>
        {loading ? <ActivityIndicator color={colors.primary} /> : (
          <>
            <Text style={{ color: colors.text }}>{error}</Text>
            <Button title="Повторить" onPress={retry} />
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="home" />
      </Stack.Protected>
      <Stack.Screen name="help" options={{ headerShown: true, title: 'Справка' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Navigation />
    </AuthProvider>
  );
}