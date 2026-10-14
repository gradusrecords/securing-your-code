import { EmptyState, Screen } from '../../src/ui/kit';
import { t } from '../../src/i18n';

export default function Page() {
  return (
    <Screen title={t('tab.ideas')}>
      <EmptyState text={t('empty.ideas')} />
    </Screen>
  );
}
