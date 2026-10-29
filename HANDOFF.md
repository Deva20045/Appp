# PULSE MBBS — Project Handoff (from the Oct 2026 chat)

Everything needed to continue work on the PULSE MBBS offline app. Read this first.

## 1. What exists today

- **Offline single-file web app**: `index.html` (19.1 MB) — 12 subjects, 3,665→**4,800 units**, **49,709 questions**, Subject→Chapter→Unit, quiz, mistakes/spaced Review tab, focus timer, notes, mock tests, flashcards, Light/Dark + accent themes, fully offline (fonts embedded).
- **Android APK**: `PULSE-MBBS-offline.apk` — **versionName 1.3 / versionCode 4**, package `com.deva20045.pulsembbs`, minSdk 23 / target 34, only permission `VIBRATE`, signed v1/v2/v3 (v4 off). WebView loads the HTML through the `appassets.androidplatform.net` origin (no INTERNET permission).
- **Live**: https://deva20045.github.io/MBBS/ (site) and https://deva20045.github.io/MBBS/PULSE-MBBS-offline.apk — both verified byte-identical to local files at publish time (commit `047fbb28` in `Deva20045/MBBS`, branch `main`, files at repo root).
- Latest SHA256 (verify after any rebuild): `index.html` = `ea064d29fd5bf015c79a7a27d374caef97954bb95124346307c6cd1faefea52f`, APK = `bcbedbe1343b2065efd748e2800c41252a7969be5f92accc3b9439672e8dc22a`.

### Features added late in the project (all shipped)
1. **Edit question** — ✎ button above every quiz question/flashcard: edit stem/case, options, correct answer, explanation; **Restore original**; edits stored in `S.edits` (key `subjectId#questionIndex`), survive relaunch, included in progress backups; attempts snapshot the question so completed scores are never rewritten.
2. **Recovered context** — 656 Pediatrics questions got their missing case stems / matching lists re-injected from the original subject page (`tools/recover_context.py`).
3. **Next unit fix** — results screen targets the unit *after* the one just finished (`resultsNextIdx()`), toasts when locked (old bug: jumped to first-unfinished unit = "chapter 1").
4. **Quiz resume** — unfinished run persists in `S.active`; auto-resumes at the same question on relaunch; home shows a "Continue · question x of y" card.
5. **Dashboard volumes** — subjects group by family (`sp`): one **Medicine** card → volumes view → Vol 1/2/3 → chapters. Other subjects are single cards.
6. **Footer "Android app ↓"** link (`#apkLink`, relative `PULSE-MBBS-offline.apk`, hidden when `window.PulseAndroid` exists).

## 2. File map

```
index.html                     THE web deliverable (assembled; also copied into the APK)
pulse-mbbs.html                byte-identical copy written by assemble.py
PULSE-MBBS-offline.apk         signed APK deliverable (+ .idsig is intentionally not shipped)
dashboard-home.png,
dashboard-volumes.png          UI reference screenshots of the volumes dashboard
tools/app/head.html            HTML shell + all CSS
tools/app/app.js               ALL application logic (single file)
tools/app/editor.js            question editor; prepended into app.js by assemble.py
tools/app/fonts/               embedded font files (assembled into the HTML)
tools/app/assemble.py          builds one self-contained HTML → pulse-mbbs.html
tools/bank.json                THE CONTENT: 12 subjects {c,u,q}, 49,709 questions
tools/test-ui.js               regression: resume, Next unit, editor, footer link
tools/test-new-content.js      regression: volumes dashboard, Med-V1/Gyne/Aneesh, search
tools/recover_context.py       re-injects stem/pairs into bank from original subject pages
tools/import_new_subjects.py   idempotent importer for medv1/gyne/aneesh from tools/sources
tools/context-recovery-report.json   audit of the peds recovery run
tools/sources/                 source material: *-app.html (repo-published apps),
                               {medv1,aneesh,gyne}-data.json (extracted chapter data),
                               {medv2,medv3,obg}.html (original subject pages)
tools/apk/build.sh             full Android build+sign pipeline (run this to make the APK)
tools/apk/setup-sdk.py         downloads official Build-Tools 34 + Platform 34 to /tmp
tools/apk/app/src/main/...     AndroidManifest.xml (versionCode 4 / 1.3), styles, icon, MainActivity.java
tools/apk/keys/pulse-upload.p12 + keys/password.txt   ★ SIGNING KEY — REQUIRED FOR ALL FUTURE UPDATES
tools/apk/README.md            build/transfer/signing notes
tools/apk/smoke-android-js.js  headless Chromium test with simulated PulseAndroid bridge
tools/apk/v1.1-update.md       release notes log (1.1, 1.2, 1.3)
```

