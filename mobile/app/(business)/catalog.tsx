import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { filterCatalog, listCatalog, type CatalogModel } from '../../src/services/catalogService';
import { EmptyState, Screen } from '../../src/ui/kit';
import { t } from '../../src/i18n';
import { theme } from '../../src/lib/theme';

export default function Catalog() {
  const [models, setModels] = useState<CatalogModel[] | null>(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [gender, setGender] = useState<string | undefined>();
  const [error, setError] = useState('');

  useEffect(() => { listCatalog().then(setModels).catch(() => setError(t('error.generic'))); }, []);

  const shown = filterCatalog(models ?? [], { gender, favoriteOnly });

  return (
    <Screen title={t('tab.catalog')}>
      <View style={s.filters}>
        <Chip testID="filter-favorites" label={t('catalog.favorites')} on={favoriteOnly} onPress={() => setFavoriteOnly((v) => !v)} />
        <Chip testID="filter-female" label={t('gender.female')} on={gender === 'female'} onPress={() => setGender((g) => (g === 'female' ? undefined : 'female'))} />
        <Chip testID="filter-male" label={t('gender.male')} on={gender === 'male'} onPress={() => setGender((g) => (g === 'male' ? undefined : 'male'))} />
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <ScrollView>
        {models && shown.length === 0 && !error ? <EmptyState text={t('empty.catalog')} /> : null}
        {shown.map((m) => (
          <View key={m.model_id} style={s.card}>
            <Text style={s.name}>{m.display_name}{m.is_favorite ? ' ★' : ''}</Text>
            <Text style={s.meta}>{m.height_cm} cm · {m.directions.map((d) => t(`dir.${d}`)).join(', ')}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Chip({ label, on, onPress, testID }: { label: string; on: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: theme.colors.gold, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: theme.colors.gold },
  chipText: { color: theme.colors.gold },
  chipTextOn: { color: theme.colors.black },
  card: { borderBottomWidth: 1, borderBottomColor: theme.colors.green2, paddingVertical: 14 },
  name: { color: theme.colors.cream, fontSize: 20 },
  meta: { color: theme.colors.cream, opacity: 0.7, marginTop: 2 },
  error: { color: '#E8A08A', marginBottom: 8 },
});
