import { toCatalogPayload } from '../src/catalog/payload';
import type { CatalogModel } from '../src/services/catalogService';

const mk = (id: string, over: Partial<CatalogModel> = {}): CatalogModel => ({
  model_id: id, display_name: `Name ${id}`, gender: 'female', height_cm: 170, directions: ['show', 'photo'],
  photos: [], agency_rating: 9, is_favorite: false, ...over,
});

test('an empty list gives empty arrays, not an error', () => {
  expect(toCatalogPayload([], {})).toEqual({ W: [], M: [], RW: [], RM: [] });
});

test('models are split by gender keeping order and ratings', () => {
  const p = toCatalogPayload([mk('a', { agency_rating: 10 }), mk('b', { gender: 'male', agency_rating: 8 }), mk('c', { agency_rating: 9 })], {});
  expect(p.W.map((r) => r[0])).toEqual(['Name a', 'Name c']);
  expect(p.M.map((r) => r[0])).toEqual(['Name b']);
  expect(p.RW).toEqual([10, 9]);
  expect(p.RM).toEqual([8]);
});

test('a missing rating defaults to 9', () => {
  expect(toCatalogPayload([mk('a', { agency_rating: null })], {}).RW).toEqual([9]);
});

test('unknown directions are dropped, known ones kept', () => {
  const p = toCatalogPayload([mk('a', { directions: ['show', 'teleport', 'ad'] })], {});
  expect(p.W[0][3]).toEqual(['show', 'ad']);
});

test('a row carries height, both names, descriptions and the signed photo urls', () => {
  const p = toCatalogPayload([mk('a', { height_cm: 175, agency_note: 'Reliable on set' } as never)], { a: ['u1', 'u2', 'u3', 'u4'] });
  const row = p.W[0];
  expect(row[1]).toBe('Name a');
  expect(row[2]).toBe(175);
  expect(row[5][0]).toBe('Reliable on set');
  expect(row[6]).toEqual(['u1', 'u2', 'u3']);
});

test('a missing note gets a neutral description', () => {
  const p = toCatalogPayload([mk('a')], {});
  expect(p.W[0][5][0].length).toBeGreaterThan(0);
  expect(p.W[0][4][0].length).toBeGreaterThan(0);
});
