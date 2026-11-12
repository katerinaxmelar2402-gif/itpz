import { useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useAppTheme } from '../../../ui/theme';
import { useAuth } from '../../auth/AuthProvider';
import { Field } from '../../screens/auth/AuthScreen';
import SectionScreen from '../../screens/SectionScreen';
import { styles } from '../../screens/ProfileScreen.styles';
import { DEFAULT_GAME, GAME_LIMITS, useSettings } from '../../settings/SettingsProvider';
import Slider from '@react-native-community/slider';

function Action({ title, onPress, disabled = false }) {
  const { commonStyles } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.action, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={commonStyles.linkText}>{title}</Text>
    </Pressable>
  );
}

function SettingSwitch({ label, value, onChange, disabled }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.settingLabel, { color: colors.text }]}>
        {label}
      </Text>

      <View style={styles.switchSlot}>
        <Switch
          accessibilityLabel={label}
          value={value}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{
            false: colors.border,
            true: colors.accent + '66',
          }}
          thumbColor={value ? colors.accent : colors.muted}
          style={styles.largeSwitch}
        />
      </View>
    </View>
  );
}

function GameSlider({
  label,
  value,
  minimum,
  maximum,
  onChange,
  disabled,
}) {
  const { colors } = useAppTheme();
  const [preview, setPreview] = useState(null);
  const displayedValue = preview ?? value;

  async function finishSliding(nextValue) {
    try {
      await onChange(Math.round(nextValue));
    } finally {
      setPreview(null);
    }
  }

  return (
    <View>
      <Text style={[styles.sliderLabel, { color: colors.text }]}>
        {label}: {displayedValue}
      </Text>

      <Slider
        accessibilityLabel={label}
        style={styles.slider}
        value={displayedValue}
        minimumValue={minimum}
        maximumValue={maximum}
        step={1}
        disabled={disabled}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
        onValueChange={nextValue => setPreview(Math.round(nextValue))}
        onSlidingComplete={finishSliding}
      />
    </View>
  );
}

export default function ProfileRoute() {
  const { session, updateProfile, signOut } = useAuth();
  const { colors, commonStyles } = useAppTheme();
  const { app, game, saveApp, saveGame, error: settingsError } = useSettings();
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const user = session?.user;

  if (!user) return null;

  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const heading = [styles.heading, { color: colors.text }];
  const settingsDisabled = busy || !!settingsError;

  async function run(action) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось выполнить действие.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function beginEditing() {
    setError('');
    setDraft({ name: user.name, email: user.email, currentPassword: '', newPassword: '', confirmation: '' });
  }

  function editField(field, value) {
    setDraft(previous => ({ ...previous, [field]: value }));
  }

  function saveProfile() {
    if (draft.newPassword !== draft.confirmation) {
      setError('Новые пароли не совпадают.');
      return;
    }

    return run(async () => {
      const { name, email, currentPassword, newPassword } = draft;
      await updateProfile({ name, email, currentPassword, newPassword });
      setDraft(null);
    });
  }

  return (
    <SectionScreen title="Профиль">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.identity}>
          <Image
            source={require('../../../assets/login-mascot.png')}
            resizeMode="contain"
            style={[styles.avatar, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }]}
          />
          <Text style={[styles.name, { color: colors.text }]}>{user.name}</Text>
          <Text style={[styles.email, { color: colors.muted }]}>{user.email}</Text>
        </View>

        {!!error && (
          <Text accessibilityRole="alert" style={commonStyles.errorText}>{error}</Text>
        )}

        <View style={card}>
          <Text style={heading}>Учётная запись</Text>
          {draft ? (
            <>
              <Field label="Имя" value={draft.name} maxLength={100}
                onChangeText={value => editField('name', value)} editable={!busy} />
              <Field label="Электронная почта" value={draft.email} maxLength={254}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                onChangeText={value => editField('email', value)} editable={!busy} />
              <Field label="Текущий пароль" value={draft.currentPassword}
                secureTextEntry autoComplete="current-password" maxLength={128}
                onChangeText={value => editField('currentPassword', value)} editable={!busy} />
              <Field label="Новый пароль, если меняете" value={draft.newPassword}
                secureTextEntry autoComplete="new-password" maxLength={128}
                onChangeText={value => editField('newPassword', value)} editable={!busy} />
              <Field label="Повторите новый пароль" value={draft.confirmation}
                secureTextEntry maxLength={128}
                onChangeText={value => editField('confirmation', value)} editable={!busy} />
              {!!error && <Text style={commonStyles.errorText}>{error}</Text>}
              <Action title="Сохранить профиль" onPress={saveProfile} disabled={busy} />
              <Action title="Отмена" disabled={busy} onPress={() => {
                setDraft(null);
                setError('');
              }} />
            </>
          ) : (
            <Action title="Редактировать профиль" onPress={beginEditing} disabled={busy} />
          )}
        </View>

        <View style={card}>
          <Text style={heading}>Настройки приложения</Text>

          {!!settingsError && (
            <Text style={commonStyles.errorText}>{settingsError}</Text>
          )}

          <SettingSwitch
            label="Звуковые эффекты"
            value={app.sound}
            disabled={settingsDisabled}
            onChange={sound => run(() => saveApp({ sound }))}
          />

          <SettingSwitch
            label="Музыка"
            value={app.music}
            disabled={settingsDisabled}
            onChange={music => run(() => saveApp({ music }))}
          />

          <View style={styles.row}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Тема
            </Text>

            <View style={styles.themeOptions}>
              {[
                ['light', 'Светлая'],
                ['dark', 'Тёмная'],
              ].map(([theme, title]) => {
                const selected = app.theme === theme;

                return (
                  <Pressable
                    key={theme}
                    accessibilityRole="radio"
                    accessibilityLabel={`${title} тема`}
                    accessibilityState={{
                      checked: selected,
                      disabled: settingsDisabled,
                    }}
                    disabled={settingsDisabled}
                    onPress={() => run(() => saveApp({ theme }))}
                    style={[
                      styles.themeOption,
                      {
                        backgroundColor: selected
                          ? colors.primary
                          : colors.surface,
                        borderColor: selected
                          ? colors.primary
                          : colors.border,
                      },
                      settingsDisabled && styles.disabled,
                    ]}
                  >
                    <Text style={{
                      color: selected ? colors.onPrimary : colors.text,
                      fontSize: 13,
                      fontWeight: '600',
                    }}>
                      {title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={card}>
          <Text style={heading}>Настройки игры</Text>

          {[
            ['answerSeconds', 'Секунд на ответ'],
            ['lives', 'Количество жизней'],
            ['questionCount', 'Количество вопросов'],
          ].map(([key, label]) => (
            <GameSlider
              key={key}
              label={label}
              value={game[key]}
              minimum={GAME_LIMITS[key].min}
              maximum={GAME_LIMITS[key].max}
              disabled={settingsDisabled}
              onChange={value => run(() => saveGame({ [key]: value }))}
            />
          ))}

          <Action
            title="Вернуть базовые настройки"
            disabled={settingsDisabled}
            onPress={() => run(() => saveGame(DEFAULT_GAME))}
          />
        </View>

        <View style={card}>
          <Link href="/help" asChild>
            <Pressable accessibilityRole="link" style={styles.action}>
              <Text style={commonStyles.linkText}>Руководство пользователя</Text>
            </Pressable>
          </Link>
          <Action title="Выйти из аккаунта" disabled={busy} onPress={() => run(signOut)} />
        </View>
      </ScrollView>
    </SectionScreen>
  );
}