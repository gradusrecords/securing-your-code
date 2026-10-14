import { supabase } from '../lib/supabase';

export type CatalogModel = {
  model_id: string;
  display_name: string;
  gender: string;
  height_cm: number;
  directions: string[];
  photos: string[];
  agency_rating: number | null;
  is_favorite: boolean;
};

export async function listCatalog(): Promise<CatalogModel[]> {
  const { data, error } = await supabase.from('public_model_cards').select('*');
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogModel[];
}

export function filterCatalog(models: CatalogModel[], f: { gender?: string; favoriteOnly?: boolean }): CatalogModel[] {
  return models.filter((m) => (!f.gender || m.gender === f.gender) && (!f.favoriteOnly || m.is_favorite));
}
