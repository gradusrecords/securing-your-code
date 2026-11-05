import { theme } from '../src/lib/theme';

test('theme exposes the ZAYA brand colors', () => {
  expect(theme.colors.gold).toBe('#DBB577');
  expect(theme.colors.black).toBe('#050505');
});
