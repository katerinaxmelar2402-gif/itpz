import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Button, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../ui/theme';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { SettingsProvider, useSettings } from '../settings/SettingsProvider';
import BattleSync from '../game/BattleSync';
import { AudioProvider } from '../settings/AudioProvider';

function Navigation() {
  const { session, loading, error, retry } = useAuth();
  const { colors, commonStyles, dark } = useAppTheme();
  const { loading: settingsLoading } = useSettings();

  if (loading || settingsLoading || error) {
    return (
      <SafeAreaView style={[commonStyles.screen, { justifyContent: 'center', padding: 24 }]}>
        {loading || settingsLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Text style={{ color: colors.text }}>{error}</Text>
            <Button title="Повторить" onPress={retry} />
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="index" />
          <Stack.Screen name="register" />
          <Stack.Screen name="reset-password" />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="statistics-collections" />
          <Stack.Screen
            name="collection/[id]"
            options={{
              headerShown: true,
              title: 'Просмотр вопросов',
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="play/[id]"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="battle/[id]"
            options={{
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="create-collection"
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="create-method"
            options={{
              headerShown: true,
              title: 'Создание набора',
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerShadowVisible: false,
            }}
          />

          <Stack.Screen
            name="connect-set"
            options={{
              headerShown: true,
              title: 'Добавление набора',
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerShadowVisible: false,
            }}
          />
        </Stack.Protected>

        <Stack.Screen
          name="help"
          options={{
            headerShown: true,
            title: 'Справка',
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="legal/[document]"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AudioProvider>
          <BattleSync />
          <Navigation />
        </AudioProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
