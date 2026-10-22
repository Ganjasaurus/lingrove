# Lingrove

A browser-based English/Chinese reading and language practice prototype. Static hosting; no paid AI API and no server inference. New Sites publication is private to the owner.

## Run

```sh
npm ci
npm run build
python -m http.server 4173 --directory dist
```

Open `http://localhost:4173`. Local AI needs a secure context (HTTPS or localhost) and a WebGPU adapter. All scripts, fonts, images, stories, and the bilingual dictionary are served from this app. The optional Qwen model weights and model library are downloaded separately.

## What works

- Ten original bilingual lessons, category/level filters, search and bookmarks.
- English/Chinese reader with word lookup, sentence translations, selected-text translation, pinyin, speech synthesis, font controls, and printable worksheets.
- CC-CEDICT with approximately 198,000 simplified/traditional lookup keys and 61,000 English reverse-lookup terms; these are dictionary entries, not unique headword counts. Context-dependent meanings are labeled.
- Locally saved words and phrases, scheduled flashcard review, CSV export.
- Imported English or Chinese text, safely rendered as text.
- Four guided conversation scenes, explicitly labeled as scripted practice.
- Optional Qwen3 0.6B or 1.7B via WebLLM in a web worker, with progress, cancellation, cache removal, GPU capability detection, streaming chat, lesson generation and translation.
- Readiness requires a successful model reply, not just a completed download. Cached models reload after a previous successful opt-in; pending lesson and phrase requests continue after setup.
- Model startup, generation and translation have deadlines. Worker failures show readable errors, Stop recovers from an unresponsive worker, and failed chat messages can be retried.
- Optional Chrome Translator language packs for on-device English/Chinese translation independent of the chat model.
- Service worker caches the app shell. Dictionary and runtime bundles cache when used. Browser eviction can remove cached data.

## Cost and distribution

There is no per-token backend bill: inference runs on the learner's hardware. Hosting, bandwidth, device memory, battery and download/storage costs still exist. The 0.6B model's weight shards total about 335 MB; the 1.7B shards about 968 MB, plus tokenizer and runtime files. The interface rounds up for planning. GPU allocation depends on precision and runtime.

This preview is not a verified mainland-China deployment. Hugging Face, GitHub, Google language-pack downloads, and the hosted preview itself may be unreachable there. Before a school rollout, test on the actual network and devices; host licensed model weights and compiled WASM on a reachable origin with CORS, update the WebLLM `appConfig.model_list` model and model_lib URLs, and test first download, cached startup and storage eviction. Do not use a paid cloud endpoint as a silent fallback. Model licenses must travel with redistributed assets.

Small models can produce incorrect Chinese, pinyin or translations. Original lessons remain available without a model. Teacher review is appropriate before distributing generated classroom material. Unsupported devices receive an actionable error and retain the library, dictionary and guided practice. Browser translation availability is checked by the browser. Speech may use a network-backed system voice if an installed local voice is unavailable.

## Data and privacy

Learning data is in localStorage under `lingrove-v1`, and the last successfully loaded model is remembered under `lingrove-local-ai`; model artifacts are managed by WebLLM browser caches. No analytics, hosted prompts, accounts within the app, cross-device sync or billing. Sites provides private hosting access. CSV exports neutralize formula prefixes. Imported text and model output use escaped text rendering.

## Validation

`npm test` validates bilingual corpus alignment, dictionary mappings, Chinese segmentation, model-response validation, review scheduling and safe rendering/export helpers. It also exercises the actual WebLLM worker-client error protocol, explicit JSON schemas, generation deadlines, cancellation of active/queued work, empty responses and interruption recovery. The underlying GPU worker is replaced with controlled responses in these regression tests.

`python tests/browser.py` uses the environment's installed Playwright and Chromium against port 4173. It checks search/filter/bookmark flows, both translation directions, saving and persistence, flashcards, guided chat, text import, unsupported GPU handling, dictionary lookup and mobile layout. Generated lesson and streaming chat UI are exercised with deterministic mock engines.

`python tests/ai-browser.py` reproduces string errors from the real worker-client protocol in the UI and checks failed lesson recovery, stalled requests, Stop, Retry, structured lessons, readiness gating, setup cancellation, and continuing lesson/phrase requests after successful setup. Model responses are controlled fixtures; these tests do not prove inference quality or hardware compatibility.

`python tests/cache-browser.py` verifies that the versioned AI modules are cached and that the app, reader and downloaded dictionary reload offline.

Live-model check, October 22, 2026: downloaded the actual Qwen3 0.6B q4f32 weights and runtime in Chromium, then verified cached reload. The execution environment has no physical GPU. With a software SwiftShader adapter, inference did not return a reply within the three-minute setup deadline; the updated app displayed a readable error and reset the engine instead of claiming readiness. **Successful real-model generation is not yet verified on supported physical hardware.** Browser-native language pack downloads, system speech voices and mainland-China availability also remain device/network dependent.

The deployed private URL was also checked in Chromium with the existing Sites authorization token: its library and AI device detection loaded without browser exceptions. Hosting returned HTTPS successfully, with no restrictive CSP/Permissions-Policy response headers and no recent server error logs.

The October 2026 repair includes a serialized JSON schema for WebLLM 0.2.85 lesson generation. Its grammar compiler rejects the previous `json_object` request with no schema. WebLLM worker errors can arrive as strings, so all AI boundaries now normalize them before displaying their messages. Updated script URLs and a new service-worker cache version prevent stale AI modules from being reused after this release.

## Dictionary and assets

The distributed adapted dictionary is CC BY-SA 4.0. See `dist/DICTIONARY-LICENSE.txt`. Rebuild using `python scripts/build-dictionary.py [optional-cedict-gzip-path]`; without an argument it downloads the current CC-CEDICT export. Keep the bundled dictionary in source control so rebuilding the app does not depend on an external dictionary download.

WebLLM and Qwen3 are Apache-2.0. DM Sans is distributed under the SIL Open Font License. Photos are from Unsplash. The tea illustration and application lessons were created for Lingrove.

The Sites helper scripts were unavailable in this execution environment. The same source/manifest/archive publication contract is followed with an authenticated Git push and a tar archive containing `.openai/hosting.json` and `dist/` from that source state.
