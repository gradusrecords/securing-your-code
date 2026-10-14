import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  validateModelCard,
  type CardErrors,
  type Direction,
  type Experience,
  type ModelCardInput,
} from '../../src/models/modelCard';
import { getMyCard, saveMyCard, type StoredCard } from '../../src/services/modelCardService';
import { Button, Field, LangSwitch, Screen } from '../../src/ui/kit';
import { PhotoPicker } from '../../src/ui/PhotoPicker';
import { signOut } from '../../src/auth/authService';
import { t } from '../../src/i18n';
import { theme } from '../../src/lib/theme';

type Form = Record<string, string>;
const TEXT_FIELDS = ['full_name', 'display_name', 'birth_date', 'city', 'phone', 'telegram', 'instagram', 'parent_contact',
  'height_cm', 'weight_kg', 'bust_cm', 'waist_cm', 'hips_cm', 'shoe_size', 'hair', 'eyes', 'portfolio_url', 'about'] as const;
const NUMERIC = ['height_cm', 'weight_kg', 'bust_cm', 'waist_cm', 'hips_cm'];
const EXPERIENCES: Experience[] = ['none', 'under_1', '1_3', 'over_3'];
const DIRECTIONS: Direction[] = ['show', 'photo', 'ad', 'clip', 'promo'];

function toInput(f: Form, extra: Pick<ModelCardInput, 'gender' | 'experience' | 'directions' | 'other_agency_contract' | 'photos'>): ModelCardInput {
  const num = (k: string) => (f[k]?.trim() ? Number(f[k]) : undefined);
  const str = (k: string) => (f[k]?.trim() ? f[k].trim() : undefined);
  return {
    full_name: f.full_name ?? '',
    display_name: str('display_name'),
    birth_date: f.birth_date ?? '',
    city: f.city ?? '',
    phone: f.phone ?? '',
    telegram: f.telegram ?? '',
    instagram: str('instagram'),
    parent_contact: str('parent_contact'),
    height_cm: Number(f.height_cm),
    weight_kg: num('weight_kg'),
    bust_cm: num('bust_cm'),
    waist_cm: num('waist_cm'),
    hips_cm: num('hips_cm'),
    shoe_size: str('shoe_size'),
    hair: str('hair'),
    eyes: str('eyes'),
    portfolio_url: str('portfolio_url'),
    about: str('about'),
    ...extra,
  };
}

export default function Profile() {
  const [form, setForm] = useState<Form>({ city: 'Ташкент', phone: '+998' });
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [experience, setExperience] = useState<Experience>('none');
  const [directions, setDirections] = useState<Direction[]>([]);
  const [contract, setContract] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [errors, setErrors] = useState<CardErrors>({});
  const [status, setStatus] = useState<StoredCard['status'] | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getMyCard()
      .then((c) => {
        if (!c) return;
        const f: Form = {};
        TEXT_FIELDS.forEach((k) => { const v = (c as unknown as Record<string, unknown>)[k]; if (v != null) f[k] = String(v); });
        setForm(f);
        setGender(c.gender);
        setExperience(c.experience);
        setDirections(c.directions);
        setContract(c.other_agency_contract);
        setPhotos(c.photos);
        setStatus(c.status);
        setComment(c.review_comment);
      })
      .catch(() => setNotice(t('error.generic')));
  }, []);

  const set = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const toggleDirection = (d: Direction) =>
    setDirections((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  const save = async () => {
    setNotice('');
    const input = toInput(form, { gender, experience, directions, other_agency_contract: contract, photos });
    const errs = validateModelCard(input, new Date());
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      await saveMyCard(input);
      setStatus('pending');
      setNotice(t('profile.saved'));
    } catch (e) {
      setNotice((e as Error).message || t('error.generic'));
    }
  };

  const fieldErr = (k: keyof ModelCardInput) =>
    errors[k] ? <Text testID={`err-${k}`} style={s.err}>{t(errors[k] as string)}</Text> : null;

  return (
    <Screen>
      <ScrollView>
        {status ? (
          <View style={s.banner}>
            <Text style={s.bannerText}>{t(`status.${status}`)}</Text>
            {status === 'returned' && comment ? <Text style={s.bannerText}>{comment}</Text> : null}
          </View>
        ) : null}

        {TEXT_FIELDS.map((k) => (
          <View key={k}>
            <Text style={s.label}>{t(`profile.${k}`)}</Text>
            <Field
              testID={`f-${k}`}
              value={form[k] ?? ''}
              onChangeText={set(k)}
              keyboardType={NUMERIC.includes(k) ? 'numeric' : 'default'}
              multiline={k === 'about'}
            />
            {fieldErr(k)}
          </View>
        ))}

        <Chips label={t('profile.gender')} options={['female', 'male']} selected={[gender]} render={(o) => t(`gender.${o}`)} onPick={(o) => setGender(o as 'female' | 'male')} />
        <Chips label={t('profile.experience')} options={EXPERIENCES} selected={[experience]} render={(o) => t(`exp.${o}`)} onPick={(o) => setExperience(o as Experience)} />
        <Chips label={t('profile.directions')} options={DIRECTIONS} selected={directions} render={(o) => t(`dir.${o}`)} onPick={(o) => toggleDirection(o as Direction)} />
        {fieldErr('directions')}
        <Chips label={t('profile.contract')} options={['yes']} selected={contract ? ['yes'] : []} render={() => t('profile.contract')} onPick={() => setContract((v) => !v)} />

        <PhotoPicker photos={photos} onChange={setPhotos} />
        {fieldErr('photos')}

        {notice ? <Text style={notice === t('profile.saved') ? s.ok : s.err}>{notice}</Text> : null}
        <Button filled testID="save" label={t('profile.save')} onPress={save} />
        <Button label={t('auth.logout')} onPress={() => { void signOut(); }} />
        <LangSwitch />
      </ScrollView>
    </Screen>
  );
}

function Chips({ label, options, selected, render, onPick }: {
  label: string; options: string[]; selected: string[]; render: (o: string) => string; onPick: (o: string) => void;
}) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <View style={s.chips}>
        {options.map((o) => (
          <Pressable key={o} onPress={() => onPick(o)} style={[s.chip, selected.includes(o) && s.chipOn]}>
            <Text style={[s.chipText, selected.includes(o) && s.chipTextOn]}>{render(o)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: { color: theme.colors.gold, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 12 },
  err: { color: '#E8A08A', marginBottom: 6 },
  ok: { color: theme.colors.gold, marginVertical: 8 },
  banner: { borderWidth: 1, borderColor: theme.colors.gold, padding: 12, marginBottom: 12 },
  bannerText: { color: theme.colors.cream },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { borderWidth: 1, borderColor: theme.colors.gold, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: theme.colors.gold },
  chipText: { color: theme.colors.cream },
  chipTextOn: { color: theme.colors.black },
});
