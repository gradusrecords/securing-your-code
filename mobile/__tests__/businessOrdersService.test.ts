jest.mock('../src/lib/supabase', () => {
  const eq = jest.fn();
  const select = jest.fn(() => ({ eq, then: undefined }));
  return { supabase: { rpc: jest.fn(), from: jest.fn(() => ({ select })), __select: select, __eq: eq } };
});

import { supabase } from '../src/lib/supabase';
import {
  askManager, cancelOrder, createOrder, listBusinessOrders, listConfirmedModels, selectModels, updateOrder,
} from '../src/services/businessOrdersService';
import { emptyBrief } from '../src/models/brief';

const m = supabase as any;
beforeEach(() => jest.clearAllMocks());

test('createOrder calls create_order and returns the id', async () => {
  m.rpc.mockResolvedValue({ data: 'o1', error: null });
  const b = emptyBrief();
  await expect(createOrder(b)).resolves.toBe('o1');
  expect(m.rpc).toHaveBeenCalledWith('create_order', { p_brief: b });
});

test('updateOrder returns the new version number', async () => {
  m.rpc.mockResolvedValue({ data: 2, error: null });
  await expect(updateOrder('o1', emptyBrief())).resolves.toBe(2);
  expect(m.rpc.mock.calls[0][0]).toBe('update_order');
  expect(m.rpc.mock.calls[0][1].p_order_id).toBe('o1');
});

test('cancelOrder and selectModels call their RPCs', async () => {
  m.rpc.mockResolvedValue({ error: null });
  await cancelOrder('o1');
  expect(m.rpc).toHaveBeenCalledWith('cancel_order', { p_order_id: 'o1' });
  await selectModels('o1', ['m1', 'm2']);
  expect(m.rpc).toHaveBeenCalledWith('select_models', { p_order_id: 'o1', p_model_ids: ['m1', 'm2'] });
});

test('listConfirmedModels filters by order id', async () => {
  m.__eq.mockResolvedValue({ data: [{ model_id: 'm1' }], error: null });
  await expect(listConfirmedModels('o1')).resolves.toEqual([{ model_id: 'm1' }]);
  expect(m.from).toHaveBeenCalledWith('order_confirmed_models');
  expect(m.__eq).toHaveBeenCalledWith('order_id', 'o1');
});

test('listBusinessOrders reads the business_orders view', async () => {
  m.__select.mockResolvedValueOnce({ data: [{ order_id: 'o1' }], error: null });
  await expect(listBusinessOrders()).resolves.toEqual([{ order_id: 'o1' }]);
  expect(m.from).toHaveBeenCalledWith('business_orders');
});

test('askManager rejects an empty message before calling the RPC', async () => {
  await expect(askManager('o1', '  ')).rejects.toThrow();
  expect(m.rpc).not.toHaveBeenCalled();
});

test('an RPC error becomes an Error', async () => {
  m.rpc.mockResolvedValue({ data: null, error: { message: 'order not found' } });
  await expect(cancelOrder('o1')).rejects.toThrow('order not found');
});
