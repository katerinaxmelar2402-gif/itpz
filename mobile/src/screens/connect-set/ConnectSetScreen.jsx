import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../../ui/theme';
import { makeStyles } from './ConnectSetScreen.styles';

export default function ConnectSetScreen() {
  const [accessKey, setAccessKey] = useState('');
  const { colors, commonStyles, dark } = useAppTheme();
  const styles = makeStyles(colors, dark);

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={commonStyles.screen}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <Text accessibilityRole="header" style={styles.title}>
            Подключить набор
          </Text>

          <Text style={styles.subtitle}>
            Введи ключ, которым с тобой поделились.
          </Text>

          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={styles.illustration}
          >
            <Text style={styles.plus}>+</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Ключ доступа</Text>

            <TextInput
              accessibilityLabel="Ключ доступа"
              value={accessKey}
              onChangeText={setAccessKey}
              placeholder="K7M2-X9PQ"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
              style={styles.input}
            />

            <View
              accessible
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              style={styles.findButton}
            >
              <Text style={styles.findButtonText}>
                Найти набор
              </Text>
            </View>
          </View>

          <Text style={styles.hint}>
            Перед добавлением покажем название,{'\n'}
            автора и количество вопросов.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}