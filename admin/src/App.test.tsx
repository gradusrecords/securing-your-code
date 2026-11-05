import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const from = vi.fn();
vi.mock('./lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => from(...a), auth: { signOut: vi.fn(), signInWithPassword: vi.fn() } },
}));
const state = vi.fn();
vi.mock('./auth/useAdminSession', () => ({ useAdminSession: () => state() }));

import { App } from './App';

beforeEach(() => vi.clearAllMocks());

describe('App', () => {
  test('signed out: shows the login form and loads no data', () => {
    state.mockReturnValue({ status: 'signedOut' });
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Вход' })).toBeInTheDocument();
    expect(from).not.toHaveBeenCalled();
  });
  test('forbidden: shows the refusal and a sign-out button, loads no data', () => {
    state.mockReturnValue({ status: 'forbidden' });
    render(<App />);
    expect(screen.getByText('Нет доступа')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
    expect(from).not.toHaveBeenCalled();
  });
  test('admin: shows navigation for the seven sections', () => {
    state.mockReturnValue({ status: 'admin', email: 'boss@zaya.uz' });
    render(<App />);
    for (const name of ['Модели', 'Заказы', 'Вопросы', 'Развитие', 'Контент', 'Пользователи', 'Журнал']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });
});
