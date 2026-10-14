import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { listIdeas, type Idea } from '../../src/services/contentService';
import { EmptyState, Screen } from '../../src/ui/kit';
import { currentLanguage, t } from '../../src/i18n';
import { theme } from '../../src/lib/theme';

const KINDS: Idea['kind'][] = ['motivation', 'pr', 'media'];

export default function Ideas() {
  const [items, setItems] = useState<Idea[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { listIdeas(currentLanguage()).then(setItems).catch(() => setError(t('error.generic'))); }, []);

  return (
    <Screen title={t('tab.ideas')}>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <ScrollView>
        {items && items.length === 0 && !error ? <EmptyState text={t('empty.ideas')} /> : null}
        {KINDS.map((k) => {
          const group = (items ?? []).filter((i) => i.kind === k);
          if (group.length === 0) return null;
          return (
            <View key={k}>
              <Text style={s.section}>{t(`ideas.${k}`)}</Text>
              {group.map((i) => (
                <View key={i.id} style={s.card}>
                  <Text style={s.title}>{i.title}</Text>
                  <Text style={s.body}>{i.body}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  section: { color: theme.colors.gold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  card: { borderBottomWidth: 1, borderBottomColor: theme.colors.green2, paddingVertical: 12 },
  title: { color: theme.colors.cream, fontSize: 18 },
  body: { color: theme.colors.cream, opacity: 0.8, marginTop: 4 },
  error: { color: '#E8A08A', marginBottom: 8 },
});
