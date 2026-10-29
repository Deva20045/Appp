# PULSE MBBS — Project Handoff (from the Oct 2026 chat)

> The latest working-tree update at the end of this file supersedes older release and APK status notes below.

Everything needed to continue work on the PULSE MBBS offline app. Read this first.

## 1. What exists today

- **Offline single-file web app**: `index.html` (19.1 MB) — 12 subjects, 3,665→**4,800 units**, **49,709 questions**, Subject→Chapter→Unit, quiz, mistakes/spaced Review tab, focus timer, notes, mock tests, flashcards, Light/Dark + accent themes, fully offline (fonts embedded).
- **Android APK**: `PULSE-MBBS-offline.apk` — **versionName 1.4 / versionCode 5**, package `com.deva20045.pulsembbs`, minSdk 23 / target 34, only permission `VIBRATE`, signed v1/v2/v3 with certificate SHA-256 `41380ada09d0f07a002e44ae55373ba84f6cb2fca257cd120a5f8d57095367b8` (unchanged, so it installs over 1.3 and keeps progress). WebView loads the HTML through the `appassets.androidplatform.net` origin (no INTERNET permission).
- **Live**: https://deva20045.github.io/MBBS/ (site) and https://deva20045.github.io/MBBS/PULSE-MBBS-offline.apk — both verified byte-identical to local files at publish time (commit `047fbb28` in `Deva20045/MBBS`, branch `main`, files at repo root).
- Latest SHA256 (verify after any rebuild): `index.html` = `0c58ad84b21654ceb4ac42b4d7743f07f26184fad68a9e825acd16b79c7a64d4`,
  APK = `13ac313684bfe68edc9b40de78943a95fa7d599adc787e3625fef5b17ae8ff9e`.

### Features added late in the project (shipped unless noted)
1. **Edit question** — ✎ button above every quiz question/flashcard: edit stem/case, options, correct answer, explanation; **Restore original**; edits stored in `S.edits` (key `subjectId#questionIndex`), survive relaunch, included in progress backups; attempts snapshot the question so completed scores are never rewritten.
2. **Recovered context** — 656 Pediatrics questions got their missing case stems / matching lists re-injected from the original subject page (`tools/recover_context.py`).
3. **Next unit fix** — results screen targets the unit *after* the one just finished (`resultsNextIdx()`), toasts when locked (old bug: jumped to first-unfinished unit = "chapter 1").
4. **Quiz resume** — unfinished run persists in `S.active`; auto-resumes at the same question on relaunch; home shows a "Continue · question x of y" card.
5. **Dashboard volumes** — subjects group by family (`sp`): one **Medicine** card → volumes view → Vol 1/2/3 → chapters. Other subjects are single cards.
6. **Footer "Android app ↓"** link (`#apkLink`, relative `PULSE-MBBS-offline.apk`, hidden when `window.PulseAndroid` exists).
7. **Fill-in-the-blank + matching questions** (this session) — the 464 fill and 90 match questions in Pharm used to render
   a stem with **zero answer controls** (unanswerable). They now render a typed answer box (graded with the book's
   normalisation + aliases) or a tap-to-match board; they score, snapshot, lock in mock tests, show real answer text on
   results and flashcards, resume after relaunch, and edit safely. Payload lives in an optional `q[7]` slot — see §5.1.
   Subject/chapter/unit/question counts are unchanged (12 / 4,800 / 49,709).

### 1.1 Outstanding / caveats

- **The APK was rebuilt by repacking, not by `build.sh`.** This session had no JDK and no reachable `dl.google.com`, so
  Build-Tools 34 could not be installed. `tools/apk/sign_apk.py` therefore re-signed the previous APK with the new web
  payload instead of recompiling it; the Java sources were untouched, so the binary payload is byte-identical (verified).
  Next time `build.sh` can run, prefer it — it is the canonical path and produces the same app.
