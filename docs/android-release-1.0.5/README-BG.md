# WebVault Android 1.0.5 — изграден AAB за локално подписване

Версия **1.0.5 / versionCode 6**, пакет **site.webvault.app**, min SDK **24**, target/compile SDK **36**. Предишната **1.0.4 / code 5** е публикувана в **Closed testing – Alpha** на 3 октомври 2026 г.; това е потвърдено от предоставената снимка на Submission 3. Няма потвърдено публикуване в Production.

## Готовият пакет

`release/WebVault-1.0.5-code-6-unsigned.aab` е реално изграден с Gradle 8.14.3 / Android Gradle Plugin 8.13.0 / JDK 21.0.12.1. Build и release lint са успешни: 298 задачи. Bundletool проверката минава; release manifest е 1.0.5 / 6 и не е debuggable. Всичките 18 native public assets съвпадат байт по байт с проверения mobile bundle и съдържат новия протокол за устройства и safe-area поправката.

AAB: **3,494,486 bytes**. SHA-256: `3ae0191de769183cfcb6893a75a75cbed342fd6861949c17be16f8e1643ab12e`.

**AAB още е неподписан и не е качен в Google Play.** Наличният private upload key остава при собственика. Пакетът съдържа скрипт за подписване на вече изградения AAB; Android Studio или друг JDK предоставя нужните `jarsigner` и `keytool` инструменти.

## Подписване в Windows

1. Разархивирай `WebVault-Android-1.0.5-Alpha-Update.zip` в отделна папка. В пълния архив същите файлове са в `android-1.0.5/`.
2. Стартирай **SIGN-1.0.5.cmd**. Скриптът намира JDK от Android Studio, JAVA_HOME или PATH. Ако Android Studio е в нестандартна папка, изпълни PowerShell скрипта с параметъра `-JdkDirectory` към неговата `jbr` папка.
3. Избери **съществуващия upload keystore**, използван за WebVault 1.0.4. Въведи паролата в локалния Java prompt, избери същия key alias и подпиши. Паролите не се записват от скрипта и ключът не се копира в пакета.
4. При SUCCESS готовият файл е **release/WebVault-1.0.5-code-6-signed.aab**. Записват се SHA-256, проверката на подписа и `SIGNED-VERIFICATION.json`. Скриптът отказва чужд upload сертификат, променен AAB, неправилна версия и подменено съдържание; след неуспех не оставя upload-ready файл.

Очакван SHA-256 на upload сертификата от проверения 1.0.4 AAB: `7EB1457890F22448462D40E6368094D4181587D5278A46714AD44A0165FFA4E0`.

Няма нужда да изграждаш този AAB отново. Пълните източници са запазени в пълния архив, ако искаш собствен rebuild с `npm.cmd ci`, `npm.cmd run cap:sync:android` и Android Studio → Generate Signed Bundle/APK → Android App Bundle → release. Скриптът за готовия пакет проверява конкретния AAB hash; собствен rebuild се подписва през Android Studio.

## Alpha и web зависимост

Подписаният AAB се качва в съществуващия **Closed testing – Alpha** канал. Разпознатата версия трябва да е **6 (1.0.5)**. Бележките са в `release/RELEASE-NOTES-en-US.txt` и `release/RELEASE-NOTES-bg.txt`. След преглед на release използвай Publishing overview → Send changes for review. Managed publishing е off според предоставената снимка.

**Преди тестване и разпространение на 1.0.5 новият web/API код от [PR #6](https://github.com/tneykov-hub/webvault/pull/6) трябва да бъде публикуван.** Android използва `https://webvault.site/` за имейл потвърждението и production API за AI/изтриване. Старият production web не съдържа handler-а за потвърждение на устройства и новия CORS header. PR остава draft; production web не е обновен с тази подготовка.

Глобалната сървърна защита остава **enforced=false**. Преди включване се проверяват реален имейл, потвърждение на Android, смяна между два клиента, премахване на устройство, Profile и AI. След разпространение трябва да се даде възможност на старите Android клиенти да обновят. Подробният rollout е в `docs/device-security/RELEASE-BG.md`.

## Проверки и граници

Скриптът минава PowerShell parsing и пет проверки с тестови файлове: правилен hash, отказ при променен hash, стара версия, различен upload сертификат и изчистване след неуспешно подписване. Проверен е и върху истинския неподписан AAB в режим CheckOnly. Тестовият ключ е отделен от потребителските ключове и не влиза в пакета. Windows file picker, подписване със собствения ключ, реален Google Play upload, физически телефон и имейл доставка още не са проверени. Те не са включени в автоматично отчетените успешни проверки.

Официални инструкции: [подписване на готов AAB с jarsigner](https://developer.android.com/build/building-cmdline#build_bundle) и [използване на съществуващ upload key](https://developer.android.com/studio/publish/app-signing#sign-apk).
