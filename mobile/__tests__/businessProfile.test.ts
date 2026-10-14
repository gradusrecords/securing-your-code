import { validateBusinessProfile } from '../src/models/businessProfile';

const ok = { full_name: 'Aziz', phone: '+998901234567' };

test('a minimal valid profile has no errors', () => {
  expect(validateBusinessProfile(ok)).toEqual({});
});
test('name is required', () => {
  expect(validateBusinessProfile({ ...ok, full_name: ' ' }).full_name).toBe('error.required');
});
test('phone must be +998 and 9 digits', () => {
  expect(validateBusinessProfile({ ...ok, phone: '12345' }).phone).toBe('error.phone');
});
test('an e-mail, when given, must contain @', () => {
  expect(validateBusinessProfile({ ...ok, email: 'nope' }).email).toBe('error.email');
  expect(validateBusinessProfile({ ...ok, email: 'a@b.uz' }).email).toBeUndefined();
});
