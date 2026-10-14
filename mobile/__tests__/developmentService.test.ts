jest.mock('../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

import { supabase } from '../src/lib/supabase';
import { completeTask, getProgress, getTodayTasks } from '../src/services/developmentService';

const rpc = supabase.rpc as jest.Mock;
beforeEach(() => jest.clearAllMocks());

test('getTodayTasks picks the requested language', async () => {
  rpc.mockResolvedValue({
    data: [{ assignment_id: 'a1', title: { ru: 'Пост', uz: 'Post', en: 'Post EN' }, description: { ru: 'Опишите', uz: 'Tavsif', en: 'Describe' }, points: 5, completed: false }],
    error: null,
  });
  const tasks = await getTodayTasks('uz');
  expect(rpc).toHaveBeenCalledWith('get_today_tasks');
  expect(tasks).toEqual([{ assignment_id: 'a1', title: 'Post', description: 'Tavsif', points: 5, completed: false }]);
});

test('getTodayTasks falls back to ru when the translation is missing or empty', async () => {
  rpc.mockResolvedValue({
    data: [{ assignment_id: 'a1', title: { ru: 'Пост', uz: '', en: '' }, description: { ru: 'Опишите' }, points: 3, completed: true }],
    error: null,
  });
  const [t] = await getTodayTasks('en');
  expect(t.title).toBe('Пост');
  expect(t.description).toBe('Опишите');
});

test('completeTask calls the RPC with p_assignment_id and returns the result', async () => {
  rpc.mockResolvedValue({ data: { points_awarded: 5, total_points: 5, streak: 1, new_badges: ['first_task'] }, error: null });
  await expect(completeTask('a1')).resolves.toEqual({ points_awarded: 5, new_badges: ['first_task'] });
  expect(rpc).toHaveBeenCalledWith('complete_task', { p_assignment_id: 'a1' });
});

test('an RPC error becomes an Error', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'not your assignment' } });
  await expect(completeTask('a1')).rejects.toThrow('not your assignment');
});

test('getProgress localises the rank name', async () => {
  rpc.mockResolvedValue({
    data: { total_points: 120, rank: { id: 2, name: { ru: 'Восходящая звезда', en: 'Rising star' } }, next_rank_points: 300, streak: 3, badges: ['first_task'] },
    error: null,
  });
  const p = await getProgress('en');
  expect(p.rank).toEqual({ id: 2, name: 'Rising star' });
  expect(p.streak).toBe(3);
  expect(p.next_rank_points).toBe(300);
});
