# Lingrove

A small English–Chinese lesson builder. The app downloads Qwen automatically, asks which language the learner wants to practise, and opens a custom lesson prompt. No template library, tutor chat, paid AI API, or server inference is used in this interface.

## Run

```sh
npm ci
npm run build
python -m http.server 4173 --directory dist
```

Open `http://localhost:4173`. Real devices require HTTPS. The app uses WebAssembly on one CPU thread; it does not require WebGPU, SharedArrayBuffer, JSPI, MEMORY64 or cross-origin isolation. Its runtime selects a compatibility build when newer WASM features are absent.

## Lesson flow

- First visit starts setup automatically, as requested by the owner. Before a new model download, a small worker checks real file write/read/flush/close access and deletes its own temporary file. Already cached models can load without this new-write probe. Progress, pause and retry remain visible. A real test reply must pass before setup completes.
- Choose English or Chinese, enter a topic, and create a lesson. Optional controls cover A1–B2, 4/6/8 lines, story/conversation/useful phrases, vocabulary or grammar, and additional instructions.
- The model writes aligned English and Simplified Chinese. Pinyin is computed locally. Complete valid lessons save automatically; partial or monolingual outputs produce a retryable error.
- The reader offers both translations, pronunciation, separate listening buttons for each language or sentence, speed controls, editing, printing and text/JSON downloads.
- Saved lessons support search, backups, import and deletion. Existing custom lessons migrate from the earlier app without deleting its old localStorage data.
- If storage fails, a generated lesson stays in memory, is marked unsaved, and can be downloaded before closing. Backups are the way to move lessons between devices; there is no account or automatic synchronization.

New lesson data is stored under `lingrove-lessons-v2`; model preferences remain under `lingrove-local-ai`. A service worker caches the shell and used runtime assets. Saved lessons and the Basic voice can work offline after their files have loaded. Browser storage eviction or clearing browser data can remove lessons and downloaded assets.

## Local AI

Phone mode uses Qwen3.5 0.8B Q4_K_M through wllama/llama.cpp, with explicit bilingual JSON schemas, thinking disabled, and fresh supplied context for each request. Weights are pinned to revision `6ab461498e2023f6e3c1baea90a8f0fe38ab64d0` of `unsloth/Qwen3.5-0.8B-GGUF`, file `Qwen3.5-0.8B-Q4_K_M.gguf`.

The model is 532,517,120 bytes; published SHA-256 is `bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517`. The self-hosted CPU runtime adds approximately 9 MB, or 16 MB for the compatibility build. The UI rounds this to about 550 MB for first-visit planning. Some iOS in-app browsers expose storage APIs but refuse file access. Setup reports the failed stage and offers a Safari copy-link path, rather than presenting WebKit’s generic UnknownError as proof of exhausted RAM. Saved lessons and backup import remain accessible. Clipboard denial reveals a selectable URL. Cached complete model files are reused. Downloads, storage preflight, readiness and generation have deadlines; Stop interrupts work, and errors release the form for retry.

Inference has no per-token API charge. Device memory, storage, battery, hosting and bandwidth still have costs. Small models can make grammatical or translation errors and may not follow every customization perfectly; users can edit every line. The UI asks for review before teaching. Four-line lessons are the quickest option.

Model downloads come from Hugging Face, which may be unavailable on a mainland-China network. Before a classroom rollout, verify the actual network and phones. A licensed model mirror on a reachable origin can be configured in `src/cpu.js`. No paid cloud fallback is used. Browsers may suspend long tasks in the background; keep the page open during setup and generation.

The build applies a narrow, source-hash-guarded patch to wllama 3.8.1 (`scripts/patch-wllama-381.mjs`). Failed OPFS opening/closing terminates its worker; flush failures still close sync handles. Blob worker URLs are released after startup or termination, including constructor failure. The patch preserves inference behavior and fails closed on dependency upgrades. Fault-injection tests exercise the actual patched cache manager and embedded worker.

