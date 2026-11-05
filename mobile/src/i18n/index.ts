import i18next from 'i18next';
import ru from './ru.json';
import uz from './uz.json';
import en from './en.json';

export type Language = 'ru' | 'uz' | 'en';

i18next.init({
  lng: 'ru',
  fallbackLng: 'ru',
  resources: { ru: { translation: ru }, uz: { translation: uz }, en: { translation: en } },
  interpolation: { escapeValue: false },
  initAsync: false,
});

export const t = (key: string, options?: Record<string, string | number>): string => i18next.t(key, options) as string;
export const setLanguage = (lang: Language): void => { void i18next.changeLanguage(lang); };
export default i18next;
export const currentLanguage = (): Language => ((i18next.language as Language) || 'ru');
