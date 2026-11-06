import type { CatalogModel } from '../services/catalogService';

const KNOWN = ['show', 'photo', 'ad', 'clip', 'promo', 'video', 'host'] as const;
const LABEL_RU: Record<string, string> = { show: 'Показы', photo: 'Фотосъёмки', ad: 'Реклама', clip: 'Клипы', promo: 'Промо', video: 'Видео', host: 'Ведущий' };
const LABEL_UZ: Record<string, string> = { show: 'Podium', photo: 'Fotosuratga olish', ad: 'Reklama', clip: 'Kliplar', promo: 'Promo', video: 'Video', host: 'Boshlovchi' };
const NEUTRAL: [string, string] = ['Профессиональная модель агентства ZAYA.', 'ZAYA agentligining professional modeli.'];

export type CatalogRow = [string, string, number, string[], [string, string], [string, string], string[]];
export type CatalogPayload = { W: CatalogRow[]; M: CatalogRow[]; RW: number[]; RM: number[] };
type Full = CatalogModel & { agency_note?: string | null };

export function toCatalogPayload(models: Full[], urls: Record<string, string[]>): CatalogPayload {
  const p: CatalogPayload = { W: [], M: [], RW: [], RM: [] };
  for (const m of models) {
    const dirs = m.directions.filter((d) => (KNOWN as readonly string[]).includes(d));
    const note = m.agency_note?.trim();
    const row: CatalogRow = [
      m.display_name,
      m.display_name,
      m.height_cm,
      dirs,
      [dirs.map((d) => LABEL_RU[d]).join(', ') || NEUTRAL[0], dirs.map((d) => LABEL_UZ[d]).join(', ') || NEUTRAL[1]],
      [note || NEUTRAL[0], note || NEUTRAL[1]],
      (urls[m.model_id] ?? []).slice(0, 3),
    ];
    const rating = m.agency_rating ?? 9;
    if (m.gender === 'male') { p.M.push(row); p.RM.push(rating); } else { p.W.push(row); p.RW.push(rating); }
  }
  return p;
}
