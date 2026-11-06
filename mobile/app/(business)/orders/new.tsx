import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { emptyBrief, type BriefInput } from '../../../src/models/brief';
import { createOrder, listBusinessOrders, updateOrder } from '../../../src/services/businessOrdersService';
import { BriefForm } from '../../../src/ui/BriefForm';
import { Screen } from '../../../src/ui/kit';
import { t } from '../../../src/i18n';

// Used both to create an order and (with ?id=...) to edit an existing one.
export default function NewOrder() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<BriefInput | null>(id ? null : emptyBrief());

  useEffect(() => {
    if (!id) return;
    listBusinessOrders().then((all) => setInitial(all.find((o) => o.order_id === id)?.brief ?? emptyBrief())).catch(() => setInitial(emptyBrief()));
  }, [id]);

  if (!initial) return <Screen><Text /></Screen>;

  const submit = async (b: BriefInput) => {
    if (id) {
      await updateOrder(id, b);
      router.replace({ pathname: '/orders/[id]', params: { id } } as never);
    } else {
      const newId = await createOrder(b);
      router.replace({ pathname: '/orders/[id]', params: { id: newId } } as never);
    }
  };

  return (
    <Screen title={id ? t('orders.edit') : t('orders.create')}>
      <BriefForm initial={initial} submitLabel={id ? t('orders.save_changes') : t('orders.submit')} onSubmit={submit} />
    </Screen>
  );
}