## Speech

Automatic speech prefers a matching installed English or Mandarin device voice. Voices are refreshed when the browser announces them, the active utterance is retained, and text is broken into short chunks. Missing, failed or nonstarting device voices fall back to Basic voice. A user can explicitly select Basic voice if a device voice reports playback but remains inaudible.

Basic voice is a locally synthesized eSpeak NG voice, built from exact pinned source with only English and Mandarin data. It sounds robotic but needs no installed phone voices, speech API or network speech provider. Playback uses WebAudio, unlocked during the user's original tap. Stop cancels pending and active playback; old callbacks cannot restart it. Suspended browser audio and failed downloads show visible errors. Device voices themselves may use a phone's network speech provider.

The Basic voice JavaScript/embedded WASM is 580,670 bytes and its data is 2,503,249 bytes, approximately 3.1 MB uncompressed (1.22 MB gzip together). Files are fetched only when needed and cached for subsequent offline listening. Its own runtime memory is approximately 17 MB. A phone's volume, output routing and browser policies still control physical audibility.

Pinned source is `echogarden-project/espeak-ng` commit `9a550bef455f03b459f51796e3482833aab7fbc0` (eSpeak NG 1.52.0.1), built with Emscripten 4.0.21. `third_party/speech/` includes the exact runtime, corresponding source archive, dependency source, notices, build recipe, SDK digest and SHA-256 manifest. The build verifies all delivered hashes and copies these files to `dist/vendor/speech/`. The app links to the GPL-3.0-or-later notice and full corresponding source. See `third_party/speech/REBUILD.md` to compile from source. These assets are not copied from an untraceable npm binary.

## Validation

With the local server running:

```sh
npm test
python tests/browser.py
python tests/setup-browser.py
python tests/speech-browser.py
python tests/cache-browser.py
LINGROVE_REAL_MODEL=1 LINGROVE_TEST_COMPAT=1 python tests/phone-real-browser.py
```

The Python suites use installed Playwright and `/usr/bin/chromium`.

- Unit checks cover AI worker failures, schema requests, deadlines, cancellation/recovery, readiness, lesson migration, storage failures, import/export, output validation and speech language selection/chunking.
- Setup regressions reproduce the exact reported iOS exception against the real CPU adapter and verify that no model download occurs after storage failure, that a real four-byte OPFS probe cleans up, and that Safari/clipboard recovery remains usable.
- Browser UI checks use controlled AI fixtures for automatic setup, customization, autosave, editing, backups, safe rendering, mobile layout, failed download/generation, Stop/retry and legacy data migration.
- Speech tests use the real compiled speech runtime and WebAudio playback for English and Mandarin. They measure nonzero PCM and completed playback, test Stop, speed controls, missing/failed/stalled native voice fallback and blocked audio activation. Native-provider callbacks are controlled where testing failure paths.
- Offline checks load the real voice, disconnect the browser, reload a saved lesson, and play English and Mandarin again.
- The opt-in real-model test uses a persistent browser profile, no GPU, disabled JSPI when requested, an Android user agent and a 393px viewport. It checks actual Qwen startup/readiness, a schema-constrained custom lesson, pinyin, autosave and offline reading. It may download the approximately 533 MB model once. It is phone browser emulation, not a physical Android/iPhone speaker or performance test, and does not establish general translation accuracy.

## Licenses and publication

Qwen3.5 and WebLLM are Apache-2.0. wllama, llama.cpp and pinyin-pro use MIT; notices are under `dist/licenses/`. DM Sans is SIL Open Font License. Basic voice is GPL-3.0-or-later with exact source and rebuilding instructions provided alongside the runtime. The leaf illustration was created for Lingrove.

The Sites helper scripts are unavailable in this environment. Publication follows the same exact-source contract using authenticated Git push and a tar archive containing `.openai/hosting.json` and `dist/`, followed by native Sites save/deploy. The existing hosting audience is preserved.
