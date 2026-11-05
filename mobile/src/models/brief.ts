export type ProjectType = 'show' | 'photo' | 'ad' | 'clip' | 'promo';

export type BriefInput = {
  project: { title: string; type: ProjectType | ''; description?: string; references?: string };
  when_where: { date: string; time?: string; duration?: string; city: string; address?: string };
  who: { gender?: string; age?: string; height?: string; measurements?: string; hair?: string; eyes?: string; experience?: string; count: number };
  conditions: { meals?: boolean; transfer?: boolean; usage_rights?: string };
  requirements: { dresscode?: string; makeup_stylist?: string; restrictions?: string };
  contact: { name: string; phone: string; channel?: string };
};

export const PROJECT_TYPES: ProjectType[] = ['show', 'photo', 'ad', 'clip', 'promo'];

export const emptyBrief = (): BriefInput => ({
  project: { title: '', type: '' },
  when_where: { date: '', city: '' },
  who: { count: 0 },
  conditions: {},
  requirements: {},
  contact: { name: '', phone: '' },
});

const blank = (v?: string) => !v || v.trim() === '';

export function validateBrief(b: BriefInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (blank(b.project.title)) e['project.title'] = 'error.required';
  if (!PROJECT_TYPES.includes(b.project.type as ProjectType)) e['project.type'] = 'error.required';
  if (blank(b.when_where.date)) e['when_where.date'] = 'error.required';
  if (blank(b.when_where.city)) e['when_where.city'] = 'error.required';
  if (!(b.who.count >= 1)) e['who.count'] = 'error.range';
  if (blank(b.contact.name)) e['contact.name'] = 'error.required';
  if (!/^\+998\d{9}$/.test(b.contact.phone ?? '')) e['contact.phone'] = 'error.phone';
  return e;
}
