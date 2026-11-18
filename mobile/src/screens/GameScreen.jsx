import { useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import Slider from '@react-native-community/slider';
import { BlurTargetView, BlurView } from 'expo-blur';
import { makeStyles } from './GameScreen.styles';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../ui/theme';
import { useAuth } from '../auth/AuthProvider';

import {
  DEFAULT_GAME,
  GAME_LIMITS,
  useSettings,
} from '../settings/SettingsProvider';

import BattleArena from '../game/BattleArena';
import { useBattle } from '../game/useBattle';
import MistakePicker from '../game/MistakePicker';
import { useBattleAudio } from '../settings/audio';

function normalize(value, fallback, limits) {
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.max(limits.min, Math.min(limits.max, Math.round(number)))
    : fallback;
}

function readSettings(params, profile) {
  return {
    answerSeconds: normalize(
      params.seconds ?? profile.answerSeconds,
      DEFAULT_GAME.answerSeconds,
      GAME_LIMITS.answerSeconds,
    ),
    lives: normalize(
      params.lives ?? profile.lives,
      DEFAULT_GAME.lives,
      { ...GAME_LIMITS.lives, min: 1 },
    ),
    questionOrder: (params.order ?? profile.questionOrder) === 'random' ? 'random' : 'ordered',
  };
}

function Action({ children, onPress, disabled = false, secondary = false, styles }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (disabled || pressed) && styles.dimmed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryButtonText,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

function Preparation({ collection, defaults }) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  // Локальная копия. Настройки профиля здесь не сохраняются.
  const maxLives = Math.min(GAME_LIMITS.lives.max, collection.questions.length);
  const minLives = Math.min(GAME_LIMITS.lives.min, maxLives);
  const [settings, setSettings] = useState(() => ({
    ...defaults, lives: Math.min(defaults.lives, maxLives),
  }));

  function start() {
    router.replace({
      pathname: '/battle/[id]',
      params: {
        id: collection.id,
        seconds: String(settings.answerSeconds),
        lives: String(settings.lives),
        order: settings.questionOrder,
      },
    });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
        >
          <Text style={styles.link}>← Назад</Text>
        </Pressable>

        <Text accessibilityRole="header" style={styles.title}>
          Подготовка к бою
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{collection.title}</Text>

          <Text style={styles.muted}>
            Вопросов: {collection.questions.length}
          </Text>
        </View>

        <Text style={styles.cardTitle}>Настройки боя</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.text}>Жизни участников</Text>
            <Text style={styles.cardTitle}>{settings.lives}</Text>
          </View>

          <Slider
            accessibilityLabel="Количество жизней участников"
            minimumValue={minLives}
            maximumValue={maxLives}
            disabled={minLives === maxLives}
            step={1}
            value={settings.lives}
            onValueChange={lives =>
              setSettings(previous => ({ ...previous, lives }))
            }
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />

          <Text style={styles.muted}>Максимум жизней для этого боя: {maxLives}.</Text>

          <View style={[styles.row, styles.timeSetting]}>
            <Text style={styles.text}>Время на ответ</Text>

            <Text style={styles.cardTitle}>
              {settings.answerSeconds} сек
            </Text>
          </View>

          <Slider
            accessibilityLabel="Время на ответ в секундах"
            minimumValue={GAME_LIMITS.answerSeconds.min}
            maximumValue={GAME_LIMITS.answerSeconds.max}
            step={1}
            value={settings.answerSeconds}
            onValueChange={answerSeconds =>
              setSettings(previous => ({ ...previous, answerSeconds }))
            }
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />

          <Text style={styles.cardTitle}>Порядок вопросов</Text>
          <View accessibilityRole="radiogroup" style={styles.orderOptions}>
            {[
              { value: 'ordered', label: 'По порядку' },
              { value: 'random', label: 'Вразнобой' },
            ].map(option => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: settings.questionOrder === option.value }}
                onPress={() => setSettings(previous => ({ ...previous, questionOrder: option.value }))}
                style={[
                  styles.orderOption,
                  settings.questionOrder === option.value && styles.orderSelected,
                ]}
              >
                <Text style={styles.text}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.muted}>
          Эти параметры действуют только для этого боя. Базовые настройки можно изменить в «Профиле».
        </Text>

        <Action
          styles={styles}
          secondary
          onPress={() => setSettings({ ...defaults, lives: Math.min(defaults.lives, maxLives) })}
        >
          Вернуть базовые настройки
        </Action>

        <Action styles={styles} onPress={start}>
          Начать бой →
        </Action>
      </ScrollView>
    </SafeAreaView>
  );
}

