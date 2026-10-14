jest.mock('../src/lib/supabase', () => {
  const upsert = jest.fn();
  const maybeSingle = jest.fn();
  return {
    supabase: {
      auth: { getUser: jest.fn() },
      from: jest.fn(() => ({ upsert, select: () => ({ eq: () => ({ maybeSingle }) }) })),
      __upsert: upsert, __maybeSingle: maybeSingle,
    },
  };
});
import { supabase } from '../src/lib/supabase';
import { getMyBusinessProfile, saveMyBusinessProfile } from '../src/services/businessProfileService';

const m = supabase as any;
beforeEach(() => { jest.clearAllMocks(); m.auth.getUser.mockResolvedValue({ data: { user: { id: 'b1' } } }); });

test('save upserts by the current user id', async () => {
  m.__upsert.mockResolvedValue({ error: null });
  await saveMyBusinessProfile({ full_name: 'Aziz', phone: '+998901234567' });
  expect(m.__upsert.mock.calls[0][0]).toMatchObject({ id: 'b1', full_name: 'Aziz' });
  expect(m.__upsert.mock.calls[0][1]).toEqual({ onConflict: 'id' });
});
test('save throws the Supabase message', async () => {
  m.__upsert.mockResolvedValue({ error: { message: 'boom' } });
  await expect(saveMyBusinessProfile({ full_name: 'A', phone: '+998901234567' })).rejects.toThrow('boom');
});
test('get returns null when no profile exists', async () => {
  m.__maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(getMyBusinessProfile()).resolves.toBeNull();
});
