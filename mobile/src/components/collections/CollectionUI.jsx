import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../../ui/theme';
import { filterCollections } from '../../collections/useCollections';
import { makeStyles } from './CollectionUI.styles';

export function CollectionCard({ collection, onPress }) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  const content = (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{collection.title}</Text>

        <Text style={styles.muted}>
          {collection.questionCount} вопросов
          {' · '}

          {collection.isBuiltIn
            ? 'От Итопиз'
            : collection.isOwner
              ? 'Моя коллекция'
              : 'Добавлена по ключу'}

          {!collection.isBuiltIn && (
            <>
              {' · '}
              {collection.isPublic ? 'Публичная' : 'Личная'}
            </>
          )}
        </Text>
      </View>

      {onPress && <Text style={styles.chevron}>›</Text>}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Коллекция ${collection.title}`}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

export function CollectionFeedback({ loading, error, onRetry }) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  if (loading) {
    return (
      <View style={styles.feedback}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Загружаем коллекции…</Text>
      </View>
    );
  }

  if (!error) return null;

  return (
    <View style={styles.feedback}>
      <Text style={styles.error}>{error}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryText}>Повторить загрузку</Text>
      </Pressable>
    </View>
  );
}

export function CollectionBrowser({ collections, onSelect }) {
  const [search, setSearch] = useState('');
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const filtered = filterCollections(collections, search);

  return (
    <View style={styles.browser}>
      <TextInput
        accessibilityLabel="Поиск коллекций по названию"
        placeholder="Поиск по названию"
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={styles.search}
      />

      <FlatList
        style={styles.list}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        data={filtered}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <CollectionCard
            collection={item}
            onPress={onSelect ? () => onSelect(item) : undefined}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {search.trim()
              ? 'Коллекции с таким названием не найдены.'
              : 'Здесь пока нет коллекций.'}
          </Text>
        }
      />
    </View>
  );
}

export function CollectionDialog({
  mode,
  collection,
  collections,
  onClose,
  onSelect,
}) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [transition] = useState(() => new Animated.Value(0));
  const isPicker = mode === 'picker';
  const lastGame = collection?.lastGame;

  useEffect(() => {
    transition.setValue(0);
    const animation = Animated.timing(transition, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [mode, transition]);

  const actions = [
    lastGame
        ? 'Повторить с такими же настройками'
        : 'Играть с базовыми настройками',
    'Настроить игру',
    'Просмотреть вопросы',
    ];

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.overlay}>
          <Pressable
            accessible={false}
            onPress={onClose}
            style={styles.backdrop}
          />

          <View
            accessibilityViewIsModal
            style={[
              styles.dialog,
              isPicker && styles.pickerDialog,
            ]}
          >
            <Animated.View
              style={[
                styles.dialogInner,
                isPicker && styles.pickerDialogInner,
                {
                  opacity: transition,
                  transform: [
                    {
                      scale: transition.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.98, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.dialogHeader}>
                <Text accessibilityRole="header" style={styles.dialogTitle}>
                  {isPicker ? 'Выбери коллекцию' : collection?.title}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Закрыть окно"
                  onPress={onClose}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>

              {isPicker ? (
                <CollectionBrowser
                  collections={collections}
                  onSelect={onSelect}
                />
              ) : (
                <ScrollView
                  style={styles.details}
                  contentContainerStyle={styles.detailsContent}
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                >
                  <Text style={styles.muted}>
                    {collection?.questionCount} вопросов
                  </Text>

                  {lastGame && (
                    <View style={styles.results}>
                      <Text style={styles.resultsTitle}>Последняя игра</Text>

                      <View style={styles.resultRow}>
                        <Text style={styles.text}>Правильные ответы</Text>
                        <Text style={styles.correct}>
                          {lastGame.correctCount}
                        </Text>
                      </View>

                      <View style={styles.resultRow}>
                        <Text style={styles.text}>Ошибки</Text>
                        <Text style={styles.error}>
                          {lastGame.errorCount}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.dialogActions}>
                    {actions.map((label, index) => (
                      <Pressable
                        key={label}
                        disabled={index !== 2 || !collection}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: index !== 2 || !collection }}
                        onPress={() => {
                          onClose();

                          router.push({
                            pathname: '/collection/[id]',
                            params: {
                              id: collection.id,
                              source: 'play',
                            },
                          });
                        }}
                        style={[
                          styles.secondaryButton,
                          index === 0 && styles.primaryButton,
                        ]}
                      >
                        <Text
                          style={
                            index === 0
                              ? styles.primaryText
                              : styles.secondaryText
                          }
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              )}
            </Animated.View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