function Battle({ collection, settings }) {
  const { session } = useAuth();
  const { colors, dark } = useAppTheme();
  const styles = makeStyles(colors, dark);

  const [leaving, setLeaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const blurTarget = useRef(null);

  const battle = useBattle({
    userId: session.user.id,
    collection,
    settings,
  });
  useBattleAudio(battle);

  const finished = battle.phase === 'finished';
  const feedback = battle.phase === 'feedback';
  const paused = battle.phase === 'paused';
  const { pause, resume } = battle;
  const mistakes = new Set(battle.record.answers
    .filter(answer => answer.outcome !== 'correct')
    .map(answer => answer.sessionQuestionId));
  const mistakeQuestions = collection.questions.filter(question =>
    mistakes.has(question.sessionQuestionId)
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // Во время короткого удара не прерываем переход.
        if (paused) resume();
        else if (!finished) pause();
        return true;
      },
    );

    return () => subscription.remove();
  }, [pause, resume, paused, finished]);

  async function startReview(selected) {
    if (leaving) return;
    setLeaving(true);
    try {
      await battle.saveAndExit();
      router.replace({
        pathname: '/battle/[id]',
        params: {
          id: collection.id,
          reviewSessionId: battle.record.serverSessionId,
          reviewQuestions: JSON.stringify(selected),
          ...(collection.fromStatistics ? { fromStatistics: 'true' } : {}),
        },
      });
    } catch {
      setLeaving(false);
    }
  }

  async function exit(repeat = false) {
    if (leaving) return;

    setLeaving(true);

    try {
      await battle.saveAndExit();
      if (collection.fromStatistics) {
        router.replace(repeat === true ? {
          pathname: '/battle/[id]',
          params: { id: collection.id, repeatSessionId: battle.record.serverSessionId, fromStatistics: 'true' },
        } : '/statistics');
        return;
      }
      router.replace(repeat === true && battle.record.status === 'completed'
        ? {
            pathname: '/home',
            params: { repeatSessionId: battle.record.serverSessionId },
          }
        : '/home');
    } catch {
      // Сообщение выводится через battle.saveError.
      setLeaving(false);
    }
  }

  const resultText = battle.record.status === 'abandoned'
    ? 'Бой прерван'
    : battle.record.result === 'win'
      ? 'Победа!'
      : battle.record.result === 'loss'
        ? 'Поражение'
        : 'Ничья';

  return (
    <SafeAreaView style={styles.screen}>
      <BlurTargetView
        ref={blurTarget}
        style={styles.battleTarget}
        pointerEvents={paused ? 'none' : 'auto'}
        accessibilityElementsHidden={paused}
        importantForAccessibility={paused ? 'no-hide-descendants' : 'auto'}
      >
        <ScrollView
          contentContainerStyle={styles.battleContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text numberOfLines={2} style={styles.headerTitle}>
              {collection.title}
            </Text>

            {!finished && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Пауза"
                disabled={feedback}
                onPress={battle.pause}
                style={[
                  styles.pauseButton,
                  feedback && styles.pauseDisabled,
                ]}
              >
                <Text style={styles.cardTitle}>Ⅱ</Text>
              </Pressable>
            )}
          </View>

          <BattleArena
            battle={battle}
            maximum={settings.lives}
            colors={colors}
            dark={dark}
          />

          {finished ? (
            <View style={styles.result}>
              <Text accessibilityRole="header" style={styles.title}>
                {resultText}
              </Text>

              <Text style={styles.text}>
                Твои жизни: {battle.record.playerHp}
                {' · '}
                Жизни лисы: {battle.record.foxHp}
              </Text>

              {battle.record.status === 'completed' && (
                <Action
                  styles={styles}
                  secondary
                  disabled={leaving || mistakeQuestions.length === 0}
                  onPress={() => setReviewOpen(true)}
                >
                  Работа над ошибками
                </Action>
              )}
              {battle.record.status === 'completed' && mistakeQuestions.length === 0 && (
                <Text style={styles.muted}>В этом бою ошибок не было.</Text>
              )}

              {battle.record.status === 'completed' && (
                <Action
                  styles={styles}
                  disabled={leaving}
                  onPress={() => exit(true)}
                >
                  Ещё раз
                </Action>
              )}

              <Action
                styles={styles}
                disabled={leaving}
                onPress={exit}
              >
                {leaving ? 'Сохраняем…' : collection.fromStatistics ? 'К статистике' : 'На главную'}
              </Action>
            </View>
          ) : (
            <View
              key={battle.index}
              style={styles.questionBlock}
            >
              <Text style={styles.questionLabel}>
                ВОПРОС {battle.index + 1}
                {' · '}
                КРУГ {battle.round}
              </Text>

              <Text accessibilityRole="header" style={styles.question}>
                {battle.question.text}
              </Text>

              <View style={styles.answers}>
                {battle.question.answers.map((answer, index) => {
                  const correct = (
                    feedback
                    && index === battle.question.correctIndex
                  );

                  const wrong = (
                    feedback
                    && index === battle.selectedIndex
                    && !correct
                  );

                  return (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      accessibilityLabel={
                        `${String.fromCharCode(65 + index)}. ${answer}`
                        + (correct ? '. Правильный ответ' : '')
                        + (wrong ? '. Неправильный ответ' : '')
                      }
                      accessibilityState={{
                        disabled: battle.phase !== 'asking',
                        selected: feedback && index === battle.selectedIndex,
                      }}
                      disabled={battle.phase !== 'asking'}
                      onPress={() => battle.answer(index, battle.index)}
                      style={({ pressed }) => [
                        styles.answer,
                        styles.answerDefault,
                        correct && styles.answerCorrect,
                        wrong && styles.answerWrong,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.answerLetter,
                          styles.letterDefault,
                          correct && styles.letterCorrect,
                          wrong && styles.letterWrong,
                        ]}
                      >
                        <Text style={styles.letterText}>
                          {String.fromCharCode(65 + index)}
                        </Text>
                      </View>

                      <Text style={styles.answerText}>{answer}</Text>

                      {correct && (
                        <Text style={styles.answerMark}>✓</Text>
                      )}

                      {wrong && (
                        <Text style={styles.answerMark}>×</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {!!battle.saveError && (
            <View style={styles.card}>
              <Text
                accessibilityLiveRegion="polite"
                style={styles.error}
              >
                {battle.saveError}
              </Text>

              <Action
                styles={styles}
                secondary
                onPress={() => {
                  battle.retrySave().catch(() => {});
                }}
              >
                Повторить сохранение
              </Action>
            </View>
          )}
        </ScrollView>
      </BlurTargetView>

      {paused && (
        <View accessibilityViewIsModal style={styles.pauseLayer}>
          <BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurView"
            intensity={75}
            tint={dark ? 'dark' : 'light'}
            style={styles.pauseBlur}
          />
          <View
            accessibilityViewIsModal
            style={styles.dialog}
          >
            <Text accessibilityRole="header" style={styles.title}>
              Пауза
            </Text>

            <Text style={styles.muted}>
              Время остановлено.
            </Text>

            <Action styles={styles} onPress={battle.resume}>
              Продолжить
            </Action>

            <Action
              styles={styles}
              secondary
              disabled={leaving}
              onPress={exit}
            >
              Завершить и выйти
            </Action>
          </View>
        </View>
      )}
      {reviewOpen && (
        <MistakePicker
          questions={mistakeQuestions}
          busy={leaving}
          error={battle.saveError}
          onClose={() => setReviewOpen(false)}
          onStart={startReview}
        />
      )}
    </SafeAreaView>
  );
}

export default function GameScreen({ mode }) {
  const params = useLocalSearchParams();
  const { session } = useAuth();

  if (!session) return null;

  return (
    <GameLoader
      key={[
        session.user.id, mode, params.id, params.repeatSessionId,
        params.seconds, params.lives,
        params.order, params.reviewSessionId, params.reviewQuestions, params.statisticsQuestions, params.fromStatistics,
      ].join(':')}
      mode={mode}
      params={params}
    />
  );
}

function GameLoader({ mode, params }) {
  const id = typeof params.id === 'string' ? params.id : '';

  const { request } = useAuth();
  const { game } = useSettings();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  const [collection, setCollection] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [startKey] = useState(() =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
  );
  const [initialSettings] = useState(() => readSettings(params, game));
  const repeatSessionId = typeof params.repeatSessionId === 'string'
    ? params.repeatSessionId : null;
  const reviewSessionId = typeof params.reviewSessionId === 'string'
    ? params.reviewSessionId : null;
  const reviewQuestions = typeof params.reviewQuestions === 'string'
    ? params.reviewQuestions : '[]';
  const statisticsQuestions = typeof params.statisticsQuestions === 'string'
    ? params.statisticsQuestions : null;

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        if (!id) throw new Error('Не выбрана коллекция.');

        const data = mode === 'setup'
          ? await request(`/collections/${encodeURIComponent(id)}`)
          : await request('/games', {
              method: 'POST',
              body: {
                clientKey: startKey,
                collectionId: id,
                lives: initialSettings.lives,
                answerSeconds: initialSettings.answerSeconds,
                questionOrder: initialSettings.questionOrder,
                ...(repeatSessionId ? { repeatSessionId } : {}),
                ...(reviewSessionId ? {
                  reviewSessionId,
                  reviewQuestionIds: JSON.parse(reviewQuestions),
                } : {}),
                ...(statisticsQuestions ? { statisticsQuestionIds: JSON.parse(statisticsQuestions) } : {}),
              },
            });

        const loaded = data?.collection;

        if (
          !loaded
          || (id !== 'all' && String(loaded.id) !== id)
          || !Array.isArray(loaded.questions)
          || loaded.questions.length === 0
        ) {
          throw new Error('В коллекции нет вопросов для игры.');
        }

        for (const question of loaded.questions) {
          if (
            typeof question.text !== 'string'
            || !Array.isArray(question.answers)
            || question.answers.length < 2
            || !question.answers.every(answer =>
              typeof answer === 'string' && answer.trim()
            )
            || !Number.isInteger(question.correctIndex)
            || question.correctIndex < 0
            || question.correctIndex >= question.answers.length
          ) {
            throw new Error('Коллекция содержит некорректный вопрос.');
          }
        }

        if (mode !== 'setup' && (
          !/^[1-9]\d*$/.test(String(data.sessionId))
          || data.status !== 'active'
          || !Number.isInteger(data.settings?.lives)
          || !Number.isInteger(data.settings?.answerSeconds)
          || loaded.questions.some(question => !question.sessionQuestionId)
        )) {
          throw new Error('Сервер вернул некорректное состояние боя.');
        }

        if (active) {
          setCollection(mode === 'setup' ? loaded : {
            ...loaded,
            gameSessionId: data.sessionId,
            startedAt: data.startedAt,
            battleSettings: data.settings,
            fromStatistics: params.fromStatistics === 'true',
          });
        }
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Не удалось загрузить игру.',
          );
        }
      }
    }

    load();

    return () => { active = false; };
  }, [id, mode, request, attempt, startKey, initialSettings, repeatSessionId,
    reviewSessionId, reviewQuestions, statisticsQuestions, params.fromStatistics]);

  if (!collection || (id !== 'all' && String(collection.id) !== id)) {
    return (
      <SafeAreaView style={[styles.screen, styles.loading]}>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>

            <Action
              styles={styles}
              onPress={() => {
                setError('');
                setAttempt(value => value + 1);
              }}
            >
              Повторить
            </Action>

            <Action
              styles={styles}
              secondary
              onPress={() => router.replace('/home')}
            >
              На главную
            </Action>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  return mode === 'setup'
    ? (
      <Preparation
        key={`setup-${id}`}
        collection={collection}
        defaults={readSettings({}, game)}
      />
    )
    : (
      <Battle
        key={`battle-${id}`}
        collection={collection}
        settings={collection.battleSettings}
      />
    );
}
