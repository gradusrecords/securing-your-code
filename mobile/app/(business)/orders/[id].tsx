import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  askManager, cancelOrder, listBusinessOrders, listConfirmedModels, selectModels,
  type BusinessOrder, type ConfirmedModel,
} from '../../../src/services/businessOrdersService';
import { Button, Field, Screen } from '../../../src/ui/kit';
import { t } from '../../../src/i18n';
import { theme } from '../../../src/lib/theme';

export default function BusinessOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<BusinessOrder | null>(null);
  const [models, setModels] = useState<ConfirmedModel[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [limitHint, setLimitHint] = useState('');
  const [question, setQuestion] = useState('');

  const load = async () => {
    try {
      const [all, ms] = await Promise.all([listBusinessOrders(), listConfirmedModels(id)]);
      setOrder(all.find((o) => o.order_id === id) ?? null);
      setModels(ms);
      setPicked(ms.filter((m) => m.is_selected).map((m) => m.model_id));
    } catch {
      setError(t('error.generic'));
    }
  };
  useEffect(() => { void load(); }, [id]);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setError(''); setNotice('');
    try { await fn(); if (ok) setNotice(ok); } catch { setError(t('error.generic')); }
  };

  if (!order) return <Screen>{error ? <Text style={s.error}>{error}</Text> : null}</Screen>;

  const canSelect = order.status === 'open' || order.status === 'selected';
  const canEdit = order.status === 'open' || order.status === 'in_review';

  return (
    <Screen>
      <ScrollView>
        <Text style={s.title}>{order.brief.project.title}</Text>
        <Text style={s.status}>{t(`ostatus.${order.status}`)}</Text>
        {order.pending_version != null && order.status !== 'in_review' ? <Text style={s.pending}>{t('orders.pending_changes')}</Text> : null}
        <Text style={s.note}>{t('orders.manager_note')}</Text>

        <Text style={s.section}>{t('orders.confirmed_models')} ({order.confirmed_count})</Text>
        {models.length === 0 ? <Text style={s.note}>{t('orders.no_confirmed')}</Text> : null}
        {models.map((m) => {
          const on = picked.includes(m.model_id);
          return (
            <Pressable key={m.model_id} testID={`pick-${m.model_id}`} disabled={!canSelect}
              onPress={() => {
                setLimitHint('');
                if (on) { setPicked((p) => p.filter((x) => x !== m.model_id)); return; }
                const limit = Number(order.brief.who.count);
                if (limit >= 1 && picked.length >= limit) { setLimitHint(t('orders.select_limit', { n: limit })); return; }
                setPicked((p) => [...p, m.model_id]);
              }}
              style={[s.model, on && s.modelOn]}>
              <Text style={[s.modelName, on && s.modelNameOn]}>{m.display_name}{m.is_favorite ? ' ★' : ''}</Text>
              <Text style={[s.modelMeta, on && s.modelNameOn]}>{m.height_cm} cm</Text>
              {on ? <Text style={s.modelNameOn}>{t('orders.selected_mark')}</Text> : null}
            </Pressable>
          );
        })}
        {limitHint ? <Text style={s.error}>{limitHint}</Text> : null}
        {canSelect && models.length > 0 ? (
          <Button filled testID="send-selection" label={t('orders.select_send')}
            onPress={() => run(async () => { await selectModels(id, picked); await load(); })} />
        ) : null}

        {canEdit ? <Button label={t('orders.edit')} onPress={() => router.push({ pathname: '/orders/new', params: { id } } as never)} /> : null}
        {canEdit && !confirmCancel ? <Button testID="cancel" label={t('orders.cancel')} onPress={() => setConfirmCancel(true)} /> : null}
        {confirmCancel ? (
          <Button testID="cancel-confirm" label={t('orders.cancel_confirm')}
            onPress={() => run(async () => { await cancelOrder(id); await load(); setConfirmCancel(false); })} />
        ) : null}

        <Text style={s.section}>{t('orders.ask')}</Text>
        <Field testID="question" value={question} onChangeText={setQuestion} multiline />
        <Button testID="send-question" label={t('orders.send')}
          onPress={() => run(async () => { await askManager(id, question); setQuestion(''); }, t('orders.question_sent'))} />

        {notice ? <View><Text style={s.ok}>{notice}</Text></View> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { color: theme.colors.cream, fontSize: 24 },
  status: { color: theme.colors.gold, marginBottom: 4 },
  pending: { color: theme.colors.black, backgroundColor: theme.colors.gold, alignSelf: 'flex-start', paddingHorizontal: 8, marginVertical: 6 },
  note: { color: theme.colors.cream, opacity: 0.7, marginVertical: 6 },
  section: { color: theme.colors.gold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  model: { borderWidth: 1, borderColor: theme.colors.gold, padding: 12, marginVertical: 4 },
  modelOn: { backgroundColor: theme.colors.gold },
  modelName: { color: theme.colors.cream, fontSize: 18 },
  modelNameOn: { color: theme.colors.black },
  modelMeta: { color: theme.colors.cream, opacity: 0.8 },
  ok: { color: theme.colors.gold, marginVertical: 8 },
  error: { color: '#E8A08A', marginVertical: 8 },
});
