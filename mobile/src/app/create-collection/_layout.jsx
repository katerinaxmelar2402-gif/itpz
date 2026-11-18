import { Stack, useLocalSearchParams } from 'expo-router';

import { useAppTheme } from '../../../ui/theme';

import {
  CollectionDraftProvider,
} from '../../screens/create-collection/CollectionFormUI';

export default function CreateCollectionLayout() {
  const { colors } = useAppTheme();
  const { editId } = useLocalSearchParams();
  const collectionId = typeof editId === 'string' ? editId : '';

  return (
    <CollectionDraftProvider key={collectionId || 'new'} editId={collectionId}>
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
            title: collectionId ? 'Редактирование коллекции' : 'Новая коллекция',
          }}
        />

        <Stack.Screen
          name="review"
          options={{
            title: 'Проверка коллекции',
          }}
        />
        <Stack.Screen name="generate" options={{ title: 'По конспекту' }} />
      </Stack>
    </CollectionDraftProvider>
  );
}
