import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { askQuestion, listMyOrders, respondToOrder, type ModelOrder } from '../../../src/services/ordersService';
import { Button, Field, Screen } from '../../../src/ui/kit';
import { t } from '../../../src/i18n';
import { theme } from '../../../src/lib/theme';

const SECTIONS = ['project', 'when_where', 'who', 'conditions', 'requirements'] as const;

const fieldLabel = (sec: string, key: string): string => {
  const k = `brief.f.${sec}.${key}`;
  const label = t(k);
  return label === k ? key : label;
};
const fieldValue = (v: unknown): string => (typeof v === 'boolean' ? (v ? t('orders.yes') : t('orders.no')) : String(v));

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<ModelOrder | null>(null);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    listMyOrders().then((all) => setOrder(all.find((o) => o.order_id === id) ?? null)).catch(() => setError(t('error.generic')));
  }, [id]);

  const answer = async (confirm: boolean) => {
    setError('');
    try {
      await respondToOrder(id, confirm);
      setOrder((o) => (o ? { ...o, my_response: confirm ? 'confirmed' : 'declined', updated_flag: false } : o));
    } catch {
      setError(t('error.generic'));
    }
  };

  const sendQuestion = async () => {
    setError('');
    setSent(false);
    try {
      await askQuestion(id, question);
      setQuestion('');
      setSent(true);
    } catch {
      setError(t('error.generic'));
    }
  };

  if (!order) return <Screen>{error ? <Text style={s.error}>{error}</Text> : null}</Screen>;

  const state =
    order.my_response === 'confirmed' ? t('orders.state_confirmed')
    : order.my_response === 'declined' ? t('orders.state_declined')
    : order.my_response === 'needs_reconfirm' ? t('orders.state_reconfirm')
    : '';

  return (
    <Screen>
      <ScrollView>
        {order.updated_flag ? <Text style={s.updated}>{t('orders.updated')}</Text> : null}
        {SECTIONS.map((sec) => {
          const data = order.brief[sec];
          if (!data) return null;
          return (
            <View key={sec} style={s.section}>
              <Text style={s.sectionTitle}>{t(`brief.${sec}`)}</Text>
              {Object.entries(data).map(([k, v]) => (
                <Text key={k} style={s.line}>{`${fieldLabel(sec, k)}: ${fieldValue(v)}`}</Text>
              ))}
            </View>
          );
        })}
        {state ? <Text style={s.state}>{state}</Text> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Button filled testID="confirm" label={t('orders.confirm')} onPress={() => answer(true)} />
        <Button testID="decline" label={t('orders.decline')} onPress={() => answer(false)} />
        <Text style={s.sectionTitle}>{t('orders.ask')}</Text>
        <Field testID="question" value={question} onChangeText={setQuestion} multiline />
        <Button testID="send-question" label={t('orders.send')} onPress={sendQuestion} />
        {sent ? <Text style={s.state}>{t('orders.question_sent')}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  updated: { color: theme.colors.black, backgroundColor: theme.colors.gold, alignSelf: 'flex-start', paddingHorizontal: 8, marginBottom: 8 },
  section: { marginBottom: 14 },
  sectionTitle: { color: theme.colors.gold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  line: { color: theme.colors.cream },
  state: { color: theme.colors.gold, marginVertical: 8 },
  error: { color: '#E8A08A', marginVertical: 8 },
});
