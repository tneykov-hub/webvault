# WebVault Android 1.0.5 — проверен подписан AAB за Alpha

Версия **1.0.5 / versionCode 6**, пакет **site.webvault.app**, min SDK **24**, target/compile SDK **36**. Предишната **1.0.4 / code 5** е публикувана в **Closed testing – Alpha** на 3 октомври 2026 г.; това е потвърдено от предоставената снимка на Submission 3. Няма потвърдено публикуване в Production.

## Готовият пакет

`release/WebVault-1.0.5-code-6-unsigned.aab` е реално изграден с Gradle 8.14.3 / Android Gradle Plugin 8.13.0 / JDK 21.0.12.1. Build и release lint са успешни: 298 задачи. Bundletool проверката минава; release manifest е 1.0.5 / 6 и не е debuggable. Всичките 18 native public assets съвпадат байт по байт с проверения mobile bundle и съдържат новия протокол за устройства и safe-area поправката.

AAB: **3,494,486 bytes**. SHA-256: `3ae0191de769183cfcb6893a75a75cbed342fd6861949c17be16f8e1643ab12e`.

**Подписаният AAB е получен от собственика и независимо проверен. Качен е в Google Play и е изпратен за преглед в Closed testing – Alpha; все още не е публикуван за тестерите.** Готовият файл е **release/WebVault-1.0.5-code-6-signed.aab**, 3,557,670 bytes, SHA-256 `cf562407abe703eab114c648b7fca8845e70a869ae36f6227b4bdd10061dae7b`. Jarsigner проверката, сертификатът от 1.0.4, manifest 1.0.5 / 6 и bundletool са успешни; всичките 487 payload файла са непроменени. Private upload key остава при собственика. Пакетът съдържа и първоначалния unsigned AAB и скрипта за повторно локално подписване при нужда.

## Повторно подписване в Windows при нужда

1. Разархивирай `WebVault-Android-1.0.5-Alpha-Update.zip` в отделна папка. В пълния архив същите файлове са в `android-1.0.5/`.
2. Стартирай **SIGN-1.0.5.cmd**. Скриптът намира JDK от Android Studio, JAVA_HOME или PATH. Ако Android Studio е в нестандартна папка, изпълни PowerShell скрипта с параметъра `-JdkDirectory` към неговата `jbr` папка.
3. Избери **съществуващия upload keystore**, използван за WebVault 1.0.4. Въведи паролата в локалния Java prompt, избери същия key alias и подпиши. Паролите не се записват от скрипта и ключът не се копира в пакета.
4. При SUCCESS готовият файл е **release/WebVault-1.0.5-code-6-signed.aab**. Записват се SHA-256, проверката на подписа и `SIGNED-VERIFICATION.json`. Скриптът отказва чужд upload сертификат, променен AAB, неправилна версия и подменено съдържание; след неуспех не оставя upload-ready файл.

Очакван SHA-256 на upload сертификата от проверения 1.0.4 AAB: `7EB1457890F22448462D40E6368094D4181587D5278A46714AD44A0165FFA4E0`.

Подписаният файл вече е качен и изпратен за преглед; няма нужда да изпълняваш скрипта или да изграждаш AAB отново. Пълните източници са запазени в пълния архив, ако искаш собствен rebuild с `npm.cmd ci`, `npm.cmd run cap:sync:android` и Android Studio → Generate Signed Bundle/APK → Android App Bundle → release. Скриптът за готовия пакет проверява конкретния AAB hash; собствен rebuild се подписва през Android Studio.

## Alpha и web зависимост

Подписаният AAB е качен в съществуващия **Closed testing – Alpha** канал и разпознат като **6 (1.0.5)**. Единствената промяна е изпратена с Send changes for review. На 5 октомври 2026 г., 23:08 ч. българско време, Publishing overview показва **Changes in review**, а автоматичните quick checks още работят. Това не е одобрение или потвърдено разпространение за тестерите. Managed publishing остава off. Бележките на en-US са въведени; BG версията е запазена в архива. Няма блокиращи validation грешки и загубени поддържани устройства. Има едно неблокиращо предупреждение за deobfuscation файл; release build запазва minify=false. Точното състояние е в `release/ALPHA-SUBMISSION.json` и снимката `alpha-1.0.5-in-review.jpg`.

**Необходимият web/API код от [PR #6](https://github.com/tneykov-hub/webvault/pull/6) е публикуван в production на https://webvault.site/.** PR е merged; production deployment `dpl_8oxZQKNKk6pHGac6JGCtE2vHZmiN` е READY за commit `1096bfd4a46c3590998e3fcc6021c11fbf6a78b8`. Публичните страници, неавтентикираните API откази, Android `X-WebVault-Device` CORS, PWA файловете и EN/BG браузърният интерфейс са проверени. Android използва production за имейл потвърждението и AI/изтриване. Реален имейл и физически телефон остават за проверка.

Глобалната сървърна защита остава **enforced=false**. Преди включване се проверяват реален имейл, потвърждение на Android, смяна между два клиента, премахване на устройство, Profile и AI. След разпространение трябва да се даде възможност на старите Android клиенти да обновят. Подробният rollout е в `docs/device-security/RELEASE-BG.md`.

## Проверки и граници

Скриптът минава PowerShell parsing и пет проверки с тестови файлове: правилен hash, отказ при променен hash, стара версия, различен upload сертификат и изчистване след неуспешно подписване. Проверен е и върху истинския неподписан AAB в режим CheckOnly. Тестовият ключ е отделен от потребителските ключове и не влиза в пакета. Собственикът предостави подписания файл; подписът и съдържанието му са независимо проверени. Windows file picker не е наблюдаван пряко. Качването и искането за преглед в Google Play са потвърдени в UI. Одобрение/публикуване, физически телефон и имейл доставка още не са потвърдени. Те не са включени в автоматично отчетените успешни проверки.

Официални инструкции: [подписване на готов AAB с jarsigner](https://developer.android.com/build/building-cmdline#build_bundle) и [използване на съществуващ upload key](https://developer.android.com/studio/publish/app-signing#sign-apk).
