#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
SDK="${PULSE_ANDROID_SDK:-/tmp/pulse-mbbs-android-sdk}"
TOOLS="$SDK/build-tools/android-14"
JAR="$SDK/platforms/android-34/android.jar"
MAIN="$PWD/app/src/main"
WORK="${PULSE_ANDROID_WORK:-/tmp/pulse-mbbs-apk-build}"
mkdir -p "$WORK/classes" "$WORK/dex" "$PWD/keys" "$MAIN/assets"
# The offline web build is embedded at APK build time. Do not maintain a second, stale copy.
cp "$PWD/../../index.html" "$MAIN/assets/index.html"
if [[ ! -f "$JAR" || ! -x "$TOOLS/aapt" ]]; then
    echo 'Installing official Android SDK components for local rebuild ...'
    python3 "$PWD/setup-sdk.py"
fi
# Do not include the 119 MB SDK archives or other build artifacts in the signed app.
"$TOOLS/aapt" package -f -m -M "$MAIN/AndroidManifest.xml" -S "$MAIN/res" -I "$JAR" -J "$WORK" >/dev/null
javac -encoding UTF-8 -source 8 -target 8 -Xlint:none -cp "$JAR" -d "$WORK/classes" \
    "$MAIN/java/com/deva20045/pulsembbs/MainActivity.java"
"$TOOLS/d8" --min-api 23 --lib "$JAR" --output "$WORK/dex" \
    "$WORK/classes/com/deva20045/pulsembbs/MainActivity.class" \
    "$WORK/classes/com/deva20045/pulsembbs/MainActivity\$1.class" \
    "$WORK/classes/com/deva20045/pulsembbs/MainActivity\$AndroidBridge.class"
"$TOOLS/aapt" package -f -M "$MAIN/AndroidManifest.xml" -S "$MAIN/res" -A "$MAIN/assets" -I "$JAR" -F "$WORK/unsigned.apk"
(cd "$WORK/dex" && zip -q -0 -u "$WORK/unsigned.apk" classes.dex)
"$TOOLS/zipalign" -f -p 4 "$WORK/unsigned.apk" "$WORK/aligned.apk"
if [[ ! -f "$PWD/keys/pulse-upload.p12" ]]; then
    /usr/lib/jvm/jdk-11/bin/keytool -genkeypair -noprompt -keystore "$PWD/keys/pulse-upload.p12" -storetype PKCS12 \
        -storepass "$(cat "$PWD/keys/password.txt")" -keypass "$(cat "$PWD/keys/password.txt")" \
        -alias pulsembbs -keyalg RSA -keysize 3072 -validity 10950 \
        -dname 'CN=PULSE MBBS, OU=Private Offline App, O=Personal, L=Vellore, ST=Tamil Nadu, C=IN'
fi
"$TOOLS/apksigner" sign --ks "$PWD/keys/pulse-upload.p12" --ks-type PKCS12 \
    --ks-key-alias pulsembbs --ks-pass "file:$PWD/keys/password.txt" \
    --min-sdk-version 23 --out "$PWD/../../PULSE-MBBS-offline.apk" "$WORK/aligned.apk"
"$TOOLS/apksigner" verify --verbose --print-certs "$PWD/../../PULSE-MBBS-offline.apk"
"$TOOLS/aapt" dump badging "$PWD/../../PULSE-MBBS-offline.apk" | head -14
ls -lh "$PWD/../../PULSE-MBBS-offline.apk"
