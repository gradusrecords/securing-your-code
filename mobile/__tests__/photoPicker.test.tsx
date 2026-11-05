jest.mock('../src/lib/supabase', () => {
  const createSignedUrl = jest.fn();
  return { supabase: { storage: { from: jest.fn(() => ({ createSignedUrl })) }, __sign: createSignedUrl } };
});
jest.mock('../src/services/modelCardService', () => ({ uploadPhoto: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn() }));

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { supabase } from '../src/lib/supabase';
import { PhotoPicker } from '../src/ui/PhotoPicker';

const sign = (supabase as any).__sign as jest.Mock;

test('thumbnails of the private bucket use signed URLs', async () => {
  sign.mockResolvedValue({ data: { signedUrl: 'https://example.test/signed.jpg' }, error: null });
  await render(<PhotoPicker photos={['u1/a.jpg']} onChange={() => {}} />);
  const img = await screen.findByTestId('photo-0');
  expect(sign).toHaveBeenCalledWith('u1/a.jpg', 3600);
  expect(img.props.source).toEqual({ uri: 'https://example.test/signed.jpg' });
});
