import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  completeTask,
  getProgress,
  getTodayTasks,
  type Progress,
  type TodayTask,
} from '../../src/services/developmentService';
import { Button, EmptyState, Screen } from '../../src/ui/kit';
import { currentLanguage, t } from '../../src/i18n';
import { theme } from '../../src/lib/theme';

export default function Development() {
  const [tasks, setTasks] = useState<TodayTask[] | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');
  const [announce, setAnnounce] = useState('');

  const load = useCallback(async () => {
    try {
      const lang = currentLanguage();
      const [tk, pr] = await Promise.all([getTodayTasks(lang), getProgress(lang)]);
      setTasks(tk);
      setProgress(pr);
    } catch {
      setError(t('error.generic'));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const done = async (id: string) => {
    setError('');
    setAnnounce('');
    try {
      const res = await completeTask(id);
      setTasks((prev) => prev?.map((x) => (x.assignment_id === id ? { ...x, completed: true } : x)) ?? prev);
      if (res.new_badges.length > 0) {
        setAnnounce(`${t('development.new_badge')}: ${res.new_badges.map((b) => t(`badge.${b}`)).join(', ')}`);
      }
      setProgress(await getProgress(currentLanguage()));
    } catch {
      setError(t('error.generic'));
    }
  };

  return (
    <Screen title={t('tab.development')}>
      <ScrollView>
        {progress ? (
          <View style={s.card}>
            <Text style={s.rank}>{progress.rank.name}</Text>
            <Text style={s.line}>{t('development.points')}: {progress.total_points}</Text>
            {progress.next_rank_points != null ? (
              <Text style={s.line}>{t('development.next')}: {progress.next_rank_points - progress.total_points}</Text>
            ) : null}
            <Text testID="streak" style={s.line}>{t('development.streak')}: {progress.streak}</Text>
            <View style={s.badges}>
              {progress.badges.map((b) => (
                <Text key={b} style={s.badge}>{t(`badge.${b}`)}</Text>
              ))}
            </View>
          </View>
        ) : null}
        {announce ? <Text style={s.announce}>{announce}</Text> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
        {tasks && tasks.length === 0 ? <EmptyState text={t('empty.development')} /> : null}
        {tasks?.map((tk) => (
          <View key={tk.assignment_id} style={s.task}>
            <Text style={s.title}>{tk.title}</Text>
            <Text style={s.line}>{tk.description}</Text>
            <Text style={s.points}>+{tk.points}</Text>
            {tk.completed ? (
              <Text style={s.doneText}>{t('development.done')}</Text>
            ) : (
              <Button testID={`done-${tk.assignment_id}`} label={t('development.done')} onPress={() => done(tk.assignment_id)} />
            )}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: theme.colors.gold, padding: 16, marginBottom: 16 },
  rank: { color: theme.colors.gold, fontSize: 24, marginBottom: 6 },
  line: { color: theme.colors.cream, opacity: 0.85 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  badge: { color: theme.colors.black, backgroundColor: theme.colors.gold, paddingHorizontal: 8, paddingVertical: 2, fontSize: 12 },
  announce: { color: theme.colors.gold, marginBottom: 8 },
  error: { color: '#E8A08A', marginBottom: 8 },
  task: { borderBottomWidth: 1, borderBottomColor: theme.colors.green2, paddingVertical: 12 },
  title: { color: theme.colors.cream, fontSize: 18 },
  points: { color: theme.colors.gold, marginTop: 4 },
  doneText: { color: theme.colors.gold, marginTop: 6 },
});
