jest.mock('../src/lib/supabase', () => {
  const order = jest.fn();
  return { supabase: { from: jest.fn(() => ({ select: () => ({ order }) })), __order: order } };
});
import { supabase } from '../src/lib/supabase';
import { listIdeas } from '../src/services/contentService';

const rows = [
  { id: '1', kind: 'pr', title: { ru: 'Заголовок', uz: 'Sarlavha', en: '' }, body: { ru: 'Текст', uz: '', en: '' }, sort: 1 },
  { id: '2', kind: 'motivation', title: { ru: 'Без стереотипов', uz: '', en: '' }, body: { ru: 'Работаем без границ', uz: '', en: '' }, sort: 2 },
];

test('listIdeas picks the language and falls back to Russian for empty translations', async () => {
  (supabase as any).__order.mockResolvedValue({ data: rows, error: null });
  const uz = await listIdeas('uz');
  expect(uz[0]).toEqual({ id: '1', kind: 'pr', title: 'Sarlavha', body: 'Текст' });
  expect(uz[1].title).toBe('Без стереотипов');
  expect((supabase as any).__order).toHaveBeenCalledWith('sort');
});

test('listIdeas throws the Supabase message on error', async () => {
  (supabase as any).__order.mockResolvedValue({ data: null, error: { message: 'denied' } });
  await expect(listIdeas('ru')).rejects.toThrow('denied');
});
