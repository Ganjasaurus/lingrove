# Lingrove English and Mandarin speech runtime

This runtime is built directly from eSpeak NG source; it is not the npm 0.3.5 binary.

Upstream source: https://github.com/echogarden-project/espeak-ng/tree/9a550bef455f03b459f51796e3482833aab7fbc0

Exact upstream source archive SHA-256: `06afb088f1e9b0546c8be0c0c3295ad7851a846a1242e9850856dbfb6a344271`.

The pinned CMake build dependency is Sonic commit `fbf75c3d6d846bad3bb3d456cbc5d07d9fd8c104` (https://github.com/waywardgeek/sonic/tree/fbf75c3d6d846bad3bb3d456cbc5d07d9fd8c104). Its source archive SHA-256 is `715827b5a39b79e56e44397d7b845910df996d4cca74777b3b61629b1ddc98c1`. Sonic is supplied to satisfy the upstream CMake configuration without network fetching; runtime acceleration is disabled with `USE_LIBSONIC=OFF`.

The complete source archive includes both original upstream archives, this file, the exact build script, and license notices. Extract the two nested source archives into the same directory alongside `build-speech.sh`:

```sh
tar -xzf upstream-source.tar.gz
tar -xzf sonic-source.tar.gz
```

Build toolchain: Emscripten SDK 4.0.21, official Linux amd64 Docker image pinned to:

```text
emscripten/emsdk@sha256:631841e7ee7a808bc2735a4f26aff3c1354119764df8459c38abfe2d0923dffb
```

From the directory containing the extracted source directories and build script:

```sh
docker run --rm --platform linux/amd64 --network none \
  --mount "type=bind,src=$PWD,dst=/speech" \
  --workdir /speech/espeak-ng-9a550bef455f03b459f51796e3482833aab7fbc0 \
  emscripten/emsdk@sha256:631841e7ee7a808bc2735a4f26aff3c1354119764df8459c38abfe2d0923dffb \
  sh /speech/build-speech.sh
```

The outputs are `espeak-ng-9a550bef455f03b459f51796e3482833aab7fbc0/emscripten/espeak-ng.js` and `espeak-ng.data`. Keep them together when serving. The JavaScript contains the embedded WebAssembly module. There is no separate WASM file. The build uses no browser threads, GPU, or cross-origin isolation.

The final Emscripten Makefile invocation explicitly uses `python3` for the WebIDL binder and data packager because this SDK image has no `python` alias. These exact overrides are recorded in the build script.

No upstream source files were modified. The supplied build script follows the fork's build settings and selects only English and Mandarin dictionaries/language descriptors from generated data. Shared phoneme data and voice variants remain. All original source and language data are included in the source archives.

Licenses: eSpeak NG is GPL-3.0-or-later, with the original GPL notice in `COPYING`. The upstream tree also contains the original BSD notice in `COPYING.BSD2` and component notices. Sonic is Apache-2.0, included in its source archive. Keep these notices and provide the complete corresponding source and build instructions when redistributing the generated speech engine.
