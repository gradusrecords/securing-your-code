jest.mock('../src/services/developmentService', () => ({
  getTodayTasks: jest.fn(),
  completeTask: jest.fn(),
  getProgress: jest.fn(),
}));
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { completeTask, getProgress, getTodayTasks } from '../src/services/developmentService';
import { t } from '../src/i18n';
import Development from '../app/(model)/development';

const tasks = getTodayTasks as jest.Mock;
const complete = completeTask as jest.Mock;
const progress = getProgress as jest.Mock;

const baseProgress = { total_points: 120, rank: { id: 2, name: 'Восходящая звезда' }, next_rank_points: 300, streak: 3, badges: ['first_task'] };

beforeEach(() => {
  jest.clearAllMocks();
  tasks.mockResolvedValue([
    { assignment_id: 'a1', title: 'Обновить обложку', description: 'Сделайте новое фото', points: 5, completed: false },
    { assignment_id: 'a2', title: 'Пост', description: 'Опубликуйте пост', points: 3, completed: false },
  ]);
  progress.mockResolvedValue(baseProgress);
});

test('shows rank, points, streak and today tasks', async () => {
  await render(<Development />);
  expect(await screen.findByText('Восходящая звезда')).toBeTruthy();
  expect(screen.getByText('Обновить обложку')).toBeTruthy();
  expect(screen.getByTestId('streak').props.children.join('')).toContain('3');
  expect(screen.getByText(t('badge.first_task'))).toBeTruthy();
});

test('a task is marked done only after the server confirms', async () => {
  complete.mockResolvedValue({ points_awarded: 5, new_badges: [] });
  await render(<Development />);
  await screen.findByText('Обновить обложку');
  await fireEvent.press(screen.getByTestId('done-a1'));
  await waitFor(() => expect(complete).toHaveBeenCalledWith('a1'));
  await waitFor(() => expect(screen.queryByTestId('done-a1')).toBeNull());
  expect(screen.getByTestId('done-a2')).toBeTruthy();
});

test('on a network error the task stays not done and an error is shown', async () => {
  complete.mockRejectedValue(new Error(''));
  await render(<Development />);
  await screen.findByText('Обновить обложку');
  await fireEvent.press(screen.getByTestId('done-a1'));
  expect(await screen.findByText(t('error.generic'))).toBeTruthy();
  expect(screen.getByTestId('done-a1')).toBeTruthy();
});

test('newly earned badges are announced', async () => {
  complete.mockResolvedValue({ points_awarded: 5, new_badges: ['streak_3'] });
  await render(<Development />);
  await screen.findByText('Обновить обложку');
  await fireEvent.press(screen.getByTestId('done-a1'));
  expect(await screen.findByText(`${t('development.new_badge')}: ${t('badge.streak_3')}`)).toBeTruthy();
});
