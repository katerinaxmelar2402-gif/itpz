import { StyleSheet } from 'react-native';
import { spacing } from '../../ui/theme';

const circleSize = 60;

export const makeStyles = colors => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
  },
  barBackground: {
    position: 'absolute',
    top: 22,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  iconSlot: {
    height: circleSize,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  icon: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIcon: {
    width: circleSize,
    height: circleSize,
    borderRadius: circleSize / 2,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.background,
  },
  artwork: {
    width: 24,
    height: 24,
  },
  character: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeArtwork: {
    transform: [{ scale: 1.25 }],
  },
  characterBody: {
    position: 'absolute',
    top: 1,
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  eye: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
  },
  legs: {
    position: 'absolute',
    top: 18,
    flexDirection: 'row',
    gap: 6,
  },
  leg: {
    width: 2,
    height: 5,
    borderRadius: 1,
  },
  label: {
    color: colors.text,
    fontSize: 11,
    textAlign: 'center',
  },
  activeLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
});
