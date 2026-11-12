import { ScrollView, Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../../ui/theme';
import { makeStyles } from '../../screens/auth/AuthScreen.styles';
import { legalDocuments } from '../../content/legalDocuments';

export default function LegalDocumentRoute() {
  const { document } = useLocalSearchParams();
  const { colors, commonStyles } = useAppTheme();
  const styles = makeStyles(colors);
  const key = Array.isArray(document) ? document[0] : document;
  const selected = key === 'consent' || key === 'privacy' ? legalDocuments[key] : null;

  return (
    <>
      <Stack.Screen options={{ title: selected?.title ?? 'Документ' }} />
      <ScrollView style={commonStyles.screen} contentContainerStyle={styles.document}>
        {selected ? selected.paragraphs.map((paragraph, index) => (
          <Text key={index} style={styles.documentText}>{paragraph}</Text>
        )) : <Text style={styles.documentText}>Документ не найден.</Text>}
      </ScrollView>
    </>
  );
}