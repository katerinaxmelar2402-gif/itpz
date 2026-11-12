//Рисует формы входа и регистрации. Общая разметка и поля используются в обоих режимах.
import { useRef, useState } from 'react';
import {
  Image, Keyboard, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { validateCredentials, validateRegistration } from '../../auth/validation';
import { SymbolView } from 'expo-symbols';
import { useAppTheme } from '../../../ui/theme';
import { makeStyles } from './AuthScreen.styles';


/** @param {import('react-native').TextInputProps & { label: string }} props */
export function Field({ label, secureTextEntry = false, ...props }) {
  const { colors, commonStyles } = useAppTheme(); 
  const styles = makeStyles(colors);
  const [visible, setVisible] = useState(false);
  const action = visible ? 'Скрыть' : 'Показать';

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputRow}>
        <TextInput
          {...props}
          style={[commonStyles.field, secureTextEntry && styles.passwordInput]}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry && !visible}
        />

        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action + ': ' + label}
            onPress={() => setVisible(value => !value)}
            style={styles.passwordToggle}
          >
            <SymbolView
            name={visible
                ? { ios: 'eye', android: 'visibility', web: 'visibility' }
                : { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }}
            size={22}
            tintColor={colors.primary}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function AuthScreen({ register = false }) {
  const { colors, commonStyles } = useAppTheme(); 
  const styles = makeStyles(colors);
  const { signIn, registerAccount } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function submit() {
    if (submitting.current) return;
    const address = email.trim();
    const message = validateCredentials(address, password) ||
      (register ? validateRegistration(name, password, confirmation, consent) : null);
    if (message) {
      setError(message);
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError('');
    Keyboard.dismiss();

    try {
      if (register) {
        await registerAccount({ name: name.trim(), email: address, password, consent });
      } else {
        await signIn(address, password);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось отправить форму.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={commonStyles.screen}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.title}>
            {register ? 'Регистрация' : 'Вход'}
          </Text>

          {!register && (
            <Image source={require('../../../assets/login-mascot.png')} style={styles.mascot} />
          )}

          <Text style={styles.heading}>{register ? 'Создай аккаунт' : 'С возвращением!'}</Text>
          <Text style={styles.subtitle}>
            {register ? 'Начни свою первую тренировку.' : 'Продолжим твою тренировку.'}
          </Text>

          <View style={styles.form}>
            {register && (
              <Field label="Имя" placeholder="Ваше имя" value={name}
                onChangeText={setName} autoComplete="name" maxLength={100} />
            )}
            <Field label="Электронная почта" placeholder="name@example.com" value={email}
              onChangeText={setEmail} keyboardType="email-address" autoComplete="email"
              autoCapitalize="none" autoCorrect={false} maxLength={254} />
            <Field label="Пароль" placeholder={register ? 'От 6 символов' : 'Введите пароль'}
              value={password} onChangeText={setPassword} secureTextEntry maxLength={128}
              autoCapitalize="none" autoComplete={register ? 'new-password' : 'current-password'} />
            {register ? (
              <>
                <Field label="Повторите пароль" placeholder="Введите пароль ещё раз"
                  value={confirmation} onChangeText={setConfirmation} secureTextEntry maxLength={128}
                  autoCapitalize="none" />
                <View style={styles.consentRow}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel="Согласие на обработку персональных данных"
                    accessibilityState={{ checked: consent }}
                    onPress={() => setConsent(value => !value)}
                    style={styles.consentTouch}
                    hitSlop={4}
                  >
                    <View style={[styles.consentBox, consent && styles.consentBoxChecked]}>
                      {consent && <Text style={styles.consentCheck}>✓</Text>}
                    </View>
                  </Pressable>
                  <View style={styles.consentCopy}>
                    <Link href="/legal/consent" style={styles.consentText}>
                      Согласен на обработку персональных данных
                    </Link>
                    <Link href="/legal/privacy" style={styles.consentLink}>
                      и ознакомлен с политикой конфиденциальности
                    </Link>
                  </View>
                </View>
              </>
            ) : (
              <Link href="/reset-password" style={[styles.forgot, commonStyles.linkText]}>
                Забыли пароль?
              </Link>
            )}

            {!!error && (
            <Text accessibilityLiveRegion="polite" style={[styles.feedback, commonStyles.errorText]}>
                {error}
            </Text>
            )}

            <Pressable accessibilityRole="button" onPress={submit} disabled={busy}
              style={[commonStyles.primaryButton, styles.submit, busy && styles.disabled]}>
              <Text style={commonStyles.primaryButtonText}>
                {busy ? 'Подождите…' : register ? 'Зарегистрироваться' : 'Войти'}
              </Text>
            </Pressable>

            <Link href={register ? '/' : '/register'} style={[commonStyles.linkText, styles.bottomLink]}>
              {register ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}