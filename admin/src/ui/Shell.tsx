import { useState, type ReactElement } from 'react';
import { supabase } from '../lib/supabase';

export const SECTIONS = ['Модели', 'Заказы', 'Вопросы', 'Развитие', 'Контент', 'Пользователи', 'Журнал'] as const;
export type Section = (typeof SECTIONS)[number];

export function Shell({ email, pages }: { email: string; pages?: Partial<Record<Section, () => ReactElement>> }) {
  const [section, setSection] = useState<Section>('Модели');
  const Page = pages?.[section];
  return (
    <div className="shell">
      <nav>
        <b className="brand">ZAYA</b>
        {SECTIONS.map((s) => (
          <button key={s} className={s === section ? 'on' : ''} onClick={() => setSection(s)}>{s}</button>
        ))}
        <span className="who">{email}</span>
        <button onClick={() => { void supabase.auth.signOut(); }}>Выйти</button>
      </nav>
      <main>{Page ? <Page /> : <h2>{section}</h2>}</main>
    </div>
  );
}
