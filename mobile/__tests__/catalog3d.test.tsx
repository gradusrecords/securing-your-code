const mockWebView = jest.fn();
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: (props: unknown) => { mockWebView(props); return <View testID="webview" />; } };
});
jest.mock('../src/catalog/catalogHtml', () => ({ catalogHtml: '<html>catalog</html>' }));
jest.mock('../src/services/catalogService', () => ({ listCatalog: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://signed/${p}` }, error: null }) }) } },
}));

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { listCatalog } from '../src/services/catalogService';
import { t } from '../src/i18n';
import { Catalog3D } from '../src/catalog/Catalog3D';

const list = listCatalog as jest.Mock;
beforeEach(() => jest.clearAllMocks());

test('the page gets the models and signed photo urls injected before content loads', async () => {
  list.mockResolvedValue([{ model_id: 'a', display_name: 'Aziza', gender: 'female', height_cm: 175, directions: ['show'], photos: ['a/1.jpg'], agency_rating: 10, is_favorite: true }]);
  await render(<Catalog3D />);
  await screen.findByTestId('webview');
  const props = mockWebView.mock.calls[mockWebView.mock.calls.length - 1][0] as { injectedJavaScriptBeforeContentLoaded: string; source: { html: string } };
  expect(props.source.html).toBe('<html>catalog</html>');
  expect(props.injectedJavaScriptBeforeContentLoaded).toContain('window.ZAYA_CATALOG=');
  expect(props.injectedJavaScriptBeforeContentLoaded).toContain('Aziza');
  expect(props.injectedJavaScriptBeforeContentLoaded).toContain('https://signed/a/1.jpg');
});

test('an empty catalog still opens the page', async () => {
  list.mockResolvedValue([]);
  await render(<Catalog3D />);
  expect(await screen.findByTestId('webview')).toBeTruthy();
});

test('a loading failure shows the generic error and no page', async () => {
  list.mockRejectedValue(new Error('x'));
  await render(<Catalog3D />);
  expect(await screen.findByText(t('error.generic'))).toBeTruthy();
  expect(screen.queryByTestId('webview')).toBeNull();
});
