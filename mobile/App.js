import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HelpScreen from './src/screens/help/HelpScreen';

export default function App() {
  return <SafeAreaProvider><HelpScreen /></SafeAreaProvider>;
}
