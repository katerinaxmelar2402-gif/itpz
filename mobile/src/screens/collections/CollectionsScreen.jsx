import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../../ui/theme';
import {
  sortCollectionsByTitle,
  useCollections,
} from '../../collections/useCollections';
import {
  CollectionBrowser,
  CollectionFeedback,
} from '../../components/collections/CollectionUI';
import { makeStyles } from './CollectionsScreen.styles';

export default function CollectionsScreen() {
  const { colors, commonStyles } = useAppTheme();
  const styles = makeStyles(colors);
  const library = useCollections();

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={commonStyles.screen}
    >
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Коллекции
        </Text>

        <Text style={styles.subtitle}>
          Все твои вопросы — в одном месте.
        </Text>

        <CollectionFeedback
          loading={library.loading}
          error={library.error}
          onRetry={library.reload}
        />

        {!library.loading && !library.error && (
          <CollectionBrowser
            collections={sortCollectionsByTitle(library.collections)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}