jest.mock('../src/services/businessProfileService', () => ({ getMyBusinessProfile: jest.fn(), saveMyBusinessProfile: jest.fn() }));
jest.mock('../src/auth/authService', () => ({ signOut: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { getMyBusinessProfile, saveMyBusinessProfile } from '../src/services/businessProfileService';
import { t } from '../src/i18n';
import Profile from '../app/(business)/profile';

const get = getMyBusinessProfile as jest.Mock;
const save = saveMyBusinessProfile as jest.Mock;
beforeEach(() => jest.clearAllMocks());

test('an empty form shows errors and does not save', async () => {
  get.mockResolvedValue(null);
  await render(<Profile />);
  await waitFor(() => expect(get).toHaveBeenCalled());
  await fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByTestId('err-full_name')).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
});

test('a valid profile is saved once and confirmed', async () => {
  get.mockResolvedValue({ full_name: 'Aziz', phone: '+998901234567' });
  save.mockResolvedValue(undefined);
  await render(<Profile />);
  await screen.findByDisplayValue('Aziz');
  await fireEvent.press(screen.getByTestId('save'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(await screen.findByText(t('profile.saved'))).toBeTruthy();
});

test('a failed save shows the generic error and no banner', async () => {
  get.mockResolvedValue({ full_name: 'Aziz', phone: '+998901234567' });
  save.mockRejectedValue(new Error(''));
  await render(<Profile />);
  await screen.findByDisplayValue('Aziz');
  await fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText(t('error.generic'))).toBeTruthy();
  expect(screen.queryByText(t('profile.saved'))).toBeNull();
});
