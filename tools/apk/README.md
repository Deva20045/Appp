# PULSE MBBS · private Android app

> Current working-tree release: **1.5 (versionCode 6)**, 50,656 questions. The APK was repacked with the original signer and verified; device installation has not been tested. Historical verification and release details below refer to earlier builds.

`/home/user/PULSE-MBBS-offline.apk` is a privately signed, offline-only Android APK.
Its bundled `assets/index.html` is copied from `/home/user/index.html` by the build
script; the app includes all twelve subjects and 49,709 questions and contains no
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
cd tools/apk
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

## Rebuilding when there is no JDK / no SDK download

`build.sh` needs `aapt`, `d8`, `apksigner`, `zipalign` (Build-Tools 34) and `javac`.
If the machine has no JDK and `dl.google.com` is unreachable, use the repack path
instead. It does **not compile** anything: the app binary (`AndroidManifest.xml`,
`classes.dex`, `resources.arsc`, icon) is carried over byte-for-byte from the
previous signed APK and only the embedded `assets/index.html` changes, so the
result is identical to what `build.sh` would produce while the Java sources are
untouched.

```bash
# keys restored next to this README first (they are never committed)
PYTHON=/path/to/python-with-asn1crypto VERSION_NAME=1.4 VERSION_CODE=5 \
  bash tools/apk/repack.sh
```

Environment: `PULSE_KEY`, `PULSE_PASSWORD_FILE`, `PYTHON`, `VERSION_NAME`,
`VERSION_CODE`. `VERSION_NAME` must keep its length (`1.3` → `1.4` works because
the manifest stores it as a fixed-width UTF-16 string; the patch is
length-preserving so no offsets move).

`sign_apk.py` refuses to sign unless four self-tests pass against the previous
APK: the content-digest routine reproduces its v2 digest, the v1 writer
reproduces its `MANIFEST.MF`/`.SF` byte for byte, its own `.RSA` verifies, and
re-signing with the previous digest reproduces its v2/v3 blocks exactly. It also
refuses if the keystore does not hold the certificate that signed the previous
APK (which would silently break in-place upgrades).

`verify_apk.py` then checks the result independently: ZIP CRCs and alignment, v1
digests plus the PKCS#7 signature, v2/v3 content digests recomputed from the
file, the RSA signatures, the public key against the certificate, and that the
embedded page matches `index.html`. It is worth calibrating it against a
known-good APK (`verify_apk.py old.apk`) whenever it is changed.

Signing material (`keys/*.p12`, `keys/password.txt`) is gitignored and must never
be committed — anyone holding it can sign fake "updates" of the app.
