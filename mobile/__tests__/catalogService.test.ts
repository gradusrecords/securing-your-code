jest.mock('../src/lib/supabase', () => {
  const select = jest.fn();
  return { supabase: { from: jest.fn(() => ({ select })), __select: select } };
});
import { supabase } from '../src/lib/supabase';
import { filterCatalog, listCatalog, type CatalogModel } from '../src/services/catalogService';

const mk = (id: string, over: Partial<CatalogModel> = {}): CatalogModel => ({
  model_id: id, display_name: id, gender: 'female', height_cm: 170, directions: [], photos: [], agency_rating: 9, is_favorite: false, ...over,
});

test('listCatalog reads public_model_cards', async () => {
  (supabase as any).__select.mockResolvedValue({ data: [mk('a')], error: null });
  await expect(listCatalog()).resolves.toEqual([mk('a')]);
  expect((supabase as any).from).toHaveBeenCalledWith('public_model_cards');
});

test('listCatalog throws the Supabase message on error', async () => {
  (supabase as any).__select.mockResolvedValue({ data: null, error: { message: 'nope' } });
  await expect(listCatalog()).rejects.toThrow('nope');
});

test('filterCatalog by gender and favourites', () => {
  const list = [mk('a'), mk('b', { gender: 'male' }), mk('c', { is_favorite: true })];
  expect(filterCatalog(list, { gender: 'male' }).map((m) => m.model_id)).toEqual(['b']);
  expect(filterCatalog(list, { favoriteOnly: true }).map((m) => m.model_id)).toEqual(['c']);
  expect(filterCatalog(list, {}).length).toBe(3);
});
