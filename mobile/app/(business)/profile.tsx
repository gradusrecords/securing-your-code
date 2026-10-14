import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { validateBusinessProfile, type BusinessProfileErrors, type BusinessProfileInput } from '../../src/models/businessProfile';
import { getMyBusinessProfile, saveMyBusinessProfile } from '../../src/services/businessProfileService';
import { Button, Field, LangSwitch, Screen } from '../../src/ui/kit';
import { signOut } from '../../src/auth/authService';
import { t } from '../../src/i18n';
import { theme } from '../../src/lib/theme';

const FIELDS = ['full_name', 'company', 'position', 'phone', 'telegram', 'email', 'city', 'industry'] as const;

export default function BusinessProfile() {
  const [form, setForm] = useState<Record<string, string>>({ phone: '+998', city: 'Ташкент' });
  const [errors, setErrors] = useState<BusinessProfileErrors>({});
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getMyBusinessProfile()
      .then((p) => {
        if (!p) return;
        const f: Record<string, string> = {};
        FIELDS.forEach((k) => { const v = p[k]; if (v != null) f[k] = String(v); });
        setForm(f);
      })
      .catch(() => setNotice(t('error.generic')));
  }, []);

  const save = async () => {
    setNotice('');
    setSaved(false);
    const input: BusinessProfileInput = {
      full_name: form.full_name ?? '',
      company: form.company?.trim() || undefined,
      position: form.position?.trim() || undefined,
      phone: form.phone ?? '',
      telegram: form.telegram?.trim() || undefined,
      email: form.email?.trim() || undefined,
      city: form.city?.trim() || undefined,
      industry: form.industry?.trim() || undefined,
    };
    const errs = validateBusinessProfile(input);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      await saveMyBusinessProfile(input);
      setSaved(true);
    } catch (e) {
      setNotice((e as Error).message || t('error.generic'));
    }
  };

  return (
    <Screen title={t('tab.profile')}>
      <ScrollView>
        {FIELDS.map((k) => (
          <View key={k}>
            <Text style={s.label}>{t(`bprofile.${k}`)}</Text>
            <Field testID={`f-${k}`} value={form[k] ?? ''} onChangeText={(v) => setForm((p) => ({ ...p, [k]: v }))} />
            {errors[k] ? <Text testID={`err-${k}`} style={s.err}>{t(errors[k] as string)}</Text> : null}
          </View>
        ))}
        {saved ? <Text style={s.ok}>{t('profile.saved')}</Text> : null}
        {notice ? <Text style={s.err}>{notice}</Text> : null}
        <Button filled testID="save" label={t('profile.save')} onPress={save} />
        <Button label={t('auth.logout')} onPress={() => { void signOut(); }} />
        <LangSwitch />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { color: theme.colors.gold, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 12 },
  err: { color: '#E8A08A', marginBottom: 6 },
  ok: { color: theme.colors.gold, marginVertical: 8 },
});
