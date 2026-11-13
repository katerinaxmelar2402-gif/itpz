import { useState } from 'react';
import { router } from 'expo-router';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../../ui/theme';
import {
  sortCollectionsByAdded,
  useCollections,
} from '../../collections/useCollections';
import {
  CollectionCard,
  CollectionDialog,
  CollectionFeedback,
} from '../../components/collections/CollectionUI';
import { makeStyles } from './HomeScreen.styles';

export default function HomeScreen() {
  const { colors, commonStyles, dark } = useAppTheme();
  const styles = makeStyles(colors, dark);
  const library = useCollections();

  // null — окно закрыто;
  // picker — выбор коллекции;
  // details — информация о выбранной коллекции.
  const [dialog, setDialog] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const selectedCollection = library.collections.find(
    collection => collection.id === selectedId,
  );

  const recentCollections = library.collections
    .filter(collection => collection.lastGame)
    .sort((first, second) =>
      second.lastGame.finishedAt.localeCompare(first.lastGame.finishedAt)
      || Number(second.lastGame.sessionId) - Number(first.lastGame.sessionId)
    )
    .slice(0, 3);

  const starterCollection = library.collections.find(
    collection => collection.isBuiltIn,
  );

  const homeCollections = library.hasPlayed
    ? recentCollections
    : starterCollection
      ? [starterCollection]
      : [];

  const isReady = !library.loading && !library.error;

  function showCollection(collection) {
    setSelectedId(collection.id);
    setDialog('details');
  }

  function closeDialog() {
    setDialog(null);
    setSelectedId(null);
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={commonStyles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Что сегодня{'\n'}прокачаем?
          </Text>
        </View>

        <View style={styles.battleCard}>
          <Text style={styles.battleLabel}>ИГРОВОЙ БОЙ</Text>

          <View style={styles.battleBody}>
            <View style={styles.battleInfo}>
              <Text style={styles.battleTitle}>Вызов принят!</Text>

              <Text style={styles.description}>
                Выбери коллекцию и проверь себя.
              </Text>
            </View>

            <Image
              source={require('../../../assets/login-mascot.png')}
              style={styles.mascot}
              resizeMode="contain"
              accessible={false}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!isReady}
            onPress={() => setDialog('picker')}
            style={({ pressed }) => [
              styles.battleButton,
              !isReady && { opacity: 0.55 },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.battleButtonText}>Играть</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/create-method')}
            style={({ pressed }) => [
              styles.actionCard,
              styles.createCard,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.actionIcon}>+</Text>
            <Text style={styles.actionTitle}>Создать коллекцию</Text>

            <Text style={styles.actionDescription}>
              Вручную или{'\n'}по конспекту
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/connect-set')}
            style={({ pressed }) => [
              styles.actionCard,
              styles.keyCard,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.actionIcon}>→</Text>
            <Text style={styles.actionTitle}>Есть ключ?</Text>

            <Text style={styles.actionDescription}>
              Добавь коллекцию{'\n'}к себе
            </Text>
          </Pressable>
        </View>

        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {!isReady
                ? 'Коллекции'
                : library.hasPlayed
                  ? 'Недавние коллекции'
                  : 'Попробуй себя сразу'}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Все коллекции"
              onPress={() => router.navigate('/collections')}
              style={({ pressed }) => [
                styles.allButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.allLink}>Все →</Text>
            </Pressable>
          </View>

          <CollectionFeedback
            loading={library.loading}
            error={library.error}
            onRetry={library.reload}
          />

          {isReady && homeCollections.map(collection => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onPress={() => showCollection(collection)}
            />
          ))}

          {isReady && homeCollections.length === 0 && (
            <Text style={styles.description}>
              {library.hasPlayed
                ? 'Недавние коллекции больше недоступны. Выбери другую коллекцию.'
                : 'Пока нет доступных коллекций.'}
            </Text>
          )}
        </View>
      </ScrollView>

      {dialog && isReady && (
        <CollectionDialog
          mode={dialog}
          collection={selectedCollection}
          collections={sortCollectionsByAdded(library.collections)}
          onClose={closeDialog}
          onSelect={showCollection}
        />
      )}
    </SafeAreaView>
  );
}