jest.mock('../src/services/modelCardService', () => ({
  getMyCard: jest.fn(),
  saveMyCard: jest.fn(),
  uploadPhoto: jest.fn(),
}));
jest.mock('../src/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://example.test/p.jpg' }, error: null }) }) } },
}));
jest.mock('../src/auth/authService', () => ({ signOut: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { getMyCard, saveMyCard } from '../src/services/modelCardService';
import { t } from '../src/i18n';
import Profile from '../app/(model)/profile';

const get = getMyCard as jest.Mock;
const save = saveMyCard as jest.Mock;

const stored = {
  full_name: 'Aziza Karimova', birth_date: '2000-05-20', gender: 'female', city: 'Ташкент',
  phone: '+998901234567', telegram: '@aziza', height_cm: 175, experience: 'none',
  directions: ['show'], other_agency_contract: false, photos: ['u/a.jpg'],
  status: 'approved', review_comment: null,
};

beforeEach(() => jest.clearAllMocks());

test('saving an empty form shows errors and does not call saveMyCard', async () => {
  get.mockResolvedValue(null);
  await render(<Profile />);
  await waitFor(() => expect(get).toHaveBeenCalled());
  await fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByTestId('err-full_name')).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
});

test('a valid stored card is saved once', async () => {
  get.mockResolvedValue(stored);
  save.mockResolvedValue(undefined);
  await render(<Profile />);
  await screen.findByDisplayValue('Aziza Karimova');
  await fireEvent.press(screen.getByTestId('save'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(await screen.findByText(t('profile.saved'))).toBeTruthy();
});

test('a returned card shows the manager comment', async () => {
  get.mockResolvedValue({ ...stored, status: 'returned', review_comment: 'Add a full-length photo' });
  await render(<Profile />);
  expect(await screen.findByText('Add a full-length photo')).toBeTruthy();
});

test('a failed save shows the generic error and no saved banner', async () => {
  get.mockResolvedValue(stored);
  save.mockRejectedValue(new Error(''));
  await render(<Profile />);
  await screen.findByDisplayValue('Aziza Karimova');
  await fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText(t('error.generic'))).toBeTruthy();
  expect(screen.queryByText(t('profile.saved'))).toBeNull();
});
