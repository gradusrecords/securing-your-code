import { EmptyState, Screen } from '../../src/ui/kit';
import { t } from '../../src/i18n';

export default function Page() {
  return (
    <Screen title={t('tab.orders')}>
      <EmptyState text={t('empty.orders')} />
    </Screen>
  );
}
