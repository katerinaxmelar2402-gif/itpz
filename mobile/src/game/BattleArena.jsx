import { useEffect, useState } from 'react';

import {
  Animated,
  Easing,
  Text,
  View,
} from 'react-native';

import Svg, {
  Circle,
  Polygon,
  Polyline,
  Rect,
} from 'react-native-svg';

import { FEEDBACK_MS } from './battleState';
import {
  BATTLE_COLORS,
  makeStyles,
  healthWidth,
  fighterMotion,
  stickMotion,
  impactMotion,
} from './BattleArena.styles';

function Character({ fox }) {
  const body = fox ? '#F3A28E' : '#F4D57C';

  return (
    <Svg width={84} height={104} viewBox="0 0 84 104">
      <Rect
        x="8" y="94" width="68" height="8"
        rx="4" fill="#D9D6C8"
      />

      {fox && (
        <>
          <Polyline
            points="18,38 16,16 34,31"
            fill="none"
            stroke={body}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points="50,31 68,16 66,38"
            fill="none"
            stroke={body}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      <Rect
        x="11" y="29" width="62" height="62"
        rx="22" fill={body}
      />

      {!fox && (
        <>
          <Rect
            x="10" y="36" width="64" height="12"
            rx="5" fill="#7252BB"
          />
          <Rect
            x="63" y="39" width="20" height="7"
            rx="3" fill="#7252BB"
          />
        </>
      )}

      <Circle cx="32" cy="58" r="3" fill="#302C36" />
      <Circle cx="52" cy="58" r="3" fill="#302C36" />

      <Polyline
        points="35,70 42,74 49,70"
        fill="none"
        stroke="#302C36"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Polyline
        points="23,88 23,99"
        stroke="#302C36"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Polyline
        points="61,88 61,99"
        stroke="#302C36"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function Health({ label, value, maximum, fox = false, styles }) {
  return (
    <View style={styles.health}>
      <View style={styles.healthHeader}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hp}>{value}</Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            fox ? styles.foxFill : styles.playerFill,
            healthWidth(value, maximum),
          ]}
        />
      </View>
    </View>
  );
}

export default function BattleArena({ battle, maximum, colors, dark }) {
  const styles = makeStyles(colors, dark);
  const [width, setWidth] = useState(358);
  const [animation] = useState(() => new Animated.Value(0));

  const feedback = battle.phase === 'feedback';
  const playerAttacks = battle.outcome === 'correct';

  useEffect(() => {
    animation.setValue(0);

    if (!feedback) return;

    const sequence = Animated.timing(animation, {
      toValue: 1,
      duration: FEEDBACK_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    sequence.start();
    return () => sequence.stop();
  }, [animation, feedback, battle.index]);

  const distance = Math.max(0, width - 266);

  const lunge = animation.interpolate({
    inputRange: [0, 0.22, 0.38, 0.7, 1],
    outputRange: [0, distance, distance, distance, 0],
  });

  const reverseLunge = Animated.multiply(lunge, -1);

  const shake = animation.interpolate({
    inputRange: [0, 0.22, 0.27, 0.32, 0.37, 0.42, 1],
    outputRange: [0, 0, 5, -5, 4, 0, 0],
  });

  const starOpacity = animation.interpolate({
    inputRange: [0, 0.2, 0.23, 0.65, 0.85, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  });

  const starScale = animation.interpolate({
    inputRange: [0, 0.2, 0.3, 0.7, 1],
    outputRange: [0.3, 0.3, 1.3, 1, 0.5],
  });

  const stickRotation = animation.interpolate({
    inputRange: [0, 0.22, 0.55, 1],
    outputRange: ['-40deg', '0deg', '0deg', '-25deg'],
  });

  const circumference = 2 * Math.PI * 27;
  const timerColor = battle.seconds <= 5 ? colors.error : BATTLE_COLORS.timer;

  const status = battle.phase === 'paused'
    ? 'ПАУЗА'
    : feedback
      ? battle.outcome === 'correct'
        ? 'ВЕРНО!'
        : battle.outcome === 'timeout'
          ? 'ВРЕМЯ ВЫШЛО'
          : 'НЕВЕРНЫЙ ОТВЕТ'
      : battle.phase === 'finished'
        ? 'БОЙ ЗАВЕРШЁН'
        : 'ТВОЙ ХОД';

  return (
    <View
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      style={styles.arena}
    >
      <View style={styles.healthRow}>
        <Health
          label="ТЫ"
          value={battle.playerHp}
          maximum={maximum}
          styles={styles}
        />

        <View style={styles.healthSpacer} />

        <Health
          label="ЛИСА"
          value={battle.foxHp}
          maximum={maximum}
          fox
          styles={styles}
        />
      </View>

      <View style={styles.timer}>
        <Svg width={64} height={64} viewBox="0 0 64 64">
          <Circle
            cx="32" cy="32" r="27"
            fill="none"
            stroke={colors.border}
            strokeWidth="4"
          />

          <Circle
            cx="32" cy="32" r="27"
            fill="none"
            stroke={timerColor}
            strokeWidth="4"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={
              circumference * (1 - Math.min(1, battle.progress))
            }
            rotation="-90"
            origin="32, 32"
            strokeLinecap="round"
          />
        </Svg>

        <Text style={styles.timerText}>
          {battle.seconds}
        </Text>
      </View>

      <View style={styles.aura} />

      {[false, true].map(fox => {
        const attacking = fox ? !playerAttacks : playerAttacks;

        return (
          <Animated.View
            key={String(fox)}
            style={[
              styles.fighter,
              fox ? styles.fox : styles.player,
              fighterMotion({
                fox,
                feedback,
                attacking,
                lunge,
                reverseLunge,
                shake,
              }),
            ]}
          >
            <View style={fox && styles.foxFacing}>
              <Character fox={fox} />

              {feedback && attacking && (
                <Animated.View
                  style={[
                    styles.stick,
                    stickMotion(stickRotation),
                  ]}
                />
              )}
            </View>
          </Animated.View>
        );
      })}

      {feedback && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.star,
            playerAttacks ? styles.starOnFox : styles.starOnPlayer,
            impactMotion(starOpacity, starScale),
          ]}
        >
          <Svg width={40} height={40} viewBox="0 0 40 40">
            <Polygon
              points="20,0 25,13 40,20 25,25 20,40 15,25 0,20 15,13"
              fill="#F4D57C"
              stroke={BATTLE_COLORS.timer}
              strokeWidth="2"
            />
          </Svg>
        </Animated.View>
      )}

      <Text
        accessibilityLiveRegion="polite"
        style={[
          styles.status,
          battle.seconds <= 5 && styles.danger,
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

