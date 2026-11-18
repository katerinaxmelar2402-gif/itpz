import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { namedUploadFile } from '../../collections/uploadFile.mjs';
import { useAuth } from '../../auth/AuthProvider';
import { useSettings } from '../../settings/SettingsProvider';
import { useAppTheme } from '../../../ui/theme';
import { FormButton, FormField, FormPage } from './CollectionFormUI';
import { makeStyles } from './CreateCollectionScreen.styles';

export default function GenerateCollectionScreen() {
  const { request } = useAuth();
  const { game } = useSettings();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [title, setTitle] = useState('');
  const [count, setCount] = useState(String(game.questionCount ?? 10));
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const locked = useRef(false);
  const savedId = useRef('');

  async function pickFile() {
    if (locked.current) return;
    try {
      const mimeTypes = ['text/plain', 'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      let selected;
      if (Platform.OS !== 'ios') {
        // Android: сохраняем имя из метаданных и читаем исходный content:// URI.
        // Копия DocumentPicker находится вне изолированного кэша FileSystem в Expo Go.
        const picked = await DocumentPicker.getDocumentAsync({ type: mimeTypes,
          copyToCacheDirectory: false });
        if (picked.canceled) return;
        selected = picked.assets[0];
      } else {
        const picked = await File.pickFileAsync({ mimeTypes });
        if (picked.canceled) return;
        const nativeFile = picked.result;
        selected = { name: nativeFile.name, uri: nativeFile.uri,
          size: nativeFile.size, nativeFile };
      }
      if (!/\.(txt|docx|pdf)$/i.test(selected.name)) throw new Error('Выбери TXT, DOCX или PDF.');
      if (selected.size > 10 * 1024 * 1024) throw new Error('Файл должен быть не больше 10 МБ.');
      setFile(selected);
      setError('');
    } catch (reason) { setError(reason.message || 'Не удалось выбрать файл.'); }
  }

  async function generate() {
    if (locked.current) return;
    const number = Number(count);
    if (!title.trim()) return setError('Введи название коллекции.');
    if (!Number.isInteger(number) || number < 5 || number > 20) return setError('Выбери от 5 до 20 вопросов.');
    if (!file && text.trim().length < 100) return setError('Загрузи файл или вставь хотя бы 100 символов конспекта.');
    locked.current = true;
    setBusy('Готовим вопросы… Это может занять несколько минут.');
    setError('');
    try {
      const body = new FormData();
      body.append('title', title.trim());
      body.append('count', String(number));
      if (file) {
        if (Platform.OS === 'web') body.append('file', file.file, file.name);
        else {
          const nativeFile = namedUploadFile(File, file.uri, file.name);
          body.append('file', nativeFile, file.name);
        }
      } else body.append('text', text);
      const data = await request('/collections/generate', { method: 'POST', body, timeoutMs: 600000 });
      setResult(data);
    } catch (reason) { setError(reason.message || 'Не удалось составить вопросы.'); }
    finally { locked.current = false; setBusy(''); }
  }

  async function saveCollection() {
    if (locked.current || !result) return;
    locked.current = true;
    setBusy('Сохраняем коллекцию…');
    setError('');
    try {
      if (!savedId.current) {
        const data = await request('/collections', { method: 'POST', body: {
          title: result.title, questions: result.questions, accessKey: null, creationMethod: 'notes',
        } });
        savedId.current = data.collection.id;
      }
      router.dismissTo('/collections');
    } catch (reason) { setError(reason.message || 'Не удалось сохранить коллекцию.'); }
    finally { locked.current = false; setBusy(''); }
  }

  return (
    <FormPage>
      <Text accessibilityRole="header" style={styles.title}>Коллекция по конспекту</Text>
      {!result ? <>
        <Text style={styles.hint}>Загрузи конспект или вставь текст. Вопросы будут составлены по этому материалу. Для генерации серверу нужен интернет.</Text>
        <FormField label="Название коллекции" value={title} onChangeText={setTitle} maxLength={100} editable={!busy} />
        <FormField label="Количество вопросов: от 5 до 20" value={count} onChangeText={setCount} maxLength={2} editable={!busy} showCounter={false} />
        <FormButton label={file ? 'Выбрать другой файл' : 'Выбрать конспект'} onPress={pickFile} disabled={!!busy} secondary />
        {file ? <>
          <Text style={styles.sectionTitle}>{file.name}</Text>
          <FormButton label="Убрать файл и вставить текст" onPress={() => setFile(null)} disabled={!!busy} secondary />
        </> : <FormField label="Текст конспекта" value={text} onChangeText={setText} maxLength={40000} multiline editable={!busy} />}
        <Text style={styles.hint}>TXT , DOCX или PDF с выделяемым текстом. До 10 МБ и 40 000 символов. Сканы и фотографии не поддерживаются.</Text>
        <FormButton label="Составить вопросы" onPress={generate} disabled={!!busy} />
      </> : <>
        <Text style={styles.sectionTitle}>{result.title}</Text>
        <Text style={styles.hint}>Готово вопросов: {result.questions.length}. Проверь ответы: ИИ может ошибаться. Пока результат не сохранён.</Text>
        {result.questions.map((q, index) => <View key={index} style={styles.card}>
          <Text style={styles.sectionTitle}>{index + 1}. {q.text}</Text>
          {q.answers.map((answer, i) => <Text key={i} style={styles.hint}>{i === q.correctIndex ? '✓ ' : '• '}{answer}</Text>)}
          <Text style={styles.hint}>Фрагмент конспекта для проверки: «{q.sourceQuote}»</Text>
        </View>)}
        <FormButton label="Сохранить" onPress={saveCollection} disabled={!!busy} />
        <Text style={styles.hint}>Коллекция сохранится как личная и появится в списке коллекций.</Text>
        <FormButton label="Назад к конспекту" onPress={() => setResult(null)} disabled={!!busy} secondary />
      </>}
      {!!busy && <><ActivityIndicator color={colors.primary} /><Text accessibilityLiveRegion="polite" style={styles.hint}>{busy}</Text></>}
      {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    </FormPage>
  );
}
