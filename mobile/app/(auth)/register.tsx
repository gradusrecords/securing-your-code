import { useState } from 'react';
import { Text } from 'react-native';
import { Link } from 'expo-router';
import { signUpWithEmail } from '../../src/auth/authService';
import { Button, ErrorText, Field, LangSwitch, Screen } from '../../src/ui/kit';
import { t } from '../../src/i18n';
import { theme } from '../../src/lib/theme';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const go = (role: 'model' | 'business') => async () => {
    setError('');
    try { await signUpWithEmail(email, password, role); } catch (e) { setError((e as Error).message || t('error.generic')); }
  };
  return (
    <Screen title={t('auth.register')}>
      <Field placeholder={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field placeholder={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry />
      <Text style={{ color: theme.colors.cream, opacity: 0.7, marginBottom: 8 }}>{t('role.hint')}</Text>
      <ErrorText text={error} />
      <Button filled label={t('role.model')} onPress={go('model')} />
      <Button label={t('role.business')} onPress={go('business')} />
      <Link href="/(auth)/login" style={{ color: theme.colors.gold, textAlign: 'center', marginTop: 16 }}>
        {t('auth.haveAccount')}
      </Link>
      <LangSwitch />
    </Screen>
  );
}
