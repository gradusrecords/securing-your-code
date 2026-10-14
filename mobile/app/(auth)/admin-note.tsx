import { signOut } from '../../src/auth/authService';
import { Button, EmptyState, Screen } from '../../src/ui/kit';
import { t } from '../../src/i18n';

export default function AdminNote() {
  return (
    <Screen>
      <EmptyState text={t('admin.note')} />
      <Button label={t('auth.logout')} onPress={() => { void signOut(); }} />
    </Screen>
  );
}
