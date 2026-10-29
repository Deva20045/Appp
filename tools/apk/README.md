# PULSE MBBS · private Android app

`/home/user/PULSE-MBBS-offline.apk` is a privately signed, offline-only Android APK.
Its bundled `assets/index.html` is copied from `/home/user/index.html` by the build
script; the app includes all nine subjects and 40,117 questions and contains no
Internet permission. Min API 23; target API 34; only VIBRATE permission.

The APK uses an app-private `https://appassets.androidplatform.net/assets/index.html`
origin (intercepted in WebView; it is not fetched from the Internet). DOM storage is
app-private, persistent across launches, and separate from a regular browser.

## Progress transfer and backups

From the browser version: Settings → Download progress backup → save JSON.
In the installed APK: Settings → Restore from backup → choose that JSON.
To back up the APK later: Settings → Download progress backup → select a location.
No login or network is used. Clearing app data or uninstalling removes app-private
progress; backups are essential.

## Updates and signing

The package is `com.deva20045.pulsembbs`. To update without reinstalling, increment
`android:versionCode` in `app/src/main/AndroidManifest.xml`, keep the same package name,
and sign with the original keystore and password in `keys/`. **Do not upload the keys to
GitHub or share them.** Losing the key prevents seamless future APK upgrades;
back up progress before reinstalling with a different key.

Build on Linux with Java 11 and internet access for the first SDK download:

```bash
cd /home/user/tools/apk
./build.sh
```

The script fetches official Google Android SDK Build Tools 34 and Android Platform 34
into `/tmp/pulse-mbbs-android-sdk`, verifies SHA-1 against the Google repository
index, builds, signs, and verifies the APK. Build intermediates are in `/tmp`.
Google's downloads are **build-time only**; no Android SDK or download is in the APK.

## Verification completed

- Android `aapt dump badging`: version 1, min SDK 23, target SDK 34, only VIBRATE.
- Android `apksigner verify`: v1, v2, v3 signatures valid.
- APK's HTML SHA-256 matches `/home/user/index.html` exactly.
- Offline Chromium run with simulated native bridge passed full-bank loading, theme
  changes, export, restore, quiz, and Android back navigation with zero JS errors.
- An Android emulator or physical device was not available in this workspace;
  install on your phone and report any device-specific issue.
