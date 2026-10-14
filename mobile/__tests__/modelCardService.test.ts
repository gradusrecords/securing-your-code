jest.mock('../src/lib/supabase', () => {
  const upsert = jest.fn();
  const maybeSingle = jest.fn();
  const upload = jest.fn();
  return {
    supabase: {
      auth: { getUser: jest.fn() },
      from: jest.fn(() => ({ upsert, select: () => ({ eq: () => ({ maybeSingle }) }) })),
      storage: { from: jest.fn(() => ({ upload })) },
      __upsert: upsert,
      __maybeSingle: maybeSingle,
      __upload: upload,
    },
  };
});

import { supabase } from '../src/lib/supabase';
import { getMyCard, saveMyCard, uploadPhoto } from '../src/services/modelCardService';
import type { ModelCardInput } from '../src/models/modelCard';

const m = supabase as any;
const card: ModelCardInput = {
  full_name: 'A', birth_date: '2000-01-01', gender: 'female', city: 'Ташкент', phone: '+998901234567',
  telegram: '@a', height_cm: 170, experience: 'none', directions: ['show'], other_agency_contract: false, photos: ['p'],
};

beforeEach(() => {
  jest.clearAllMocks();
  m.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
});

test('saveMyCard upserts by the current user id and never sends moderation fields', async () => {
  m.__upsert.mockResolvedValue({ error: null });
  await saveMyCard(card);
  const [row, opts] = m.__upsert.mock.calls[0];
  expect(row.id).toBe('u1');
  expect(row).not.toHaveProperty('status');
  expect(row).not.toHaveProperty('review_comment');
  expect(opts).toEqual({ onConflict: 'id' });
});

test('saveMyCard throws an Error with the Supabase message', async () => {
  m.__upsert.mockResolvedValue({ error: { message: 'parent_contact is required for models under 18' } });
  await expect(saveMyCard(card)).rejects.toThrow('parent_contact is required');
});

test('getMyCard returns null when there is no card yet', async () => {
  m.__maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(getMyCard()).resolves.toBeNull();
});

test('uploadPhoto stores into <uid>/<file> of the model-photos bucket and returns the path', async () => {
  (globalThis as any).fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(4) });
  m.__upload.mockResolvedValue({ error: null });
  const path = await uploadPhoto('file:///x.jpg', 'x.jpg');
  expect(m.storage.from).toHaveBeenCalledWith('model-photos');
  expect(m.__upload.mock.calls[0][0]).toBe('u1/x.jpg');
  expect(path).toBe('u1/x.jpg');
});
