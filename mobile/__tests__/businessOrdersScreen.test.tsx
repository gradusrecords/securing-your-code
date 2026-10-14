const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('../src/services/businessProfileService', () => ({ getMyBusinessProfile: jest.fn() }));
jest.mock('../src/services/businessOrdersService', () => ({
  listBusinessOrders: jest.fn(),
  listConfirmedModels: jest.fn(),
  createOrder: jest.fn(),
  updateOrder: jest.fn(),
  cancelOrder: jest.fn(),
  selectModels: jest.fn(),
  askManager: jest.fn(),
}));

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as svc from '../src/services/businessOrdersService';
import { getMyBusinessProfile } from '../src/services/businessProfileService';
import { t } from '../src/i18n';
import OrdersList from '../app/(business)/orders/index';
import NewOrder from '../app/(business)/orders/new';
import OrderDetail from '../app/(business)/orders/[id]';

const s = svc as jest.Mocked<typeof svc>;
const profile = getMyBusinessProfile as jest.Mock;

const brief: any = {
  project: { title: 'Summer shoot', type: 'photo' }, when_where: { date: '2026-12-01', city: 'Ташкент' },
  who: { count: 2 }, conditions: {}, requirements: {}, contact: { name: 'Aziz', phone: '+998901234567' },
};
const order = { order_id: 'o1', status: 'open', version: 1, pending_version: 2, brief, review_status: 'pending', confirmed_count: 2, selected_count: 0, created_at: '2026-10-01' };
const models = [
  { order_id: 'o1', model_id: 'm1', display_name: 'Aziza', gender: 'female', height_cm: 175, photos: [], agency_rating: 10, is_favorite: true, is_selected: false },
  { order_id: 'o1', model_id: 'm2', display_name: 'Dilnoza', gender: 'female', height_cm: 170, photos: [], agency_rating: 9, is_favorite: false, is_selected: false },
];

const fill = async () => {
  await fireEvent.changeText(screen.getByTestId('b-project-title'), 'Summer shoot');
  await fireEvent.press(screen.getByTestId('type-photo'));
  await fireEvent.changeText(screen.getByTestId('b-when_where-date'), '2026-12-01');
  await fireEvent.changeText(screen.getByTestId('b-when_where-city'), 'Ташкент');
  await fireEvent.changeText(screen.getByTestId('b-who-count'), '2');
  await fireEvent.changeText(screen.getByTestId('b-contact-name'), 'Aziz');
  await fireEvent.changeText(screen.getByTestId('b-contact-phone'), '+998901234567');
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  profile.mockResolvedValue({ full_name: 'Aziz', phone: '+998901234567' });
  s.listBusinessOrders.mockResolvedValue([order]);
  s.listConfirmedModels.mockResolvedValue(models as never);
});

test('the list shows status, confirmed count and the pending-changes label', async () => {
  await render(<OrdersList />);
  expect(await screen.findByText('Summer shoot')).toBeTruthy();
  expect(screen.getByText(t('orders.pending_changes'))).toBeTruthy();
  expect(screen.getByTestId('confirmed-o1').props.children.join('')).toContain('2');
});

test('without a business profile creating an order shows a hint and does not navigate', async () => {
  profile.mockResolvedValue(null);
  await render(<OrdersList />);
  await screen.findByText('Summer shoot');
  await fireEvent.press(screen.getByTestId('create'));
  expect(await screen.findByText(t('orders.fill_profile'))).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
});

test('an empty brief shows errors and does not call createOrder', async () => {
  await render(<NewOrder />);
  await fireEvent.press(screen.getByTestId('submit'));
  expect(await screen.findByTestId('err-project.title')).toBeTruthy();
  expect(s.createOrder).not.toHaveBeenCalled();
});

test('pressing submit twice creates the order once', async () => {
  let resolve: (v: string) => void = () => {};
  s.createOrder.mockReturnValue(new Promise<string>((r) => { resolve = r; }));
  await render(<NewOrder />);
  await fill();
  const submit = screen.getByTestId('submit');
  await act(async () => {
    void fireEvent.press(submit);
    void fireEvent.press(submit);
  });
  expect(s.createOrder).toHaveBeenCalledTimes(1);
  await act(async () => { resolve('o9'); });
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
});

test('a network error keeps the typed data and shows the generic error', async () => {
  s.createOrder.mockRejectedValue(new Error(''));
  await render(<NewOrder />);
  await fill();
  await fireEvent.press(screen.getByTestId('submit'));
  expect(await screen.findByText(t('error.generic'))).toBeTruthy();
  expect(screen.getByDisplayValue('Summer shoot')).toBeTruthy();
});

test('the order screen lists confirmed models without contacts and sends the selection', async () => {
  mockParams = { id: 'o1' };
  s.selectModels.mockResolvedValue(undefined);
  await render(<OrderDetail />);
  expect(await screen.findByText(/Aziza/)).toBeTruthy();
  expect(screen.queryByText(/\+998/)).toBeNull();
  await fireEvent.press(screen.getByTestId('pick-m1'));
  await fireEvent.press(screen.getByTestId('send-selection'));
  await waitFor(() => expect(s.selectModels).toHaveBeenCalledWith('o1', ['m1']));
});

test('cancelling needs a second confirming press', async () => {
  mockParams = { id: 'o1' };
  s.cancelOrder.mockResolvedValue(undefined);
  await render(<OrderDetail />);
  await screen.findByText(/Aziza/);
  await fireEvent.press(screen.getByTestId('cancel'));
  expect(s.cancelOrder).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('cancel-confirm'));
  await waitFor(() => expect(s.cancelOrder).toHaveBeenCalledWith('o1'));
});

test('the business cannot tick more models than the brief asks for', async () => {
  mockParams = { id: 'o1' };
  s.listBusinessOrders.mockResolvedValue([{ ...order, brief: { ...brief, who: { count: 1 } } }]);
  s.selectModels.mockResolvedValue(undefined);
  await render(<OrderDetail />);
  await screen.findByText(/Aziza/);
  await fireEvent.press(screen.getByTestId('pick-m1'));
  await fireEvent.press(screen.getByTestId('pick-m2'));
  expect(await screen.findByText(t('orders.select_limit', { n: 1 }))).toBeTruthy();
  await fireEvent.press(screen.getByTestId('send-selection'));
  await waitFor(() => expect(s.selectModels).toHaveBeenCalledWith('o1', ['m1']));
});
