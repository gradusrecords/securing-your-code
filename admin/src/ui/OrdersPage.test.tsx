import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/orders', () => ({
  listOrders: vi.fn(), suggestRecipients: vi.fn(), approveOrder: vi.fn(), returnOrder: vi.fn(),
  finalizeSelection: vi.fn(), completeOrder: vi.fn(), cancelOrder: vi.fn(),
}));
import * as api from '../api/orders';
import { OrdersPage } from './OrdersPage';

const a = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const order = (id: string, over = {}) => ({
  order_id: id, business_name: 'Biz', company: 'Co', status: 'in_review', version: 1, pending_version: 1, review_status: 'pending',
  project_title: `Order ${id}`, project_type: 'photo', created_at: '2026-10-01', confirmed_count: 0, selected_count: 0, finalized_count: 0, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  a.listOrders.mockResolvedValue([order('o1'), order('o2', { status: 'selected', pending_version: null, review_status: 'approved', selected_count: 1 }), order('o3', { status: 'open', pending_version: null, review_status: 'approved' })]);
  a.suggestRecipients.mockResolvedValue([{ model_id: 'm1', display_name: 'Aziza', gender: 'female', height_cm: 175, score: 7 }]);
});

describe('OrdersPage', () => {
  test('approving is blocked until a recipient is ticked, then sends the ticked ids', async () => {
    a.approveOrder.mockResolvedValue(undefined);
    render(<OrdersPage />);
    await userEvent.click(await screen.findByTestId('review-o1'));
    const approve = await screen.findByTestId('approve-o1');
    expect(approve).toBeDisabled();
    await userEvent.click(await screen.findByLabelText(/Aziza/));
    expect(approve).toBeEnabled();
    await userEvent.click(approve);
    await waitFor(() => expect(a.approveOrder).toHaveBeenCalledWith('o1', ['m1']));
  });

  test('returning needs a comment', async () => {
    render(<OrdersPage />);
    await userEvent.click(await screen.findByTestId('review-o1'));
    await userEvent.click(await screen.findByTestId('return-o1'));
    expect(a.returnOrder).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Укажите комментарий');
  });

  test('finalize is offered only for selected orders', async () => {
    render(<OrdersPage />);
    await screen.findByTestId('order-o1');
    expect(screen.getByTestId('finalize-o2')).toBeInTheDocument();
    expect(screen.queryByTestId('finalize-o3')).toBeNull();
    expect(screen.queryByTestId('finalize-o1')).toBeNull();
  });

  test('cancelling needs a second confirming click', async () => {
    a.cancelOrder.mockResolvedValue(undefined);
    render(<OrdersPage />);
    await screen.findByTestId('order-o3');
    await userEvent.click(screen.getByTestId('cancel-o3'));
    expect(a.cancelOrder).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('cancel-confirm-o3'));
    await waitFor(() => expect(a.cancelOrder).toHaveBeenCalledWith('o3'));
  });

  test('a failed action shows the error and keeps the order', async () => {
    a.finalizeSelection.mockRejectedValue(new Error('nope'));
    render(<OrdersPage />);
    await userEvent.click(await screen.findByTestId('finalize-o2'));
    expect(await screen.findByRole('alert')).toHaveTextContent('nope');
    expect(screen.getByTestId('finalize-o2')).toBeInTheDocument();
  });
});
