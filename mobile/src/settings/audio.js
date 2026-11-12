import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useSettings } from './SettingsProvider';

export function BackgroundMusic() {
  const { app } = useSettings();
  const player = useAudioPlayer(require('../../assets/app-music.mp3'));
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    player.loop = true;
    player.volume = 0.25;

    if (app.music && (appState === 'active' || appState == null)) {
      player.play();
    } else {
      player.pause();
    }
  }, [app.music, appState, player]);

  return null;
}

export function useSoundEffect() {
  const { app } = useSettings();
  const player = useAudioPlayer(require('../../assets/app-click.mp3'));

  return async function playSound() {
    if (!app.sound) return;
    await player.seekTo(0);
    player.play();
  };
}