Not included / ephemeral: `/tmp` (wipes between sessions — SDK, node_modules, screenshots regenerate), `tools/apk/app/src/main/assets/index.html` (staged at build time), Android SDK (auto-downloaded).

## 3. Rebuild commands

```bash
# HTML
python3 tools/app/assemble.py pulse-mbbs.html && cp pulse-mbbs.html index.html

# Tests (need: npm i playwright; npx playwright install chromium;
#          sudo npx playwright install-deps chromium   ← libnspr4 missing otherwise)
node tools/test-ui.js
node tools/test-new-content.js
node tools/apk/smoke-android-js.js

# APK (self-fetches SDK to /tmp if missing; javac/keytool from /usr/lib/jvm/jdk-11)
bash tools/apk/build.sh
/tmp/pulse-mbbs-android-sdk/build-tools/android-14/apksigner verify --verbose PULSE-MBBS-offline.apk
```

`/tmp/node_modules/playwright` disappears between sessions — reinstall it for tests.

## 4. Publish to GitHub (Deva20045/MBBS, branch main, files at repo root)

Tokens were shared in chat and must be treated as burned — ask the user for a **fresh fine-grained PAT** scoped to `Deva20045/MBBS` with Contents: Read & Write (or let them upload manually). Procedure that worked (single atomic commit, Python `requests`):

1. `POST /repos/Deva20045/MBBS/git/blobs` for `index.html` and `PULSE-MBBS-offline.apk` (`{"content": base64, "encoding":"base64"}`; ~19 MB bodies are fine, timeout 600).
2. `GET /git/ref/heads/main` → head sha; `GET /git/commits/{head}` → base tree sha.
3. `POST /git/trees` `{base_tree, tree:[{path,mode:"100644",type:"blob",sha}×2]}` → new tree.
4. `POST /git/commits` `{message, tree, parents:[head]}` → new commit.
5. `PATCH /git/refs/heads/main` `{sha:new, force:true}`.
6. Verify: raw.githubusercontent SHA256 == local; poll https://deva20045.github.io/MBBS/ until SHA256 matches (Pages takes ~10–70 s); same for the APK URL.

## 5. Content pipeline (repo → bank)

Subject sources are **Deva20045 repos**; the published pages embed JS data arrays. Extraction technique (worked for all three new subjects): locate `const NAME = [` / `{`, slice the balanced bracket run with a string/comment-aware matcher, `Function('return (...)')` it (see `/tmp/extract_chapters.js` pattern — reimplement if needed). Then `tools/import_new_subjects.py` maps to bank schema.

Bank schema: subject `{c, u, q}`; `c=[chapterNo, title, startPage|null]`; `u=[chapterIdx0, unitId, title, guide, diagram|null, startIdx, count]` (ranges partition q, sorted); `q=[text, opts[], ansIdx, explanation, fmt, page, sec]`. Unit progress key = `sid|chapterIdx|unitId` (`uArr`).

