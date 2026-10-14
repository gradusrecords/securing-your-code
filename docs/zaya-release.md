# ZAYA: выпуск приложения без магазинов (APK и TestFlight)

Проверено в разработке: `npx expo prebuild` для iOS и Android проходит без ошибок, тесты и сборка бандла зелёные.
Не проверено (нужны ваши аккаунты): сами облачные сборки EAS, вход через Google/Apple на устройствах, доставка push.

## 0. Что нужно иметь
- Аккаунт Expo (бесплатный подходит), Apple Developer (99 $ в год), проект Google Cloud (для входа через Google), проект Supabase.

## 1. Supabase
1. Применить миграции `supabase/migrations/*.sql` (`supabase db push`), затем seed: `supabase/seed/*.sql`.
2. Authentication → Providers: включить Email, Google и Apple (см. шаги 4–5).
3. Зарегистрировать будущего суперадмина в приложении и выполнить `scripts/promote-admin.sql` с его e-mail.
4. Функция push и расписание — раздел «Push-уведомления» в `docs/zaya-setup.md`.

## 2. EAS
    cd mobile
    npx eas-cli@latest login
    npx eas-cli@latest init          # впишет projectId в app.json (extra.eas.projectId); он нужен для push
Переменные окружения для сборок (значения подставьте свои; ключ `anon` не секрет, но привязан к проекту):

    npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<project>.supabase.co --environment preview --environment production --visibility plaintext
    npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --environment preview --environment production --visibility plaintext
    npx eas-cli@latest env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value <web client id> --environment preview --environment production --visibility plaintext
    npx eas-cli@latest env:create --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value <ios client id> --environment preview --environment production --visibility plaintext
Секретные ключи (service-role, Apple private key) в EAS и в репозиторий не кладутся.

## 3. Android: APK для установки без Google Play
    npx eas-cli@latest build -p android --profile preview
По окончании EAS даст ссылку на `.apk`. Отправьте её моделям и клиентам; на телефоне разрешите установку из неизвестных источников.

## 4. Вход через Google
1. Google Cloud → APIs & Services → Credentials: создать OAuth client ID трёх типов — Web, iOS (bundle id `uz.zaya.app`), Android (package `uz.zaya.app`, SHA-1 из `npx eas-cli credentials -p android`).
2. Web client ID/secret вписать в Supabase → Providers → Google; включить «Skip nonce check» (нативный вход).
3. В `mobile/app.json` у плагина `@react-native-google-signin/google-signin` добавить `{"iosUrlScheme": "com.googleusercontent.apps.<iOS client id без префикса>"}`.

## 5. Вход через Apple и iPhone (TestFlight)
1. developer.apple.com → Identifiers: App ID `uz.zaya.app` с включённой возможностью «Sign in with Apple».
2. В Supabase → Providers → Apple указать Client IDs: `uz.zaya.app`.
3. Сборка и отправка:

        npx eas-cli@latest build -p ios --profile production
        npx eas-cli@latest submit -p ios
   (EAS предложит создать сертификаты и ключ APNs для push — согласитесь.)
4. App Store Connect → TestFlight: добавить тестировщиков (до 10 000 по e-mail или публичной ссылке). Первая сборка для внешних тестировщиков проходит короткую проверку Apple (обычно 1–2 дня). Сборка живёт 90 дней, потом выпускается новая.

## 5.1 Push на Android
Нужен Firebase-проект: создать приложение Android `uz.zaya.app`, скачать `google-services.json`, загрузить FCM-учётные данные в EAS (`npx eas-cli credentials -p android`) по инструкции Expo «Push notifications setup».

## 6. Веб-админка
`admin/` собирается командой `npm run build`; папку `admin/dist` можно выложить на любой статический хостинг. Переменные: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## 7. Чек-лист перед раздачей
- [ ] Миграции и seed применены в боевом Supabase, `supabase test db` пройден.
- [ ] Суперадмин назначен, вход в админку работает.
- [ ] Загружены фото моделей, карточки одобрены и опубликованы в каталоге.
- [ ] Контент «Развития» и «Идей» утверждён заказчиком (тексты на RU/UZ/EN — черновик).
- [ ] Тестовый заказ прошёл весь путь: создание → проверка → рассылка → подтверждение → выбор → закрепление; push доходят.

## 8. Известные ограничения
- 3D-каталог работает без интернета, кроме фото моделей (временные ссылки) и шрифтов (при их отсутствии берутся системные).
- Одобренная модель может поменять контакты и фото без повторной проверки.
- Админка только на русском, без постраничной выдачи.
