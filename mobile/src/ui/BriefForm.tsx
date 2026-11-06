import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PROJECT_TYPES, validateBrief, type BriefInput } from '../models/brief';
import { Button, Field } from './kit';
import { t } from '../i18n';
import { theme } from '../lib/theme';

type Spec = [section: keyof BriefInput, key: string, kind?: 'number' | 'multiline'];
const SPECS: Spec[] = [
  ['project', 'title'], ['project', 'description', 'multiline'], ['project', 'references'],
  ['when_where', 'date'], ['when_where', 'time'], ['when_where', 'duration'], ['when_where', 'city'], ['when_where', 'address'],
  ['who', 'count', 'number'], ['who', 'gender'], ['who', 'age'], ['who', 'height'], ['who', 'measurements'], ['who', 'hair'], ['who', 'eyes'], ['who', 'experience'],
  ['conditions', 'usage_rights'],
  ['requirements', 'dresscode'], ['requirements', 'makeup_stylist'], ['requirements', 'restrictions'],
  ['contact', 'name'], ['contact', 'phone'], ['contact', 'channel'],
];

export function BriefForm({ initial, submitLabel, onSubmit }: {
  initial: BriefInput; submitLabel: string; onSubmit: (b: BriefInput) => Promise<void>;
}) {
  const [brief, setBrief] = useState<BriefInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const get = (sec: keyof BriefInput, key: string): string => {
    const v = (brief[sec] as Record<string, unknown>)[key];
    return v == null || v === 0 ? '' : String(v);
  };
  const set = (sec: keyof BriefInput, key: string, kind?: string) => (text: string) =>
    setBrief((b) => ({ ...b, [sec]: { ...(b[sec] as object), [key]: kind === 'number' ? Number(text.replace(/\D/g, '')) : text } }));
  const toggle = (key: 'meals' | 'transfer') =>
    setBrief((b) => ({ ...b, conditions: { ...b.conditions, [key]: !b.conditions[key] } }));

  const submit = async () => {
    if (lock.current) return;
    setError('');
    const errs = validateBrief(brief);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    lock.current = true;
    setBusy(true);
    try {
      await onSubmit(brief);
    } catch {
      setError(t('error.generic'));
      lock.current = false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView>
      <Text style={s.label}>{t('brief.f.project.type')}</Text>
      <View style={s.chips}>
        {PROJECT_TYPES.map((p) => (
          <Pressable key={p} testID={`type-${p}`} onPress={() => setBrief((b) => ({ ...b, project: { ...b.project, type: p } }))}
            style={[s.chip, brief.project.type === p && s.chipOn]}>
            <Text style={[s.chipText, brief.project.type === p && s.chipTextOn]}>{t(`dir.${p}`)}</Text>
          </Pressable>
        ))}
      </View>
      {errors['project.type'] ? <Text testID="err-project.type" style={s.err}>{t(errors['project.type'])}</Text> : null}

      {SPECS.map(([sec, key, kind]) => {
        const id = `${sec}.${key}`;
        return (
          <View key={id}>
            {sec === 'contact' && key === 'name' ? <Text style={s.note}>{t('brief.contact')}</Text> : null}
            <Text style={s.label}>{t(`brief.f.${id}`)}</Text>
            <Field testID={`b-${sec}-${key}`} value={get(sec, key)} onChangeText={set(sec, key, kind)}
              keyboardType={kind === 'number' ? 'numeric' : 'default'} multiline={kind === 'multiline'} />
            {errors[id] ? <Text testID={`err-${id}`} style={s.err}>{t(errors[id])}</Text> : null}
          </View>
        );
      })}

      <View style={s.chips}>
        {(['meals', 'transfer'] as const).map((k) => (
          <Pressable key={k} testID={`cond-${k}`} onPress={() => toggle(k)} style={[s.chip, brief.conditions[k] && s.chipOn]}>
            <Text style={[s.chipText, brief.conditions[k] && s.chipTextOn]}>{t(`brief.f.conditions.${k}`)}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={s.err}>{error}</Text> : null}
      <Button filled testID="submit" label={submitLabel} onPress={submit} />
      {busy ? <Text style={s.note}>…</Text> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  label: { color: theme.colors.gold, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 12 },
  note: { color: theme.colors.cream, opacity: 0.7, marginTop: 16 },
  err: { color: '#E8A08A', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { borderWidth: 1, borderColor: theme.colors.gold, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: theme.colors.gold },
  chipText: { color: theme.colors.cream },
  chipTextOn: { color: theme.colors.black },
});
