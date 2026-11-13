import { Stack } from 'expo-router';

import { useAppTheme } from '../../../ui/theme';

import {
  CollectionDraftProvider,
} from '../../screens/create-collection/CollectionFormUI';

export default function CreateCollectionLayout() {
  const { colors } = useAppTheme();

  return (
    <CollectionDraftProvider>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Новая коллекция',
          }}
        />

        <Stack.Screen
          name="review"
          options={{
            title: 'Проверка коллекции',
          }}
        />
      </Stack>
    </CollectionDraftProvider>
  );
}