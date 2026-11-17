import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { useSettings } from './SettingsProvider';

const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const { app, loading } = useSettings();
  const music = useAudioPlayer(require('../../assets/app-music.mp3'), {
    downloadFirst: true,
    updateInterval: 1000,
  });
  const { isLoaded } = useAudioPlayerStatus(music);
  const [ready, setReady] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [battlePhase, setBattlePhase] = useState(null);
  const foreground = appState === 'active' || appState == null;

  useEffect(() => {
    let active = true;
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      allowsRecording: false,
      interruptionMode: 'mixWithOthers',
    }).then(() => {
      if (active) setReady(true);
    }).catch(reason => {
      console.warn('Не удалось настроить воспроизведение звука:', reason);
    });
    const subscription = AppState.addEventListener('change', setAppState);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/immutability -- expo-audio exposes native player settings as writable properties. */
    music.loop = true;
    // На время показа результата ответа музыка уступает место удару.
    music.volume = battlePhase === 'feedback' && app.sound ? 0.035 : 0.15;
    music.muted = false;
    /* eslint-enable react-hooks/immutability */

    const battleRunning = battlePhase === 'asking'
      || battlePhase === 'feedback';

    if (
      ready
      && isLoaded
      && !loading
      && app.music
      && foreground
      && battleRunning
    ) {
      music.play();
    } else {
      music.pause();
    }
  }, [music, isLoaded, ready, loading, app.music, app.sound, foreground, battlePhase]);

  const value = useMemo(() => ({ ready, foreground, setBattlePhase }), [ready, foreground]);

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAppAudio() {
  const audio = useContext(AudioContext);
  if (!audio) throw new Error('Звук должен использоваться внутри AudioProvider.');
  return audio;
}
