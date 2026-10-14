import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/models', () => ({ listModels: vi.fn(), reviewModel: vi.fn(), saveCatalogEntry: vi.fn() }));
import * as api from '../api/models';
import { ModelsPage } from './ModelsPage';

const a = api as unknown as { listModels: ReturnType<typeof vi.fn>; reviewModel: ReturnType<typeof vi.fn>; saveCatalogEntry: ReturnType<typeof vi.fn> };

const model = (id: string, over = {}) => ({
  model_id: id, full_name: `Name ${id}`, display_name: null, gender: 'female', city: 'Ташкент', phone: '+998900000001',
  telegram: '@t', instagram: null, birth_date: '2000-01-01', parent_contact: null, height_cm: 170, experience: 'none',
  directions: ['show'], photos: [], status: 'pending', review_comment: null, agency_rating: null, agency_note: null,
  is_published: false, created_at: '2026-10-01', ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  a.listModels.mockResolvedValue([model('ok1', { status: 'approved' }), model('p1')]);
});

describe('ModelsPage', () => {
  test('pending cards come first and show contacts', async () => {
    render(<ModelsPage />);
    const rows = await screen.findAllByTestId(/^model-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'model-p1');
    expect(screen.getAllByText(/\+998900000001/).length).toBeGreaterThan(0);
  });

  test('returning without a comment does not call the API', async () => {
    render(<ModelsPage />);
    await screen.findByTestId('model-p1');
    await userEvent.click(screen.getByTestId('return-p1'));
    expect(a.reviewModel).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Укажите комментарий');
  });

  test('approving calls the API and removes the card from the queue', async () => {
    a.reviewModel.mockResolvedValue(undefined);
    render(<ModelsPage />);
    await screen.findByTestId('model-p1');
    await userEvent.click(screen.getByTestId('approve-p1'));
    await waitFor(() => expect(a.reviewModel).toHaveBeenCalledWith('p1', 'approved', undefined));
    await waitFor(() => expect(screen.queryByTestId('approve-p1')).toBeNull());
  });

  test('a failed approval keeps the card and shows the error', async () => {
    a.reviewModel.mockRejectedValue(new Error('denied'));
    render(<ModelsPage />);
    await screen.findByTestId('model-p1');
    await userEvent.click(screen.getByTestId('approve-p1'));
    expect(await screen.findByRole('alert')).toHaveTextContent('denied');
    expect(screen.getByTestId('approve-p1')).toBeInTheDocument();
  });

  test('a rating outside 0..10 is not saved', async () => {
    render(<ModelsPage />);
    await screen.findByTestId('model-ok1');
    const input = screen.getByTestId('rating-ok1');
    await userEvent.clear(input);
    await userEvent.type(input, '11');
    await userEvent.click(screen.getByTestId('save-ok1'));
    expect(a.saveCatalogEntry).not.toHaveBeenCalled();
  });

  test('the favourite button saves rating 10', async () => {
    a.saveCatalogEntry.mockResolvedValue(undefined);
    render(<ModelsPage />);
    await screen.findByTestId('model-ok1');
    await userEvent.click(screen.getByTestId('fav-ok1'));
    await waitFor(() => expect(a.saveCatalogEntry).toHaveBeenCalledWith('ok1', expect.objectContaining({ agency_rating: 10 })));
  });
});
