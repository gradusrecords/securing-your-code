/* The models who are in the catalog: for now the agency works only with them, so only they get the quest, the Telegram tasks
   and are shown on the owner dashboard. Application codes from the Google Sheet (column A, sheet Info).
   A person can be written in the sheet twice (Timur Vohidov: Z-K10XG and Z-9TN9A), so both rows are listed.
   To change the list without a deploy, set the Cloudflare variable ROSTER_CODES (comma separated); it replaces this list. */
export const CATALOG_CODES = [
  'Z-W90U7', // Камилла Музраббекова
  'Z-XKEUW', // Лаура Винникова
  'Z-KESO8', // Хумора Мирзакасимова
  'Z-MMI21', // Шахризода Тураева
  'Z-UVPPZ', // Маргарита Узбекова
  'Z-ZIBG2', // Мадинабону Абдураззакова
  'Z-V53J4', // Оминабону Абдурахимова
  'Z-5ETAU', // Ҳаётхон Собирова
  'Z-G845P', // Лазиза Салимова
  'Z-66BMN', // Нурхаёт Калбаева
  'Z-UH9GE', // Алсу Габбасова
  'Z-NL2U2', // Тамила Пазылова
  'Z-XOSHV', // Салим
  'Z-LYYKG', // Эмиль Садигзаде
  'Z-6SINR', // Зиёвуддин Исакулов
  'Z-VP2PZ', // Бегзод Расулов
  'Z-NOH4X', // Бехруз Махмудов
  'Z-IGO5H', // Мансур Абдукаюмов
  'Z-5PLLK', // Шохрух Зухриддинов
  'Z-BMNBI', // Жамолиддин Абдужалилов
  'Z-I0U6C', // Валерий Ким
  'Z-0FRVP', // Улугбек Олимов
  'Z-CP9RL', // Мухаммаджон Мадаминов
  'Z-K10XG', // Тимур Вахидов
  'Z-9TN9A', // Тимур Вахидов (второй раз в таблице, под именем Сабир Тахиров)
];
export const rosterOf = env => {
  const raw = String((env && env.ROSTER_CODES) || '').split(/[,\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
  return new Set(raw.length ? raw : CATALOG_CODES);
};
