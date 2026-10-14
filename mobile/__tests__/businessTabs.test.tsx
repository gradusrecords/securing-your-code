jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('../src/services/catalogService', () => ({ ...jest.requireActual('../src/services/catalogService'), listCatalog: jest.fn() }));
jest.mock('../src/services/contentService', () => ({ listIdeas: jest.fn() }));

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { listCatalog } from '../src/services/catalogService';
import { listIdeas } from '../src/services/contentService';
import { t } from '../src/i18n';
import Catalog from '../app/(business)/catalog';
import Ideas from '../app/(business)/ideas';

const cat = listCatalog as jest.Mock;
const ideas = listIdeas as jest.Mock;
beforeEach(() => jest.clearAllMocks());

const m = (id: string, name: string, over = {}) => ({ model_id: id, display_name: name, gender: 'female', height_cm: 170, directions: ['show'], photos: [], agency_rating: 9, is_favorite: false, ...over });

test('the catalog lists model cards and filters favourites', async () => {
  cat.mockResolvedValue([m('a', 'Aziza', { is_favorite: true }), m('b', 'Dilnoza')]);
  await render(<Catalog />);
  expect(await screen.findByText(/Aziza/)).toBeTruthy();
  expect(screen.getByText(/Dilnoza/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('filter-favorites'));
  expect(screen.queryByText(/Dilnoza/)).toBeNull();
});

test('an empty catalog shows the empty state', async () => {
  cat.mockResolvedValue([]);
  await render(<Catalog />);
  expect(await screen.findByText(t('empty.catalog'))).toBeTruthy();
});

test('the catalog shows the generic error when loading fails', async () => {
  cat.mockRejectedValue(new Error('x'));
  await render(<Catalog />);
  expect(await screen.findByText(t('error.generic'))).toBeTruthy();
});

test('ideas are grouped by kind', async () => {
  ideas.mockResolvedValue([
    { id: '1', kind: 'pr', title: 'PR idea', body: 'b1' },
    { id: '2', kind: 'media', title: 'Media idea', body: 'b2' },
    { id: '3', kind: 'motivation', title: 'Motivation idea', body: 'b3' },
  ]);
  await render(<Ideas />);
  expect(await screen.findByText('PR idea')).toBeTruthy();
  expect(screen.getByText(t('ideas.pr'))).toBeTruthy();
  expect(screen.getByText(t('ideas.media'))).toBeTruthy();
  expect(screen.getByText(t('ideas.motivation'))).toBeTruthy();
});

test('ideas show the generic error when loading fails', async () => {
  ideas.mockRejectedValue(new Error('x'));
  await render(<Ideas />);
  expect(await screen.findByText(t('error.generic'))).toBeTruthy();
});
