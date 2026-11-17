import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useAuth } from '../../auth/AuthProvider';
import { syncPendingBattles } from '../../game/history';
import MistakePicker from '../../game/MistakePicker';
import { useAppTheme } from '../../../ui/theme';
import { makeStyles } from './StatisticsScreen.styles';

function Action({ children, onPress, styles, secondary = false, disabled = false }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && styles.dimmed]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{children}</Text>
  </Pressable>;
}

function AccuracyChart({ history, colors, styles }) {
  const points = history.map((game, index) => ({
    x: history.length === 1 ? 170 : 38 + index * 282 / (history.length - 1),
    y: 142 - game.accuracy * 1.12,
  }));
  return <View style={styles.card}>
    <Text style={styles.heading}>Точность по последним играм</Text>
    {history.length ? <View accessible accessibilityLabel={history.map((game, index) =>
      `Игра ${index + 1}: ${game.accuracy}%`).join('. ')}>
      <Svg width="100%" height={190} viewBox="0 0 338 190">
        {[0, 50, 100].map(value => <ViewGrid key={value} value={value} colors={colors} />)}
        <Polyline points={points.map(point => `${point.x},${point.y}`).join(' ')}
          fill="none" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <Circle key={history[index].sessionId}
          cx={point.x} cy={point.y} r={4} fill={colors.primary} />)}
        {points.map((point, index) => <SvgText key={history[index].sessionId}
          x={point.x} y={168} fill={colors.muted} fontSize={10} textAnchor="middle">
          {new Date(history[index].date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
        </SvgText>)}
      </Svg>
    </View> : <Text style={styles.muted}>Заверши первый бой — здесь появится график твоей точности.</Text>}
  </View>;
}

function ViewGrid({ value, colors }) {
  const y = 142 - value * 1.12;
  return <>
    <Line x1={38} y1={y} x2={320} y2={y} stroke={colors.border} strokeDasharray="3 5" />
    <SvgText x={0} y={y + 4} fill={colors.muted} fontSize={10}>{value}%</SvgText>
  </>;
}

export default function StatisticsScreen({ byCollection = false }) {
  const { request, session } = useAuth();
  const userId = session?.user.id;
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    // Изменение attempt повторяет запрос по кнопке или жесту обновления.
    void attempt;
    if (!userId) return;
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      // Статистика учитывает ответы, сохранённые перед выходом из боя.
      await syncPendingBattles(userId, request);
      const next = await request('/games/statistics');
      if (active) setData(next);
    })().catch(reason => { if (active) setError(reason.message || 'Не удалось загрузить статистику.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, userId, attempt]));

  function startReview(selected) {
    const questions = review.filter(question => selected.includes(question.sessionQuestionId));
    const ids = [...new Set(questions.map(question => question.collectionId))];
    const id = ids.length === 1 && /^[1-9]\d*$/.test(ids[0]) ? ids[0] : 'all';
    setReview(null);
    router.push({ pathname: '/battle/[id]', params: {
      id, statisticsQuestions: JSON.stringify(selected), fromStatistics: 'true',
    } });
  }

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={
      <RefreshControl refreshing={loading && !!data} onRefresh={() => setAttempt(value => value + 1)} tintColor={colors.primary} />
    }>
      {byCollection && <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={styles.secondaryText}>← Назад</Text>
      </Pressable>}
      <View>
        <Text accessibilityRole="header" style={styles.title}>{byCollection ? 'По коллекциям' : 'Твоя статистика'}</Text>
        <Text style={styles.subtitle}>{byCollection
          ? 'Последнее прохождение с учётом исправленных ошибок.' : 'Каждая тренировка помогает расти.'}</Text>
      </View>
      {loading && !data && <ActivityIndicator style={styles.loading} color={colors.primary} />}
      {!!error && <View style={styles.card}>
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Action styles={styles} onPress={() => setAttempt(value => value + 1)}>Повторить загрузку</Action>
      </View>}
      {data && (byCollection ? <>
        {data.collections.length === 0 && <View style={styles.card}>
          <Text style={styles.heading}>Пока нет результатов</Text>
          <Text style={styles.muted}>Пройди любую коллекцию, чтобы увидеть её статистику.</Text>
        </View>}
        {data.collections.map(collection => <View style={styles.card} key={collection.id}>
          <View style={styles.row}>
            <Text style={styles.collectionTitle}>{collection.title}</Text>
            <Text style={styles.accuracy}>{collection.accuracy}%</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: collection.accuracy }} style={styles.track}>
            <View style={[styles.fill, { width: `${collection.accuracy}%` }]} />
          </View>
          <Text style={styles.muted}>Вопросов: {collection.total} · Правильно: {collection.correct} · Ошибок: {collection.wrong}</Text>
          {collection.wrong > 0 ? <Action styles={styles} disabled={loading || !!error} onPress={() => setReview(collection.mistakes)}>
            Работа над ошибками
          </Action> : <Text style={styles.accuracy}>Все ответы верные ✓</Text>}
        </View>)}
      </> : <>
        <View style={styles.metrics}>
          {[
            [data.played, 'Пройдено коллекций'],
            [`${data.accuracy}%`, 'Общая точность'],
            [data.wrong, 'Неправильных ответов'],
          ].map(([value, label]) => (
            <View key={label} style={styles.metric}>
              <Text style={styles.value}>{value}</Text>
              <Text style={styles.label}>{label}</Text>
            </View>
          ))}
        </View>
        <AccuracyChart history={data.history} colors={colors} styles={styles} />
        <View style={{ gap: 12 }}>
          <Action styles={styles} disabled={data.mistakes.length === 0 || loading || !!error}
            onPress={() => setReview(data.mistakes)}>Работа над ошибками</Action>

          <Action styles={styles} secondary onPress={() => router.push('/statistics-collections')}>Статистика по коллекциям →</Action>
        </View>
        
      </>)}
    </ScrollView>
    {review && <MistakePicker questions={review} busy={false} error="" onClose={() => setReview(null)}
      onStart={startReview} backLabel="Назад к статистике" />}
  </SafeAreaView>;
}
