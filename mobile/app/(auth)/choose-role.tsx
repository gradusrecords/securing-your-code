import { useState } from 'react';
import { Text } from 'react-native';
import { setMyRole, signOut } from '../../src/auth/authService';
import { Button, ErrorText, Screen } from '../../src/ui/kit';
import { t } from '../../src/i18n';
import { theme } from '../../src/lib/theme';
import { supabase } from '../../src/lib/supabase';

export default function ChooseRole() {
  const [error, setError] = useState('');
  const pick = (role: 'model' | 'business') => async () => {
    setError('');
    try {
      await setMyRole(role);
      await supabase.auth.refreshSession();
    } catch (e) { setError((e as Error).message || t('error.generic')); }
  };
  return (
    <Screen title={t('role.title')}>
      <Text style={{ color: theme.colors.cream, opacity: 0.7, marginBottom: 16 }}>{t('role.hint')}</Text>
      <ErrorText text={error} />
      <Button filled label={t('role.model')} onPress={pick('model')} />
      <Button label={t('role.business')} onPress={pick('business')} />
      <Button label={t('auth.logout')} onPress={() => { void signOut(); }} />
    </Screen>
  );
}
