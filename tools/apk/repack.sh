#!/usr/bin/env bash
# Repack + re-sign the APK WITHOUT the Android SDK.
#
# Use this only when build.sh cannot run — i.e. no JDK and/or dl.google.com is
# unreachable so setup-sdk.py cannot fetch Build-Tools 34. It does not compile
# anything: it swaps the embedded web payload and re-signs the previous APK with
# the same key, which is what makes Android accept it as an in-place update
# (same package, same certificate, so learner progress survives).
#
#   bash tools/apk/repack.sh [base.apk]
#
# Environment:
#   PULSE_KEY             keystore      (default: keys/pulse-upload.p12)
#   PULSE_PASSWORD_FILE   password file (default: keys/password.txt)
#   VERSION_NAME          new versionName; must keep its length (1.3 -> 1.4)
#   VERSION_CODE          new integer versionCode
#   PYTHON                interpreter to use (default: python3); it must have
#                         asn1crypto + cryptography, and androguard to verify
#
# Requires python3 with `asn1crypto` + `cryptography` (and `androguard` to run
# the verification step). See tools/apk/README.md.
set -euo pipefail
cd "$(dirname "$0")"

BASE=${1:-../../PULSE-MBBS-offline.apk}
KEY=${PULSE_KEY:-keys/pulse-upload.p12}
PW=${PULSE_PASSWORD_FILE:-keys/password.txt}
HTML=../../index.html
OUT=../../PULSE-MBBS-offline.apk
PY=${PYTHON:-python3}

[[ -f "$BASE" ]] || { echo "no base APK at $BASE" >&2; exit 1; }
[[ -f "$KEY"  ]] || { echo "no keystore at $KEY (see keys/README.md)" >&2; exit 1; }
[[ -f "$PW"   ]] || { echo "no password file at $PW" >&2; exit 1; }

# Work from a copy so a failed run can never damage the shipped APK.
TMPBASE=$(mktemp /tmp/pulse-base-XXXXXX.apk)
cp "$BASE" "$TMPBASE"

ARGS=(--apk "$TMPBASE" --html "$HTML" --key "$KEY" --password-file "$PW" --out "$OUT")
[[ -n "${VERSION_NAME:-}" ]] && ARGS+=(--version-name "$VERSION_NAME")
[[ -n "${VERSION_CODE:-}" ]] && ARGS+=(--version-code "$VERSION_CODE")

"$PY" sign_apk.py "${ARGS[@]}"
rm -f "$TMPBASE"

echo
echo 'Verifying the signed APK ...'
"$PY" verify_apk.py --expect-html "$HTML" "$OUT"
echo
echo "Signed OK. The APK now embeds $(sha256sum "$HTML" | cut -d' ' -f1)"
