import { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authRequest } from '../../auth/api';
import { Field } from './AuthScreen';
import { useAppTheme } from '../../../ui/theme';
import { makeStyles } from './AuthScreen.styles';

export default function ResetPasswordScreen() {
  const { colors, commonStyles } = useAppTheme(); 
  const styles = makeStyles(colors);
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  async function sendCode() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    Keyboard.dismiss();

    try {
      const result = await authRequest('/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
      });
      setMessage(result.message);
      setStep('code');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось отправить запрос.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (sending.current) return;
    if (password !== confirmation) {
      setError('Пароли не совпадают.');
      return;
    }

    sending.current = true;
    setBusy(true);
    setError('');
    Keyboard.dismiss();

    try {
      const result = await authRequest('/reset-password', {
        method: 'POST',
        body: { email: email.trim(), code: code.trim(), password },
      });
      setCode('');
      setPassword('');
      setConfirmation('');
      setMessage(result.message);
      setStep('done');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось обновить пароль.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={commonStyles.screen}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.title}>Восстановление пароля</Text>
          <View style={styles.form}>
            {!!message && <Text accessibilityLiveRegion="polite" style={styles.feedback}>{message}</Text>}

            {step === 'email' && (
              <Field
                label="Электронная почта" placeholder="name@example.com" value={email}
                onChangeText={setEmail} keyboardType="email-address" autoComplete="email"
                autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!busy}
              />
            )}

            {step === 'code' && (
              <>
                <Field
                  label="Код из письма" placeholder="8 цифр" value={code}
                  onChangeText={setCode} keyboardType="number-pad" maxLength={8} editable={!busy}
                />
                <Field
                  label="Новый пароль" placeholder="От 6 символов" value={password}
                  onChangeText={setPassword} autoComplete="new-password"
                  autoCapitalize="none" secureTextEntry maxLength={128} editable={!busy}
                />
                <Field
                  label="Повтори новый пароль" placeholder="Введи пароль ещё раз"
                  value={confirmation} onChangeText={setConfirmation}
                  autoCapitalize="none" secureTextEntry maxLength={128} editable={!busy}
                />
              </>
            )}

            {!!error && (
              <Text accessibilityLiveRegion="polite" style={[styles.feedback, commonStyles.errorText]}>
                {error}
              </Text>
            )}

            {step !== 'done' && (
              <Pressable
                accessibilityRole="button" disabled={busy}
                style={[commonStyles.primaryButton, styles.submit, busy && styles.disabled]}
                onPress={step === 'email' ? sendCode : resetPassword}
              >
                <Text style={commonStyles.primaryButtonText}>
                  {busy ? 'Подожди…' : step === 'email' ? 'Получить код' : 'Сохранить пароль'}
                </Text>
              </Pressable>
            )}

            {step === 'code' && (
              <Pressable accessibilityRole="button" disabled={busy} onPress={sendCode}>
                <Text style={[commonStyles.linkText, styles.bottomLink]}>Отправить код ещё раз</Text>
              </Pressable>
            )}

            <Link href="/" replace style={[commonStyles.linkText, styles.bottomLink]}>Вернуться ко входу</Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}