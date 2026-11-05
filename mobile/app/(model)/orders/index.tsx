import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { groupOrders, listMyOrders, type ModelOrder } from '../../../src/services/ordersService';
import { EmptyState, Screen } from '../../../src/ui/kit';
import { t } from '../../../src/i18n';
import { theme } from '../../../src/lib/theme';

type Tab = 'new' | 'mine' | 'archive';

const orderTitle = (o: ModelOrder): string =>
  String((o.brief.project as { title?: unknown } | undefined)?.title ?? t('orders.untitled'));

export default function OrdersList() {
  const router = useRouter();
  const [orders, setOrders] = useState<ModelOrder[] | null>(null);
  const [tab, setTab] = useState<Tab>('new');
  const [error, setError] = useState('');

  useEffect(() => {
    listMyOrders().then(setOrders).catch(() => setError(t('error.generic')));
  }, []);

  const groups = groupOrders(orders ?? []);
  const shown = groups[tab];

  return (
    <Screen title={t('tab.orders')}>
      <View style={s.tabs}>
        {(['new', 'mine', 'archive'] as Tab[]).map((k) => (
          <Pressable key={k} testID={`tab-${k}`} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}>
            <Text style={[s.tabText, tab === k && s.tabTextOn]}>{t(`orders.${k}`)} ({groups[k].length})</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <ScrollView>
        {orders && shown.length === 0 ? <EmptyState text={t('empty.orders')} /> : null}
        {shown.map((o) => (
          <Pressable key={o.order_id} style={s.row} onPress={() => router.push({ pathname: '/orders/[id]', params: { id: o.order_id } } as never)}>
            <Text style={s.title}>{orderTitle(o)}</Text>
            {o.updated_flag ? <Text style={s.updated}>{t('orders.updated')}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { borderWidth: 1, borderColor: theme.colors.gold, paddingHorizontal: 12, paddingVertical: 8 },
  tabOn: { backgroundColor: theme.colors.gold },
  tabText: { color: theme.colors.gold },
  tabTextOn: { color: theme.colors.black },
  row: { borderBottomWidth: 1, borderBottomColor: theme.colors.green2, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: theme.colors.cream, fontSize: 18 },
  updated: { color: theme.colors.black, backgroundColor: theme.colors.gold, paddingHorizontal: 8, alignSelf: 'center' },
  error: { color: '#E8A08A', marginBottom: 8 },
});
