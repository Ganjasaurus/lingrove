# Lingrove

A browser-based English/Chinese reading and language practice prototype. Static hosting; no paid AI API and no server inference. New Sites publication is private to the owner.

## Run

```sh
npm ci
npm run build
python -m http.server 4173 --directory dist
```

Open `http://localhost:4173`. Phone mode needs a modern browser with WebAssembly and a secure context (HTTPS or localhost). It runs on one CPU thread and does not require WebGPU, SharedArrayBuffer, JSPI, MEMORY64, or cross-origin isolation. The runtime automatically chooses its compatibility build when newer WASM features are absent. Application scripts, CPU WASM runtimes, fonts, images, stories, and the bilingual dictionary are served from this app. Model weights download separately from Hugging Face; the optional GPU backend also downloads its compiled model runtime.

## What works

- Ten original bilingual lessons, category/level filters, search and bookmarks.
- English/Chinese reader with word lookup, sentence translations, selected-text translation, pinyin, speech synthesis, font controls, and printable worksheets.
- CC-CEDICT with approximately 198,000 simplified/traditional lookup keys and 61,000 English reverse-lookup terms; these are dictionary entries, not unique headword counts. Context-dependent meanings are labeled.
- Locally saved words and phrases, scheduled flashcard review, CSV export.
- Imported English or Chinese text, safely rendered as text.
- Four guided conversation scenes, explicitly labeled as scripted practice.
- Recommended Phone mode: Qwen3.5 0.8B Q4_K_M through wllama/llama.cpp in a CPU worker. Optional Qwen3 0.6B or 1.7B through WebLLM uses compatible GPUs.
- Both engines provide streaming chat, lesson generation, translation, download progress, cancellation, cache removal and recovery. Chat and lessons use explicit bilingual JSON schemas. Short worked examples guide tutor replies and translation. CPU requests evaluate a fresh supplied context, with bounded conversation history; thinking is explicitly disabled in the chat template. Pinyin is computed locally with pinyin-pro, reducing generation work and avoiding invented romanization.
- Readiness requires a successful model reply, not just a completed download. Cached models reload after a previous successful opt-in; pending lesson and phrase requests continue after setup.
- Model startup, generation and translation have deadlines. Worker failures show readable errors, Stop recovers from an unresponsive worker, and failed chat messages can be retried.
- Optional Chrome Translator language packs for on-device English/Chinese translation independent of the chat model.
- Service worker caches the app shell. Dictionary and runtime bundles cache when used. Browser eviction can remove cached data.

## Cost and distribution

There is no per-token backend bill: inference runs on the learner's hardware. Hosting, bandwidth, device memory, battery and download/storage costs still exist. Phone mode downloads 532,517,120 bytes of model weights, plus the self-hosted runtime (approximately 9 MB, or 16 MB for the compatibility build). Its GGUF cache is separate from older WebLLM downloads. The GPU 0.6B model's weight shards total about 335 MB; the 1.7B shards about 968 MB, plus tokenizer and runtime files. The interface rounds up for planning. Memory allocation depends on the engine and device.

Phone model source is pinned to revision `6ab461498e2023f6e3c1baea90a8f0fe38ab64d0` of `unsloth/Qwen3.5-0.8B-GGUF`, file `Qwen3.5-0.8B-Q4_K_M.gguf`; published SHA-256 is `bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517`. The runtime reuses complete cached files and honors download cancellation. Phone mode is the default for new users. Old GPU preferences without the new backend metadata are ignored on mobile, so returning phone users are offered the new mode; an explicit new GPU choice is remembered.

This preview is not a verified mainland-China deployment. Hugging Face, GitHub, Google language-pack downloads, and the hosted preview itself may be unreachable there. Before a school rollout, test on the actual network and devices; host licensed model weights and compiled WASM on a reachable origin with CORS, update the Phone model URL in `src/cpu.js` and the WebLLM `appConfig.model_list` model and model_lib URLs, and test first download, cached startup and storage eviction. Do not use a paid cloud endpoint as a silent fallback. Model licenses must travel with redistributed assets.

Small models can produce incorrect Chinese or translations, and dictionary-based pinyin can still misread ambiguous characters. Original lessons remain available without a model. Teacher review is appropriate before distributing generated classroom material. Unsupported devices receive an actionable error and retain the library, dictionary and guided practice. Browsers can suspend work in background tabs, and some phones may not have enough free memory; keep the tab open during generation. Browser translation availability is checked by the browser. Speech may use a network-backed system voice if an installed local voice is unavailable.

