import { useRef, useState } from 'react';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../../ui/theme';
import { useAuth } from '../../auth/AuthProvider';
import { makeStyles } from './ConnectSetScreen.styles';

export default function ConnectSetScreen() {
  const [accessKey, setAccessKey] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const pending = useRef(false);
  const { request } = useAuth();
  const { colors, commonStyles, dark } = useAppTheme();
  const styles = makeStyles(colors, dark);

  function changeKey(value) {
    setAccessKey(value);
    setPreview(null);
    setError('');
  }

  async function pasteKey() {
    if (pending.current) return;
    pending.current = true;
    setBusy('paste');
    setError('');
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) {
        setError('В буфере пока нет текста. Скопируй ключ или введи его вручную.');
        return;
      }
      changeKey(text.trim());
    } catch {
      setError('Не удалось прочитать буфер обмена. Вставь ключ в поле вручную.');
    } finally {
      pending.current = false;
      setBusy('');
    }
  }

  async function findSet() {
    if (pending.current || !accessKey.trim()) return;
    pending.current = true;
    setBusy('lookup');
    setError('');
    setPreview(null);
    const key = accessKey.trim().toLowerCase();
    try {
      const data = await request('/collections/lookup', {
        method: 'POST', body: { accessKey: key },
      });
      if (!data?.collection?.id) throw new Error('Сервер вернул некорректный ответ.');
      setPreview({ ...data.collection, accessKey: key });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось найти набор.');
    } finally {
      pending.current = false;
      setBusy('');
    }
  }

  async function connectSet() {
    if (pending.current || !preview) return;
    pending.current = true;
    setBusy('connect');
    setError('');
    try {
      const data = await request('/collections/connect', {
        method: 'POST', body: { accessKey: preview.accessKey },
      });
      if (!data?.collection?.id) throw new Error('Сервер вернул некорректный ответ.');
      router.replace({ pathname: '/collection/[id]', params: { id: data.collection.id } });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось добавить набор.');
    } finally {
      pending.current = false;
      setBusy('');
    }
  }

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={commonStyles.screen}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <Text accessibilityRole="header" style={styles.title}>
            Подключить набор
          </Text>

          <Text style={styles.subtitle}>
            Введи ключ, которым с тобой поделились.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Вставить ключ из буфера обмена"
            accessibilityState={{ disabled: !!busy, busy: busy === 'paste' }}
            disabled={!!busy}
            onPress={pasteKey}
            style={({ pressed }) => [styles.illustration, pressed && styles.pressed]}
          >
            {busy === 'paste'
              ? <ActivityIndicator color={colors.accent} />
              : <Text style={styles.plus}>+</Text>}
          </Pressable>
          <Text style={styles.pasteHint}>Нажми на плюс, чтобы вставить ключ</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Ключ доступа</Text>

            <TextInput
              accessibilityLabel="Ключ доступа"
              value={accessKey}
              onChangeText={changeKey}
              editable={!busy}
              placeholder="Вставь публичный ключ"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="search"
              onSubmitEditing={findSet}
              style={styles.input}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !!busy || !accessKey.trim(), busy: busy === 'lookup' }}
              disabled={!!busy || !accessKey.trim()}
              onPress={findSet}
              style={({ pressed }) => [styles.findButton,
                (!!busy || !accessKey.trim()) && styles.disabled,
                pressed && styles.pressed]}
            >
              <Text style={styles.findButtonText}>
                {busy === 'lookup' ? 'Ищем набор…' : 'Найти набор'}
              </Text>
            </Pressable>
          </View>

          {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}

          {preview && (
            <View style={styles.preview} accessibilityLiveRegion="polite">
              <Text style={styles.label}>НАБОР НАЙДЕН</Text>
              <Text accessibilityRole="header" style={styles.previewTitle}>{preview.title}</Text>
              <Text style={styles.previewMeta}>Автор: {preview.author}</Text>
              <Text style={styles.previewMeta}>Вопросов: {preview.questionCount}</Text>
              {!!preview.description && <Text style={styles.previewMeta}>{preview.description}</Text>}
              {preview.alreadyAdded && <Text style={styles.previewMeta}>Этот набор уже есть в твоих коллекциях.</Text>}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !!busy, busy: busy === 'connect' }}
                disabled={!!busy}
                onPress={connectSet}
                style={({ pressed }) => [styles.findButton, !!busy && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.findButtonText}>
                  {busy === 'connect' ? 'Подключаем…' : preview.alreadyAdded ? 'Открыть набор' : 'Добавить в коллекции'}
                </Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.hint}>
            {preview ? 'После подключения набор появится в твоих коллекциях.'
              : 'Перед добавлением покажем название, автора и количество вопросов.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
