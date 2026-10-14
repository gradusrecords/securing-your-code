import { emptyBrief, validateBrief, type BriefInput } from '../src/models/brief';

const valid: BriefInput = {
  project: { title: 'Summer shoot', type: 'photo' },
  when_where: { date: '2026-12-01', city: 'Ташкент' },
  who: { count: 2 },
  conditions: {},
  requirements: {},
  contact: { name: 'Aziz', phone: '+998901234567' },
};

test('a complete brief has no errors', () => {
  expect(validateBrief(valid)).toEqual({});
});

test('an empty brief reports all seven required fields', () => {
  const e = validateBrief(emptyBrief());
  expect(Object.keys(e).sort()).toEqual([
    'contact.name', 'contact.phone', 'project.title', 'project.type', 'when_where.city', 'when_where.date', 'who.count',
  ]);
});

test('who.count below 1 is a range error', () => {
  expect(validateBrief({ ...valid, who: { count: 0 } })['who.count']).toBe('error.range');
});

test('an unknown project type is rejected', () => {
  expect(validateBrief({ ...valid, project: { title: 'T', type: 'wedding' as never } })['project.type']).toBe('error.required');
});

test('contact phone must be +998 and 9 digits', () => {
  expect(validateBrief({ ...valid, contact: { name: 'A', phone: '123' } })['contact.phone']).toBe('error.phone');
});
