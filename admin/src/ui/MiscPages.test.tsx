import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/questions', () => ({ listQuestions: vi.fn(), answerQuestion: vi.fn() }));
vi.mock('../api/development', () => ({ listTasks: vi.fn(), saveTask: vi.fn(), listRanks: vi.fn(), saveRank: vi.fn() }));
vi.mock('../api/content', () => ({ listContent: vi.fn(), saveContent: vi.fn() }));
vi.mock('../api/users', () => ({ listUsers: vi.fn(), setBlocked: vi.fn() }));
vi.mock('../api/audit', () => ({ listAudit: vi.fn() }));

import * as q from '../api/questions';
import * as d from '../api/development';
import * as c from '../api/content';
import * as u from '../api/users';
import * as au from '../api/audit';
import { QuestionsPage } from './QuestionsPage';
import { DevelopmentPage } from './DevelopmentPage';
import { ContentPage } from './ContentPage';
import { UsersPage } from './UsersPage';
import { AuditPage } from './AuditPage';

type M = Record<string, ReturnType<typeof vi.fn>>;
const Q = q as unknown as M, D = d as unknown as M, C = c as unknown as M, U = u as unknown as M, A = au as unknown as M;

beforeEach(() => vi.clearAllMocks());

describe('QuestionsPage', () => {
  const qs = [
    { question_id: 'q1', author_id: 'b', author_role: 'business', author_name: 'Biz', order_id: null, body: 'Parking?', answer: null, answered_at: null, created_at: '2026-10-02' },
    { question_id: 'q0', author_id: 'm', author_role: 'model', author_name: 'Model', order_id: null, body: 'Dress code?', answer: 'Black', answered_at: '2026-10-01', created_at: '2026-10-01' },
  ];
  beforeEach(() => Q.listQuestions.mockResolvedValue(qs));

  test('unanswered questions come first', async () => {
    render(<QuestionsPage />);
    const rows = await screen.findAllByTestId(/^question-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'question-q1');
  });
  test('an empty answer is not sent', async () => {
    render(<QuestionsPage />);
    await userEvent.click(await screen.findByTestId('answer-q1'));
    expect(Q.answerQuestion).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Введите ответ');
  });
  test('a sent answer marks the question answered', async () => {
    Q.answerQuestion.mockResolvedValue(undefined);
    render(<QuestionsPage />);
    await userEvent.type(await screen.findByTestId('text-q1'), 'Yes, free');
    await userEvent.click(screen.getByTestId('answer-q1'));
    await waitFor(() => expect(Q.answerQuestion).toHaveBeenCalledWith('q1', 'Yes, free'));
    await waitFor(() => expect(screen.queryByTestId('answer-q1')).toBeNull());
  });
  test('a failed answer keeps the form and shows the error', async () => {
    Q.answerQuestion.mockRejectedValue(new Error('offline'));
    render(<QuestionsPage />);
    await userEvent.type(await screen.findByTestId('text-q1'), 'x');
    await userEvent.click(screen.getByTestId('answer-q1'));
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.getByTestId('answer-q1')).toBeInTheDocument();
  });
});

describe('DevelopmentPage', () => {
  const task = { id: 't1', title: { ru: 'Пост', uz: '', en: '' }, description: { ru: 'Опишите', uz: '', en: '' }, points: 5, is_active: true };
  beforeEach(() => {
    D.listTasks.mockResolvedValue([task]);
    D.listRanks.mockResolvedValue([{ id: 1, name: { ru: 'Новичок', uz: '', en: '' }, min_points: 0 }]);
  });
  test('points outside 1..10 are not saved', async () => {
    render(<DevelopmentPage />);
    const pts = await screen.findByTestId('points-t1');
    await userEvent.clear(pts);
    await userEvent.type(pts, '11');
    await userEvent.click(screen.getByTestId('save-t1'));
    expect(D.saveTask).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('1 до 10');
  });
  test('a valid task is saved', async () => {
    D.saveTask.mockResolvedValue(undefined);
    render(<DevelopmentPage />);
    await userEvent.click(await screen.findByTestId('save-t1'));
    await waitFor(() => expect(D.saveTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', points: 5 })));
  });
  test('a failed save shows the error', async () => {
    D.saveTask.mockRejectedValue(new Error('denied'));
    render(<DevelopmentPage />);
    await userEvent.click(await screen.findByTestId('save-t1'));
    expect(await screen.findByRole('alert')).toHaveTextContent('denied');
  });
});

describe('ContentPage', () => {
  const item = { id: 'c1', kind: 'pr', title: { ru: 'Идея', uz: '', en: '' }, body: { ru: 'Текст', uz: '', en: '' }, sort: 1, is_published: true };
  beforeEach(() => C.listContent.mockResolvedValue([item]));
  test('an empty Russian text is not saved', async () => {
    render(<ContentPage />);
    const body = await screen.findByTestId('body-ru-c1');
    await userEvent.clear(body);
    await userEvent.click(screen.getByTestId('save-c1'));
    expect(C.saveContent).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('русском');
  });
  test('valid content is saved', async () => {
    C.saveContent.mockResolvedValue(undefined);
    render(<ContentPage />);
    await userEvent.click(await screen.findByTestId('save-c1'));
    await waitFor(() => expect(C.saveContent).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' })));
  });
});

describe('UsersPage', () => {
  beforeEach(() => U.listUsers.mockResolvedValue([{ user_id: 'u1', email: 'a@x.uz', role: 'business', is_blocked: false, display_name: 'Biz', created_at: '2026-10-01' }]));
  test('blocking needs a confirming click and then calls setBlocked', async () => {
    U.setBlocked.mockResolvedValue(undefined);
    render(<UsersPage />);
    await userEvent.click(await screen.findByTestId('block-u1'));
    expect(U.setBlocked).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('block-confirm-u1'));
    await waitFor(() => expect(U.setBlocked).toHaveBeenCalledWith('u1', true));
    expect(await screen.findByText('заблокирован')).toBeInTheDocument();
  });
  test('a failed block leaves the user active', async () => {
    U.setBlocked.mockRejectedValue(new Error('no'));
    render(<UsersPage />);
    await userEvent.click(await screen.findByTestId('block-u1'));
    await userEvent.click(screen.getByTestId('block-confirm-u1'));
    expect(await screen.findByRole('alert')).toHaveTextContent('no');
    expect(screen.queryByText('заблокирован')).toBeNull();
  });
});

describe('AuditPage', () => {
  test('shows the latest records', async () => {
    A.listAudit.mockResolvedValue([{ id: 1, actor_id: 'a', action: 'order.approve', target_type: 'order', target_id: 'o1', details: {}, created_at: '2026-10-01T10:00:00Z' }]);
    render(<AuditPage />);
    expect(await screen.findByText(/order\.approve/)).toBeInTheDocument();
    expect(A.listAudit).toHaveBeenCalledWith(100);
  });
  test('shows the error on failure', async () => {
    A.listAudit.mockRejectedValue(new Error('denied'));
    render(<AuditPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('denied');
  });
});