| Repo | Bank subject | Notes |
|---|---|---|
| Med-V1 | `medv1` (Volume 1) | 61 ch / 414 u / 3,958 q — all live |
| Med-V2 | `medv2` (Volume 2) | 57 ch / 3,429 q — verified current |
| Medicine | `medv3` (Volume 3) | 74 ch / 5,373 q — verified current |
| OBG | `obg` ("Obs") | **Obstetrics**, 24 ch / 2,710 q — verified current |
| Gyne | `gyne` | **Gynaecology** (complement, not duplicate), 49 ch / 563 u / 4,947 q; nested `CHAPTERS[].sections[].units[].questions[]` with keys `q/options/correct/why` |
| Aneesh | `aneesh` | only chapters with `live:true` (15 of 51!) / 158 u / 687 q |
| Peds, Pharm, Surgery, ORTHO, OPHTHAL, Stratum(=Derma) | as-is | verified current |
| ENT | — | empty repo (409), nothing to import |

Re-check upstream before content work: `pushed_at` per repo; questions diff by `(q, opts)` signature.

## 6. Standing user constraints (do not violate)

- Repo name **MBBS** only; site path `/MBBS/`. User uploads manually unless they explicitly hand a token. Never push to their other repos; never delete/archive them.
- Premium, minimal copy; no branding as "Main Dashboard"; structure **Subject → Chapter → Unit**; photo-era PULSE feel; one combined **Review** tab (mistakes + spaced); offline-first, everything in one HTML / one APK; Light/Dark + Blue/Orange+other colours; embedded premium sans fonts (Plus Jakarta Sans / DM Sans — no serif/typewriter).
- **"Permanent on my phone"** = the APK. Package id + `tools/apk/keys/pulse-upload.p12` (+ password) must never change/loss → in-place updates keep user progress.
- Edits/corrections are the user's manual safety net; bank content only changes from their repo sources — never invent questions.
- No claim that we published to GitHub unless we actually did with their token/consent.

## 7. Known gotchas

- `keytool` not on PATH → `/usr/lib/jvm/jdk-11/bin/keytool` (baked into build.sh).
- Build Tools/Platform pinned with SHA1 checks in `setup-sdk.py` (`/tmp/pulse-mbbs-android-sdk`).
- `recover_context.py` needs the `json.dumps` signature fix (already in file) and exact `page`/`exp` disambiguation; med-v2/v3/obg originals carry no stem/pairs.
- Some bank options arrays historically held nested lists — never hash `tuple(opts)`.
- **No emulator/adb/kvm exists in this environment** — never claim on-device testing; headless Chromium + simulated bridge is the test floor.
- Playwright browser and system libs reset between sessions (see §3).
- Search caps at 200 question hits; `effectiveQ()` must be used everywhere questions render (edits override).
- Home family card uses `sp` grouping — adding a second subject with the same `sp` automatically creates a volumes view.

## 8. Verification checklist for the next change

1. `node --check tools/app/app.js`, assemble, byte-compare counts: 12 subjects / 4,800 units / 49,709 q.
2. Three test suites green, zero page errors.
3. Build APK → apksigner v1/v2/v3 true → embedded `assets/index.html` == `index.html`.
4. Upload (or user uploads) → raw SHA match → live SHA match → spot-check site markers (`data-fam="Medicine"`, footer link) and APK download.
5. Tell the user to revoke any token that appeared in chat.

## 9. How this bundle travels (new-chat transfer)
- Public repo clone (no token needed to fetch): `git clone https://github.com/Deva20045/Appp.git`
  (or download raw files from that URL). The repo contains this whole tree except `tools/apk/keys/*`.
- Signing keys travel separately as TEXT: `pulse-upload.p12.b64.txt` (4.6 KB, base64 of the PKCS12)
  and `password.txt` (44 bytes). Download both from the original chat and attach/upload as .txt,
  or paste their contents. Restore: `base64 -d pulse-upload.p12.b64.txt > tools/apk/keys/pulse-upload.p12 && chmod 600 ...` + password.txt beside it.
- Publishing the app (index.html + APK) to the MBBS site still requires a fresh fine-grained token
  with Contents Read & Write on Deva20045/MBBS — see §4. Do not reuse tokens seen in chat.
