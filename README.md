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
- Optional Chrome Translator language packs for on-device English/Chinese translation independent of the chat model.
- Service worker caches the app shell. Dictionary and runtime bundles cache when used. Browser eviction can remove cached data.

## Cost and distribution

There is no per-token backend bill: inference runs on the learner's hardware. Hosting, bandwidth, device memory, battery and download/storage costs still exist. The 0.6B model's weight shards total about 335 MB; the 1.7B shards about 968 MB, plus tokenizer and runtime files. The interface rounds up for planning. GPU allocation depends on precision and runtime.

This preview is not a verified mainland-China deployment. Hugging Face, GitHub, Google language-pack downloads, and the hosted preview itself may be unreachable there. Before a school rollout, test on the actual network and devices; host licensed model weights and compiled WASM on a reachable origin with CORS, update the WebLLM `appConfig.model_list` model and model_lib URLs, and test first download, cached startup and storage eviction. Do not use a paid cloud endpoint as a silent fallback. Model licenses must travel with redistributed assets.

Small models can produce incorrect Chinese, pinyin or translations. Original lessons remain available without a model. Teacher review is appropriate before distributing generated classroom material. Unsupported devices receive an actionable error and retain the library, dictionary and guided practice. Browser translation availability is checked by the browser. Speech may use a network-backed system voice if an installed local voice is unavailable.

## Data and privacy

Learning data is in localStorage under `lingrove-v1`; model artifacts are managed by WebLLM browser caches. No analytics, hosted prompts, accounts within the app, cross-device sync or billing. Sites provides private hosting access. CSV exports neutralize formula prefixes. Imported text and model output use escaped text rendering.

## Validation

`npm test` validates bilingual corpus alignment, dictionary mappings, Chinese segmentation, model-response validation, review scheduling and safe rendering/export helpers.

`python tests/browser.py` uses the environment's installed Playwright and Chromium against port 4173. It checks search/filter/bookmark flows, both translation directions, saving and persistence, flashcards, guided chat, text import, unsupported GPU handling, dictionary lookup and mobile layout. Generated lesson and streaming chat UI are exercised with deterministic mock engines. The test environment has no usable WebGPU adapter, so actual GPU model download/inference has **not** been validated. Browser-native language pack downloads and speech voice availability also depend on the user's browser and device.

## Dictionary and assets

The distributed adapted dictionary is CC BY-SA 4.0. See `dist/DICTIONARY-LICENSE.txt`. Rebuild using `python scripts/build-dictionary.py [optional-cedict-gzip-path]`; without an argument it downloads the current CC-CEDICT export. Keep the bundled dictionary in source control so rebuilding the app does not depend on an external dictionary download.

WebLLM and Qwen3 are Apache-2.0. DM Sans is distributed under the SIL Open Font License. Photos are from Unsplash. The tea illustration and application lessons were created for Lingrove.

The Sites helper scripts were unavailable in this execution environment. The same source/manifest/archive publication contract is followed with an authenticated Git push and a tar archive containing `.openai/hosting.json` and `dist/` from that source state.