- Signing material is **not** in this repo and is gitignored (`.gitignore`, §9). It must be restored before any rebuild.
- **The MBBS site is still serving 1.3.** Publishing was attempted in this session and blocked: the available GitHub
  credential is an installation token with read-only access to `Deva20045/MBBS` (`git push` -> 403 "Permission to
  Deva20045/MBBS.git denied", `POST /git/blobs` -> 403 "Resource not accessible by integration"), even though it can
  push to `Deva20045/Appp`. Nothing was published there; do not claim otherwise. The site commit is prepared and
  verified locally — re-run it with a token that has Contents: Read & Write on MBBS, or upload both files by hand:

  ```bash
  # what the site needs, both already verified in this repo
  PULSE-MBBS-offline.apk   sha256 13ac313684bfe68edc9b40de78943a95fa7d599adc787e3625fef5b17ae8ff9e
  index.html               sha256 0c58ad84b21654ceb4ac42b4d7743f07f26184fad68a9e825acd16b79c7a64d4
  ```
- One harmless consequence of the block: `tools/apk/keys/` must be restored by hand (§9), because this session could
  only verify the key against the previously shipped APK, not fetch it from anywhere.
- `pulse-mbbs.html` is a transient build output; it is not tracked (it is just a copy of `index.html`).

## 2. File map

```
index.html                     THE web deliverable (assembled; also copied into the APK)
pulse-mbbs.html                transient build output written by assemble.py (untracked, = index.html)
PULSE-MBBS-offline.apk         signed APK deliverable (+ .idsig is intentionally not shipped)
dashboard-home.png,
dashboard-volumes.png          UI reference screenshots of the volumes dashboard
tools/app/head.html            HTML shell + all CSS
tools/app/app.js               ALL application logic (single file)
tools/app/editor.js            question editor; prepended into app.js by assemble.py
tools/app/fonts/               embedded font files (assembled into the HTML)
tools/app/assemble.py          builds one self-contained HTML → pulse-mbbs.html
tools/bank.json                THE CONTENT: 12 subjects {c,u,q}, 49,709 questions
                               (+ optional q[7] payload for fill/match — see §5.1)
tools/test-env.js              shared test env: PW_PATH / PW_EXE / PULSE_HTML overrides
tools/test-ui.js               regression: resume, Next unit, editor, footer link
tools/test-new-content.js      regression: volumes dashboard, Med-V1/Gyne/Aneesh, search
tools/test-rich-questions.js   regression: fill/match payloads, grading, mock lock, editor, resume
tools/restore_rich_questions.py  idempotent: restores fill/match payloads into bank slot 7
tools/recover_context.py       re-injects stem/pairs into bank from original subject pages
tools/import_new_subjects.py   idempotent importer for medv1/gyne/aneesh from tools/sources
tools/context-recovery-report.json   audit of the peds recovery run
tools/sources/                 source material: *-app.html (repo-published apps),
                               {medv1,aneesh,gyne}-data.json (extracted chapter data),
                               {medv2,medv3,obg}.html (original subject pages), pharm-app.html
tools/apk/build.sh             full Android build+sign pipeline (run this to make the APK)
tools/apk/sign_apk.py          repack + re-sign WITHOUT the SDK (self-tested; needs asn1crypto)
tools/apk/verify_apk.py        independent v1/v2/v3 verifier (calibrate on a known-good APK)
tools/apk/repack.sh            wrapper: swap the web payload and re-sign an existing APK
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
node tools/test-rich-questions.js
node tools/apk/smoke-android-js.js

# If Playwright's own browser download is blocked, drive any Chromium instead:
#   PW_EXE=/path/to/chromium LD_LIBRARY_PATH=/path/to/nss-libs node tools/test-ui.js
# A pinned binary that still needs libnspr4/libnss3: `npm i @sparticuz/chromium`, then
# extract bin/al2023.tar.br with brotli and point LD_LIBRARY_PATH at the extracted lib/.
# PULSE_HTML=file:///path/to/index.html overrides the page under test.
# The suites now default to <repo>/index.html, so they work from any clone.

# APK (self-fetches SDK to /tmp if missing; javac/keytool from /usr/lib/jvm/jdk-11)
bash tools/apk/build.sh
/tmp/pulse-mbbs-android-sdk/build-tools/android-14/apksigner verify --verbose PULSE-MBBS-offline.apk

# APK without a JDK / without the SDK download (repack + re-sign the previous APK):
# restore the keys first, then
PYTHON=/path/to/python VERSION_NAME=1.4 VERSION_CODE=5 bash tools/apk/repack.sh
# and verify independently (works on any APK, no SDK needed):
python3 tools/apk/verify_apk.py PULSE-MBBS-offline.apk --expect-html index.html
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

Bank schema: subject `{c, u, q}`; `c=[chapterNo, title, startPage|null]`; `u=[chapterIdx0, unitId, title, guide, diagram|null, startIdx, count]` (ranges partition q, sorted); `q=[text, opts[], ansIdx, explanation, fmt, page, sec, extras?]`. Unit progress key = `sid|chapterIdx|unitId` (`uArr`).

### 5.1 `q[7]` extras — questions that are not multiple choice

The flat tuple can only describe an MCQ, but the Pharm source also has:

| source `type` | source fields | rendered as | `q[7]` |
|---|---|---|---|
| `fill`  | `blank`, `aliases[]` | typed answer box | `{t:'fill', blank, aliases}` |
| `match` | `left[]`, `right[]`, `ans[]` | tap-to-match board | `{t:'match', left, right, key:ans}` |

Slot 7 is **optional and additive** — slots 0-6 are untouched, so old backups, `S.edits` keys, progress and every other
subject behave exactly as before. `opts` stays `[]` and `ans` stays `null`/the key list for these rows; read them only
through the helpers, never directly:

```
richKind(q) / isFillQ / isMatchQ / isRichQ      what kind is this row
qMeta(q)                                        the slot-7 object
matchKey(q)                                     match key (permutation of right[])
correctAnswerText(q) / chosenAnswerText(q,chosen)  one-line text for results + flashcards
fillMatches(q, text) / matchCorrect(q, chosen)   grading
optionsHtml(q, answered, revealed, test)        the answer area (routes to optionHtml/fillHtml/matchHtml)
```

`chosen` in `run.log[i]` is an option index for MCQ, a **string** for fill and an **array** for match — always go through
`chosenAnswerText()` rather than indexing `q[1]`. Anything that renders questions must use `effectiveQ()` first, then these
helpers (a personal edit can change whether a row is rich only if the edit carries slot 7, which the editor preserves).

Restore/refresh the payload with `python3 tools/restore_rich_questions.py` — it re-derives from
`tools/sources/pharm-app.html`, asserts 1:1 text alignment against the bank, and is idempotent. Never hand-edit slot 7.

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
- The APK is a ZIP whose eight entries must keep their order and the STORED ones their 4-byte alignment; `sign_apk.py`
  handles that. Never rebuild the ZIP with a generic tool and never re-sign with a different key — either breaks in-place
  updates (progress loss) or Android's verifier.
- `versionName` is a fixed-width UTF-16 string in the binary manifest, so `sign_apk.py --version-name` only accepts a value
  of the same length (`1.3` → `1.4`). A longer name needs a real `aapt` rebuild.
- Playwright browser and system libs reset between sessions (see §3).
- Search caps at 200 question hits; `effectiveQ()` must be used everywhere questions render (edits override).
- **Silent payload loss in importers.** The original Pharm import dropped `blank`/`aliases`/`left`/`right` because the tuple
  had no slot for them: 554 questions shipped with `opts=[]`, so they rendered no controls and were unanswerable, and the
  bank still "validated" (counts matched upstream exactly). Count parity is *not* proof of fidelity — diff fields, not
  counts. `node tools/test-rich-questions.js` now fails loudly if any row has empty options and no kind.
- Other subjects legitimately use mixed `fmt` names (`fillup`/`fill`, `truefalse`/`tf`, `oddoneout`/`odd`, `case`, `mcq`)
  and keep those as ordinary MCQs with real options — only use `q[7]` when there really are no options.
- Home family card uses `sp` grouping — adding a second subject with the same `sp` automatically creates a volumes view.

## 8. Verification checklist for the next change

1. `node --check tools/app/app.js`, assemble, byte-compare counts: 12 subjects / 4,800 units / 49,709 q
   (and 554 rows carrying `q[7]` — 464 fill + 90 match).
2. Four test suites green (`test-ui`, `test-new-content`, `test-rich-questions`, `smoke-android-js`), zero page errors.
3. Build APK → v1/v2/v3 valid → embedded `assets/index.html` == `index.html` (needs the signing key, §9). Without the
   SDK, `verify_apk.py` proves this independently: ZIP CRCs + alignment, v1 manifest/`.SF`/PKCS#7, v2+v3 content digests
   recomputed from the file, the RSA signatures, and cert == `41380ada…`. Bump `versionCode` for every release.
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

## Latest working-tree update (Oct 29, 2026)

- Imported OPHTHAL chapters 31–50 from `Deva20045/OPHTHAL` chapter JSON artifacts: 123 units and 947 questions. All 50 chapters now have content; the bank has 4,923 units and 50,656 questions. Existing Ophthalmology units and question indexes were preserved so saved progress, edits and review keys continue to refer to the same content. The source artifacts are in `tools/sources/ophthalmology/`; `tools/import_ophthalmology.py` is safe to rerun for already-populated chapters.
- Quiz and flashcard reading surfaces now share structured matching lists and improved typography, spacing and answer/explanation hierarchy. `tools/test-ophthalmology-ui.js` covers the import and these flows.
- The Android APK was repacked and signed as version **1.5 / versionCode 6** with the original key. The new APK embeds the current `index.html` and passes independent v1/v2/v3 signature and embedded-payload checks; its certificate matches version 1.4. The dex, resources and icon are unchanged. SHA-256: APK `c46c8dc43448aafb379fd280aa8ed9e8cc95e53cc4239bb8065b64cbb344205f`; HTML `3f9a9a7cb1c90f5bad852174b1faead9c85fa96e7fff90d1ac3a35de8ceca37c`. No physical Android device or emulator was available for installation testing. Signing material was used only from temporary files and was not added to the repository.
