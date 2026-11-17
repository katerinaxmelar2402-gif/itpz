import { useCallback, useEffect, useRef } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { useSettings } from './SettingsProvider';
import { useAppAudio } from './AudioProvider';
import { HIT_MS } from '../game/battleState';

export function useBattleAudio(battle) {
  const { app } = useSettings();
  const { ready, foreground, setBattlePhase } = useAppAudio();
  const hit = useAudioPlayer(require('../../assets/battle-hit.wav'), {
    downloadFirst: true,
    keepAudioSessionActive: true,
  });
  const { isLoaded } = useAudioPlayerStatus(hit);
  const lastHit = useRef(null);
  const sessionId = battle.record.serverSessionId;

  useEffect(() => {
    setBattlePhase(battle.phase);
  }, [battle.phase, setBattlePhase]);

  useEffect(() => () => setBattlePhase(null), [sessionId, setBattlePhase]);

  useEffect(() => {
    /* eslint-disable react-hooks/immutability -- expo-audio exposes native player settings as writable properties. */
    hit.volume = 1;
    hit.muted = !app.sound;
    /* eslint-enable react-hooks/immutability */
    if (!app.sound || !foreground || battle.phase === 'paused') hit.pause();
  }, [hit, app.sound, foreground, battle.phase]);

  useEffect(() => {
    const key = `${sessionId}:${battle.index}`;
    if (!ready || !isLoaded || !app.sound || !foreground
      || battle.phase !== 'feedback' || lastHit.current === key) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || lastHit.current === key) return;
      lastHit.current = key;
      try {
        await hit.seekTo(0);
        if (!cancelled) hit.play();
      } catch (reason) {
        console.warn('Не удалось воспроизвести удар:', reason);
      }
    }, Math.max(0, battle.feedbackAt + HIT_MS - Date.now()));

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hit, ready, isLoaded, app.sound, foreground, sessionId,
    battle.index, battle.phase, battle.feedbackAt]);
}

export function useSoundEffect() {
  const { app } = useSettings();
  const { ready, foreground } = useAppAudio();
  const player = useAudioPlayer(require('../../assets/app-click.mp3'), {
    downloadFirst: true,
    keepAudioSessionActive: true,
  });

  return useCallback(async () => {
    if (!ready || !foreground || !app.sound || !player.isLoaded) return;
    try {
      await player.seekTo(0);
      player.play();
    } catch (reason) {
      console.warn('Не удалось воспроизвести нажатие:', reason);
    }
  }, [ready, foreground, app.sound, player]);
}
