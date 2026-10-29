# Signing keys are intentionally NOT in this repository
The APK signing keystore (pulse-upload.p12) and its password are transfer-only files:
they were provided to the owner as `pulse-upload.p12.b64.txt` (base64) and `password.txt`.
Never commit them to a public repo — anyone holding them can sign fake "updates" of the app.
To rebuild: decode with `base64 -d pulse-upload.p12.b64.txt > pulse-upload.p12` (chmod 600),
place next to password.txt, then run ../build.sh.
