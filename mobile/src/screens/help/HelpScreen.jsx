import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown, { FitImage, MarkdownIt } from 'react-native-markdown-display';
import { absoluteImagesPlugin, normalizeBase, resolveDocLink, underlinePlugin } from './docs-helpers.mjs';
import { useAppTheme } from '../../../ui/theme';

const DOCS_BASE = normalizeBase('https://katerinaxmelar2402-gif.github.io/itpz/');
const HOME = new URL('README.md', DOCS_BASE).href;

export default function HelpScreen() {
  const { colors, commonStyles } = useAppTheme();
  const [history, setHistory] = useState([HOME]);
  const [reload, setReload] = useState(0);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const scroll = useRef(null);
  const currentUrl = history[history.length - 1];

  useEffect(() => {
    if (history.length <= 1) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setHistory(items => items.slice(0, -1));
      return true;
    });
    return () => subscription.remove();
  }, [history.length]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    setLoading(true);
    setError('');
    setContent('');
    async function load() {
      try {
        const response = await fetch(currentUrl, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`Сервер вернул HTTP ${response.status}`);
        const text = await response.text();
        if (/^\s*<!doctype html|^\s*<html/i.test(text)) throw new Error('Получена HTML-страница вместо Markdown. Проверьте URL.');
        if (active) {
          setContent(text);
          scroll.current?.scrollTo({ y: 0, animated: false });
        }
      } catch (e) {
        if (active) setError(timedOut ? 'Время ожидания истекло. Проверьте подключение.' : `Не удалось загрузить справку. ${e.message}`);
      } finally {
        clearTimeout(timer);
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [currentUrl, reload]);

  const parser = useMemo(() => new MarkdownIt({ html: false, linkify: false })
    .use(underlinePlugin).use(absoluteImagesPlugin, currentUrl), [currentUrl]);

  const rules = useMemo(() => ({
    underline: node => <Text key={node.key} style={{ textDecorationLine: 'underline' }}>{node.content}</Text>,
    // Передаём key отдельно: встроенное правило библиотеки несовместимо с React 19.
    image: (node, children, parent, imageStyles) => (
      <FitImage
        key={node.key}
        indicator
        style={imageStyles._VIEW_SAFE_image}
        source={{ uri: node.attributes.src }}
        accessible
        accessibilityLabel={node.attributes.alt || 'Иллюстрация справки'}
      />
    ),
  }), []);

  function onLinkPress(href) {
    try {
      const next = resolveDocLink(href, currentUrl, DOCS_BASE);
      if (!next) {
        setError('Эта ссылка не является страницей справки.');
      } else if (next !== currentUrl) {
        setHistory(items => [...items, next]);
      }
    } catch {
      setError('Некорректная ссылка в справке.');
    }
    // Запрещаем стандартное открытие ссылок во внешнем браузере.
    return false;
  }

  return (
    <SafeAreaView style={commonStyles.screen}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <Button title="Назад" disabled={history.length < 2} onPress={() => setHistory(items => items.slice(0, -1))} />
        <Text style={[styles.title, { color: colors.text }]}>Справка</Text>
        <Button title="Главная" onPress={() => setHistory([HOME])} />
      </View>
      {loading ? <ActivityIndicator size="large" accessibilityLabel="Загрузка справки" style={styles.loader} /> : null}
      {error ? <View style={[styles.error, { backgroundColor: colors.surface }]}><Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text><Button title="Повторить" onPress={() => setReload(n => n + 1)} /></View> : null}
      <ScrollView ref={scroll} contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}>
        <Markdown markdownit={parser} rules={rules} onLinkPress={onLinkPress} style={{
                      ...markdownStyles,
                      body: { ...markdownStyles.body, color: colors.text },
                      link: { color: colors.primary },
                      fence: { ...markdownStyles.fence, backgroundColor: colors.surface },
                      code_inline: { backgroundColor: colors.surface, borderColor: colors.border },
                      code_block: { backgroundColor: colors.surface, borderColor: colors.border },
                      blockquote: { backgroundColor: colors.surface, borderColor: colors.border },
                    }}>
          {content}
        </Markdown>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderBottomWidth: 1, borderBottomColor: '#dce4ee' },
  title: { fontSize: 19, fontWeight: '600' },
  content: { padding: 18, paddingBottom: 40 },
  loader: { marginTop: 24 },
  error: { padding: 18, backgroundColor: '#fff4e5' },
});
const markdownStyles = {
  body: { fontSize: 16, lineHeight: 24, color: '#203349' },
  heading1: { fontSize: 27, marginBottom: 14 },
  heading2: { fontSize: 21, marginTop: 20, marginBottom: 10 },
  link: { color: '#2458a6' },
  fence: { fontSize: 13, backgroundColor: '#f0f4f8', padding: 10 },
};
