import { validateModelCard, type ModelCardInput } from '../src/models/modelCard';

const today = new Date('2026-10-14');
const valid: ModelCardInput = {
  full_name: 'Aziza Karimova',
  birth_date: '2000-05-20',
  gender: 'female',
  city: 'Ташкент',
  phone: '+998901234567',
  telegram: '@aziza',
  height_cm: 175,
  experience: 'none',
  directions: ['show'],
  other_agency_contract: false,
  photos: ['u/a.jpg'],
};

test('a complete adult card has no errors', () => {
  expect(validateModelCard(valid, today)).toEqual({});
});

test('required text fields report error.required', () => {
  const e = validateModelCard({ ...valid, full_name: '  ', telegram: '' }, today);
  expect(e.full_name).toBe('error.required');
  expect(e.telegram).toBe('error.required');
});

test('height must be within 100..230', () => {
  expect(validateModelCard({ ...valid, height_cm: 99 }, today).height_cm).toBe('error.range');
  expect(validateModelCard({ ...valid, height_cm: 231 }, today).height_cm).toBe('error.range');
  expect(validateModelCard({ ...valid, height_cm: 100 }, today).height_cm).toBeUndefined();
  expect(validateModelCard({ ...valid, height_cm: 230 }, today).height_cm).toBeUndefined();
});

test('weight, when given, must be within 15..200', () => {
  expect(validateModelCard({ ...valid, weight_kg: 14 }, today).weight_kg).toBe('error.range');
  expect(validateModelCard({ ...valid, weight_kg: 201 }, today).weight_kg).toBe('error.range');
  expect(validateModelCard({ ...valid, weight_kg: 55 }, today).weight_kg).toBeUndefined();
});

test('phone must be +998 followed by 9 digits', () => {
  expect(validateModelCard({ ...valid, phone: '901234567' }, today).phone).toBe('error.phone');
  expect(validateModelCard({ ...valid, phone: '+99890123456' }, today).phone).toBe('error.phone');
  expect(validateModelCard({ ...valid, phone: '+998901234567' }, today).phone).toBeUndefined();
});

test('at least one direction and one photo are required', () => {
  const e = validateModelCard({ ...valid, directions: [], photos: [] }, today);
  expect(e.directions).toBe('error.required');
  expect(e.photos).toBe('error.required');
});

test('a 17-year-old needs a guardian contact', () => {
  const minor = { ...valid, birth_date: '2009-10-15' };
  expect(validateModelCard(minor, today).parent_contact).toBe('error.guardian');
  expect(validateModelCard({ ...minor, parent_contact: 'Mom +998901112233' }, today).parent_contact).toBeUndefined();
});

test('exactly 18 on the birthday needs no guardian', () => {
  expect(validateModelCard({ ...valid, birth_date: '2008-10-14' }, today).parent_contact).toBeUndefined();
});
