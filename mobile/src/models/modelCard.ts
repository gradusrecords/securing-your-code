export type Direction = 'show' | 'photo' | 'ad' | 'clip' | 'promo';
export type Experience = 'none' | 'under_1' | '1_3' | 'over_3';

export type ModelCardInput = {
  full_name: string;
  display_name?: string;
  birth_date: string;
  gender: 'female' | 'male';
  city: string;
  phone: string;
  telegram: string;
  instagram?: string;
  parent_contact?: string;
  height_cm: number;
  weight_kg?: number;
  bust_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  shoe_size?: string;
  hair?: string;
  eyes?: string;
  experience: Experience;
  directions: Direction[];
  other_agency_contract: boolean;
  portfolio_url?: string;
  about?: string;
  photos: string[];
};

export type CardErrors = Partial<Record<keyof ModelCardInput, string>>;

const blank = (v?: string) => !v || v.trim() === '';

function ageOn(birth: string, today: Date): number {
  const b = new Date(birth);
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < b.getUTCMonth() ||
    (today.getUTCMonth() === b.getUTCMonth() && today.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function validateModelCard(input: ModelCardInput, today: Date): CardErrors {
  const e: CardErrors = {};
  if (blank(input.full_name)) e.full_name = 'error.required';
  if (blank(input.city)) e.city = 'error.required';
  if (blank(input.telegram)) e.telegram = 'error.required';
  if (!/^\+998\d{9}$/.test(input.phone ?? '')) e.phone = 'error.phone';
  if (!(input.height_cm >= 100 && input.height_cm <= 230)) e.height_cm = 'error.range';
  if (input.weight_kg != null && !(input.weight_kg >= 15 && input.weight_kg <= 200)) e.weight_kg = 'error.range';
  if (!input.directions || input.directions.length === 0) e.directions = 'error.required';
  if (!input.photos || input.photos.length === 0) e.photos = 'error.required';
  if (blank(input.birth_date) || Number.isNaN(new Date(input.birth_date).getTime())) {
    e.birth_date = 'error.required';
  } else if (ageOn(input.birth_date, today) < 18 && blank(input.parent_contact)) {
    e.parent_contact = 'error.guardian';
  }
  return e;
}
