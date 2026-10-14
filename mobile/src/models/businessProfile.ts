export type BusinessProfileInput = {
  full_name: string;
  company?: string;
  position?: string;
  phone: string;
  telegram?: string;
  email?: string;
  city?: string;
  industry?: string;
};

export type BusinessProfileErrors = Partial<Record<keyof BusinessProfileInput, string>>;

export function validateBusinessProfile(input: BusinessProfileInput): BusinessProfileErrors {
  const e: BusinessProfileErrors = {};
  if (!input.full_name || input.full_name.trim() === '') e.full_name = 'error.required';
  if (!/^\+998\d{9}$/.test(input.phone ?? '')) e.phone = 'error.phone';
  if (input.email && !input.email.includes('@')) e.email = 'error.email';
  return e;
}
