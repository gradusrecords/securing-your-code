import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listBusinessOrders, type BusinessOrder } from '../../../src/services/businessOrdersService';
import { getMyBusinessProfile } from '../../../src/services/businessProfileService';
import { Button, EmptyState, Screen } from '../../../src/ui/kit';
import { t } from '../../../src/i18n';
import { theme } from '../../../src/lib/theme';

export default function OrdersList() {
  const router = useRouter();
  const [orders, setOrders] = useState<BusinessOrder[] | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listBusinessOrders().then(setOrders).catch(() => setError(t('error.generic')));
    getMyBusinessProfile().then((p) => setHasProfile(!!p)).catch(() => {});
  }, []);

  const create = () => {
    if (!hasProfile) { setHint(t('orders.fill_profile')); return; }
    router.push('/orders/new' as never);
  };

  return (
    <Screen title={t('tab.orders')}>
      <Button filled testID="create" label={t('orders.create')} onPress={create} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
      <ScrollView>
        {orders && orders.length === 0 ? <EmptyState text={t('empty.orders')} /> : null}
        {orders?.map((o) => (
          <Pressable key={o.order_id} style={s.row} onPress={() => router.push({ pathname: '/orders/[id]', params: { id: o.order_id } } as never)}>
            <Text style={s.title}>{o.brief.project.title}</Text>
            <View style={s.meta}>
              <Text style={s.status}>{t(`ostatus.${o.status}`)}</Text>
              <Text testID={`confirmed-${o.order_id}`} style={s.line}>{t('orders.confirmed_count')}: {o.confirmed_count}</Text>
            </View>
            {o.pending_version != null && o.status !== 'in_review' ? <Text style={s.pending}>{t('orders.pending_changes')}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: theme.colors.green2, paddingVertical: 14 },
  title: { color: theme.colors.cream, fontSize: 18 },
  meta: { flexDirection: 'row', gap: 16, marginTop: 4 },
  status: { color: theme.colors.gold },
  line: { color: theme.colors.cream, opacity: 0.8 },
  pending: { color: theme.colors.black, backgroundColor: theme.colors.gold, alignSelf: 'flex-start', paddingHorizontal: 8, marginTop: 6 },
  hint: { color: theme.colors.gold, marginVertical: 8 },
  error: { color: '#E8A08A', marginVertical: 8 },
});
