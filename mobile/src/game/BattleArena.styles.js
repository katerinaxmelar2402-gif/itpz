import { StyleSheet } from 'react-native';

export const BATTLE_COLORS = {
  timer: '#BE8648',
  playerHealth: '#93B995',
  foxHealth: '#DB9B87',
};

export const makeStyles = (colors, dark) => StyleSheet.create({
  arena: {
    height: 255,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: dark ? colors.surface : '#EAE4D8',
  },
  healthRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  health: {
    flex: 1,
  },
  healthSpacer: {
    width: 72,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  hp: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  track: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  playerFill: {
    backgroundColor: BATTLE_COLORS.playerHealth,
  },
  foxFill: {
    backgroundColor: BATTLE_COLORS.foxHealth,
  },
  timer: {
    position: 'absolute',
    top: 30,
    left: '50%',
    marginLeft: -32,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    position: 'absolute',
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  aura: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    marginLeft: -57,
    width: 114,
    height: 114,
    borderRadius: 57,
    backgroundColor: colors.consentBackground,
  },
  fighter: {
    position: 'absolute',
    bottom: 36,
    width: 84,
    height: 104,
  },
  player: {
    left: 24,
  },
  fox: {
    right: 24,
  },
  foxFacing: {
    transform: [{ scaleX: -1 }],
  },
  stick: {
    position: 'absolute',
    left: 58,
    top: 55,
    width: 90,
    height: 5,
    borderRadius: 3,
    backgroundColor: BATTLE_COLORS.timer,
  },
  star: {
    position: 'absolute',
    bottom: 82,
    width: 40,
    height: 40,
  },
  starOnFox: {
    right: 78,
  },
  starOnPlayer: {
    left: 76,
  },
  status: {
    position: 'absolute',
    bottom: 13,
    alignSelf: 'center',
    color: BATTLE_COLORS.timer,
    fontSize: 11,
    fontWeight: '700',
  },
  danger: {
    color: colors.error,
  },
});

// Динамические стили также описаны здесь,
// а JSX передаёт только значения.
export function healthWidth(value, maximum) {
  const fraction = maximum > 0 ? value / maximum : 0;

  return {
    width: `${Math.max(0, Math.min(1, fraction)) * 100}%`,
  };
}

export function fighterMotion({
  fox,
  feedback,
  attacking,
  lunge,
  reverseLunge,
  shake,
}) {
  const translateX = !feedback
    ? 0
    : attacking
      ? fox ? reverseLunge : lunge
      : shake;

  return {
    transform: [{ translateX }],
  };
}

export function stickMotion(rotation) {
  return {
    transform: [{ rotate: rotation }],
  };
}

export function impactMotion(opacity, scale) {
  return {
    opacity,
    transform: [{ scale }],
  };
}