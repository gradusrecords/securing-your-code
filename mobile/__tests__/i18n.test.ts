import { setLanguage, t } from '../src/i18n';
import ru from '../src/i18n/ru.json';
import uz from '../src/i18n/uz.json';
import en from '../src/i18n/en.json';

test('slogan is translated in all three languages', () => {
  setLanguage('ru');
  expect(t('slogan')).toBe('Твоя высота начинается здесь');
  setLanguage('en');
  expect(t('slogan')).toBe('Your heights begin here');
  setLanguage('uz');
  expect(t('slogan')).toBe('Sening cho‘qqing shu yerdan boshlanadi');
});

test('all language files have exactly the same keys', () => {
  expect(Object.keys(uz).sort()).toEqual(Object.keys(ru).sort());
  expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
});