## Data and privacy

Learning data is in localStorage under `lingrove-v1`, and the last successfully loaded model is remembered under `lingrove-local-ai`; model artifacts are managed by wllama’s browser storage and WebLLM browser caches. No analytics, hosted prompts, accounts within the app, cross-device sync or billing. Sites provides private hosting access. CSV exports neutralize formula prefixes. Imported text and model output use escaped text rendering.

## Validation

`npm test` validates bilingual corpus alignment, dictionary mappings, Chinese segmentation, model-response validation, review scheduling and safe rendering/export helpers. It also exercises the actual WebLLM worker-client error protocol, explicit JSON schemas, generation deadlines, cancellation of active/queued work, empty responses and interruption recovery. The underlying GPU worker is replaced with controlled responses in these regression tests.

`python tests/browser.py` uses the environment's installed Playwright and Chromium against port 4173. It checks search/filter/bookmark flows, both translation directions, saving and persistence, flashcards, guided chat, text import, unsupported GPU handling, dictionary lookup and mobile layout. Generated lesson and streaming chat UI are exercised with deterministic mock engines.

`python tests/ai-browser.py` reproduces string errors from the real worker-client protocol in the UI and checks failed lesson recovery, stalled requests, Stop, Retry, structured lessons, readiness gating, setup cancellation, and continuing lesson/phrase requests after successful CPU setup with no GPU. Model responses are controlled fixtures; these tests do not prove inference quality or hardware compatibility.

`python tests/cache-browser.py` verifies that the versioned AI modules are cached and that the app, reader and downloaded dictionary reload offline.

`LINGROVE_REAL_MODEL=1 LINGROVE_TEST_COMPAT=1 python tests/phone-real-browser.py` is the opt-in real-model test. It downloads approximately 533 MB once into a persistent test profile and runs without a GPU, JSPI or cross-origin isolation. It covers actual model readiness, bilingual chat with a useful tea-ordering phrase, English-to-Chinese and Chinese-to-English translation, a schema-constrained lesson, interruption and offline cached startup. Basic meaning checks supplement language and schema checks; they do not establish general translation accuracy. It uses a mobile viewport and Android user agent; it is **not** a physical phone benchmark. The compatibility runtime has produced real Qwen3.5 replies in this environment. A separate initial runtime smoke test used a smaller model.

The execution environment has no physical GPU. The earlier WebLLM Qwen3 q4f32 check downloaded successfully but did not generate a reply using a software SwiftShader adapter. Successful inference on physical Android/iPhone hardware, browser-native language pack downloads, system speech voices and mainland-China access still require device/network testing.

The deployed private URL was also checked in Chromium with the existing Sites authorization token: its library and AI device detection loaded without browser exceptions. Hosting returned HTTPS successfully, with no restrictive CSP/Permissions-Policy response headers and no recent server error logs.

The October 2026 repair includes a serialized JSON schema for WebLLM 0.2.85 lesson generation. Its grammar compiler rejects the previous `json_object` request with no schema. WebLLM worker errors can arrive as strings, so all AI boundaries now normalize them before displaying their messages. Updated script URLs and a new service-worker cache version prevent stale AI modules from being reused after this release.

The phone update replaces the fragile eight-token readiness check with a 64-token check. WebLLM inserts four hidden Qwen3 thinking-control tokens even with thinking disabled, so the old budget allowed only four generated tokens. A completed empty reply is retried once within one shared deadline. Cancellation, crashes and timeouts do not retry a broken worker. Readiness diagnostics retain only token counts, finish reason and text lengths in memory. They do not retain prompt/reply text or send telemetry.

## Dictionary and assets

The distributed adapted dictionary is CC BY-SA 4.0. See `dist/DICTIONARY-LICENSE.txt`. Rebuild using `python scripts/build-dictionary.py [optional-cedict-gzip-path]`; without an argument it downloads the current CC-CEDICT export. Keep the bundled dictionary in source control so rebuilding the app does not depend on an external dictionary download.

WebLLM, Qwen3 and Qwen3.5 0.8B are Apache-2.0. wllama, llama.cpp and pinyin-pro are MIT; notices are bundled under `dist/licenses/`. DM Sans is distributed under the SIL Open Font License. Photos are from Unsplash. The tea illustration and application lessons were created for Lingrove.

The Sites helper scripts were unavailable in this execution environment. The same source/manifest/archive publication contract is followed with an authenticated Git push and a tar archive containing `.openai/hosting.json` and `dist/` from that source state.
