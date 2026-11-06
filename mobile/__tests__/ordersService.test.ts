jest.mock('../src/lib/supabase', () => {
  const select = jest.fn();
  return { supabase: { rpc: jest.fn(), from: jest.fn(() => ({ select })), __select: select } };
});

import { supabase } from '../src/lib/supabase';
import { askQuestion, groupOrders, listMyOrders, respondToOrder, type ModelOrder } from '../src/services/ordersService';

const m = supabase as any;
const o = (id: string, over: Partial<ModelOrder> = {}): ModelOrder => ({
  order_id: id, version: 1, status: 'open', brief: {}, changes: null, my_response: null, updated_flag: false, ...over,
});

beforeEach(() => jest.clearAllMocks());

test('groupOrders: no answer or needs_reconfirm is New', () => {
  const g = groupOrders([o('a'), o('b', { my_response: 'needs_reconfirm', updated_flag: true })]);
  expect(g.new.map((x) => x.order_id)).toEqual(['a', 'b']);
  expect(g.mine).toEqual([]);
  expect(g.archive).toEqual([]);
});

test('groupOrders: confirmed and active is Mine', () => {
  const g = groupOrders([o('a', { my_response: 'confirmed' }), o('b', { my_response: 'confirmed', status: 'selected' })]);
  expect(g.mine.map((x) => x.order_id)).toEqual(['a', 'b']);
});

test('groupOrders: declined, completed and cancelled go to Archive', () => {
  const g = groupOrders([
    o('a', { my_response: 'declined' }),
    o('b', { my_response: 'confirmed', status: 'completed' }),
    o('c', { status: 'cancelled' }),
    o('d', { my_response: 'needs_reconfirm', status: 'completed' }),
  ]);
  expect(g.archive.map((x) => x.order_id)).toEqual(['a', 'b', 'c', 'd']);
  expect(g.new).toEqual([]);
  expect(g.mine).toEqual([]);
});

test('listMyOrders reads the model_order_cards view', async () => {
  m.__select.mockResolvedValue({ data: [o('a')], error: null });
  await expect(listMyOrders()).resolves.toEqual([o('a')]);
  expect(m.from).toHaveBeenCalledWith('model_order_cards');
});

test('respondToOrder calls respond_to_order', async () => {
  m.rpc.mockResolvedValue({ error: null });
  await respondToOrder('o1', true);
  expect(m.rpc).toHaveBeenCalledWith('respond_to_order', { p_order_id: 'o1', p_confirm: true });
});

test('askQuestion rejects an empty body before calling the RPC', async () => {
  await expect(askQuestion('o1', '   ')).rejects.toThrow();
  expect(m.rpc).not.toHaveBeenCalled();
});

test('askQuestion sends a trimmed body', async () => {
  m.rpc.mockResolvedValue({ data: 'q1', error: null });
  await askQuestion('o1', '  Is parking available? ');
  expect(m.rpc).toHaveBeenCalledWith('ask_question', { p_order_id: 'o1', p_body: 'Is parking available?' });
});
