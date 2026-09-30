# WebVault — Android обновяване 1.0.2

Подготвен е пълният проект с Android версия **1.0.2**, `versionCode 3`, пакет `site.webvault.app`. Новото ChatGPT търсене е включено в локалния Android bundle и е достъпно за PRO с активен или пробен абонамент. Free акаунтите запазват обикновеното търсене в отметките.

Архивът съдържа код, Android проект, икони, синхронизирани мобилни assets и текст за новата версия. **Подписан `.aab` още не е създаден.** Последната стъпка се изпълнява в Android Studio с твоя съществуващ ключ за качване.

## 1. Подготовка на лаптопа

1. Разархивирай в нова папка. Запази стария проект и неговия ключ.
2. Влез в папката `WebVault`, където е `package.json`, и отвори PowerShell/Terminal.
3. С Node.js 22.13 или по-нова версия изпълни:

   ```powershell
   npm ci
   npm run cap:sync:android
   npm run cap:open:android
   ```

4. Изчакай Gradle Sync в Android Studio. Проектът използва Android SDK 36 и Java 21. Избери Java 21 като Gradle JDK и инсталирай поисканите SDK компоненти, ако липсват.

## 2. Проверка на номера на версията

В Google Play Console отвори WebVault → **App bundle explorer** и виж най-големия използван version code за всички канали. Подготвеният код 3 е избран от предишния локален проект с код 2; актуалният максимум в Play Console не е проверен.

Ако код 3 вече е използван, редактирай `android/app/build.gradle` и увеличи `versionCode` над най-големия качен номер. Запази `applicationId "site.webvault.app"`. След редакцията синхронизирай Gradle и създай новия подписан bundle.

## 3. Създаване на подписан AAB

1. В Android Studio избери **Build → Generate Signed Bundle / APK**.
2. Избери **Android App Bundle → Next** и модул **app**.
3. В **Key store path** избери съществуващия `.jks` / `.keystore`, използван за сегашното приложение.
4. Въведи неговия alias и паролите локално в Android Studio.
5. Избери **release** и завърши създаването на bundle.
6. Android Studio показва готовия файл чрез **Locate**. Обичайното местоположение е `android/app/release/app-release.aab`; при Gradle `bundleRelease` е `android/app/build/outputs/bundle/release/app-release.aab`.

Ако ползваш Play App Signing, това е регистрираният **upload key**. Проверката на неговия сертификат е в Play Console → **App signing**. При липсващ ключ първо трябва да се намери оригиналният ключ или да се заяви reset на upload key през Play Console.

## 4. Проверка преди качване

На Android телефон или емулатор провери входа, зареждането на сайтовете, търсенето в отметките, EN/BG, отварянето на сайт и профила. С активен PRO акаунт провери ChatGPT отговор и източниците; с Free акаунт ChatGPT трябва да отваря PRO предложението.

OpenAI ключът остава във Vercel като сървърна променлива `OPENAI_API_KEY`. Той не се добавя в Android Studio, мобилния код или APK/AAB. Истински успешен AI отговор още не е потвърден: наличният тестов акаунт има PRO флаг, но няма active/trialing subscription status.

## 5. Качване в Google Play

1. Отвори WebVault в Google Play Console и избери съществуващия канал за разпространение. Ако още използваш Alpha затворения тест: **Test and release → Testing → Closed testing → Alpha**.
2. Избери **Create new release** и качи подписания `app-release.aab`.
3. Постави текста от `ANDROID_RELEASE_NOTES.md` в **Release notes** за съответния език.
4. Прегледай резултата от автоматичните проверки, запази версията и изпрати за преглед / rollout според избрания канал.

След обработването тестерите получават обновяването през Google Play. Подготовката на този архив не качва и не публикува автоматично нова Play Store версия.

## Изпълнени проверки

- Мобилен production build и Capacitor sync: успешно.
- TypeScript и Next.js production build: успешно.
- Сървърният ChatGPT endpoint приема Android CORS preflight (HTTP 204) и отказва заявка без вход (HTTP 401).
- Синхронизираните Android assets съвпадат с изградените мобилни файлове.
- Java 21 / Android Gradle компилация и физическо Android изпълнение не са проверени тук: средата няма Android SDK и разполага с Java 17.
- Lint на публикувания код отчита една съществуваща `react-hooks/purity` грешка за `Date.now()` в обработката на upload на икони и шест предупреждения. Споделеният dashboard код е запазен от публикуваната версия.

Официални инструкции: [Подписване](https://developer.android.com/studio/publish/app-signing), [Номериране на версиите](https://developer.android.com/studio/publish/versioning), [Capacitor Android](https://capacitorjs.com/docs/android).
