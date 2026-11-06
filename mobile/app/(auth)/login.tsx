import { useState } from 'react';
import { Platform, Text } from 'react-native';
import { Link } from 'expo-router';
import { signInWithApple, signInWithEmail, signInWithGoogle } from '../../src/auth/authService';
import { Button, ErrorText, Field, LangSwitch, Screen } from '../../src/ui/kit';
import { t } from '../../src/i18n';
import { theme } from '../../src/lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const run = (fn: () => Promise<void>) => async () => {
    setError('');
    try { await fn(); } catch (e) { setError((e as Error).message || t('error.generic')); }
  };
  return (
    <Screen title={t('app.name')}>
      <Text style={{ color: theme.colors.cream, marginBottom: 24, fontStyle: 'italic' }}>{t('slogan')}</Text>
      <Field placeholder={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field placeholder={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry />
      <ErrorText text={error} />
      <Button filled label={t('auth.login')} onPress={run(() => signInWithEmail(email, password))} />
      <Button label={t('auth.google')} onPress={run(signInWithGoogle)} />
      {Platform.OS === 'ios' ? <Button label={t('auth.apple')} onPress={run(signInWithApple)} /> : null}
      <Link href="/(auth)/register" style={{ color: theme.colors.gold, textAlign: 'center', marginTop: 16 }}>
        {t('auth.noAccount')}
      </Link>
      <LangSwitch />
    </Screen>
  );
}
