jest.mock('../src/services/ordersService', () => ({
  ...jest.requireActual('../src/services/ordersService'),
  listMyOrders: jest.fn(),
  respondToOrder: jest.fn(),
  askQuestion: jest.fn(),
}));
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'o1' }),
}));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { askQuestion, listMyOrders, respondToOrder } from '../src/services/ordersService';
import { t } from '../src/i18n';
import OrdersList from '../app/(model)/orders/index';
import OrderDetail from '../app/(model)/orders/[id]';

const list = listMyOrders as jest.Mock;
const respond = respondToOrder as jest.Mock;
const ask = askQuestion as jest.Mock;

const order = {
  order_id: 'o1', version: 2, status: 'open', changes: null, my_response: 'needs_reconfirm', updated_flag: true,
  brief: { project: { title: 'Summer shoot' }, when_where: { city: 'Tashkent' } },
};

beforeEach(() => {
  jest.clearAllMocks();
  list.mockResolvedValue([order]);
});

test('the list marks an updated order', async () => {
  await render(<OrdersList />);
  expect(await screen.findByText(t('orders.updated'))).toBeTruthy();
  expect(screen.getByText('Summer shoot')).toBeTruthy();
});

test('the list has New, Mine and Archive tabs', async () => {
  await render(<OrdersList />);
  await screen.findByText('Summer shoot');
  expect(screen.getByTestId('tab-new')).toBeTruthy();
  expect(screen.getByTestId('tab-mine')).toBeTruthy();
  expect(screen.getByTestId('tab-archive')).toBeTruthy();
});

test('the detail shows brief sections but never a contact', async () => {
  await render(<OrderDetail />);
  expect(await screen.findByText(/Summer shoot/)).toBeTruthy();
  expect(screen.queryByText(/contact/i)).toBeNull();
  expect(screen.getByTestId('confirm')).toBeTruthy();
  expect(screen.getByTestId('decline')).toBeTruthy();
});

test('confirming calls respondToOrder and shows the confirmed state', async () => {
  respond.mockResolvedValue(undefined);
  await render(<OrderDetail />);
  await screen.findByText(/Summer shoot/);
  await fireEvent.press(screen.getByTestId('confirm'));
  await waitFor(() => expect(respond).toHaveBeenCalledWith('o1', true));
  expect(await screen.findByText(t('orders.state_confirmed'))).toBeTruthy();
});

test('a failed response keeps the old state and shows an error', async () => {
  respond.mockRejectedValue(new Error(''));
  await render(<OrderDetail />);
  await screen.findByText(/Summer shoot/);
  await fireEvent.press(screen.getByTestId('confirm'));
  expect(await screen.findByText(t('error.generic'))).toBeTruthy();
  expect(screen.queryByText(t('orders.state_confirmed'))).toBeNull();
});

test('a question is sent to the manager', async () => {
  ask.mockResolvedValue(undefined);
  await render(<OrderDetail />);
  await screen.findByText(/Summer shoot/);
  await fireEvent.changeText(screen.getByTestId('question'), 'Is parking available?');
  await fireEvent.press(screen.getByTestId('send-question'));
  await waitFor(() => expect(ask).toHaveBeenCalledWith('o1', 'Is parking available?'));
  expect(await screen.findByText(t('orders.question_sent'))).toBeTruthy();
});
