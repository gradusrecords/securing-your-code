-- Demo data for the first run. Register the accounts in the app first, then edit the e-mails below
-- and run this file in the Supabase SQL editor. It is safe to run twice.
--   model1/model2 : registered as "I am a model"
--   business      : registered as "I am a business owner"
do $$
declare
  m1 uuid := (select id from auth.users where email = 'model1@example.com');
  m2 uuid := (select id from auth.users where email = 'model2@example.com');
  b  uuid := (select id from auth.users where email = 'business@example.com');
begin
  if m1 is null or m2 is null or b is null then
    raise exception 'Register model1@example.com, model2@example.com and business@example.com in the app first (or edit the e-mails above)';
  end if;

  insert into public.model_profiles (id, full_name, display_name, birth_date, gender, city, phone, telegram, height_cm, experience, directions, photos, status)
  values
    (m1, 'Demo Model One', 'Aziza', '2000-05-20', 'female', 'Ташкент', '+998901111111', '@demo_one', 175, 'under_1', '{photo,show,ad}', '{}', 'approved'),
    (m2, 'Demo Model Two', 'Dilnoza', '2001-03-03', 'female', 'Ташкент', '+998902222222', '@demo_two', 170, 'none', '{photo,promo}', '{}', 'approved')
  on conflict (id) do update set status = 'approved';

  insert into public.catalog_entries (model_id, agency_rating, agency_note, is_published) values
    (m1, 10, 'Надёжная, готова к коммерческим проектам.', true),
    (m2, 9, 'Новое лицо, открыта к разным форматам.', true)
  on conflict (model_id) do update set is_published = true;

  insert into public.business_profiles (id, full_name, company, phone, city)
  values (b, 'Demo Business', 'Demo Brand', '+998903333333', 'Ташкент')
  on conflict (id) do nothing;
end $$;
