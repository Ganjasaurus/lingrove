#!/bin/sh
# Build a self-contained eSpeak NG browser runtime with English and Mandarin data.
# Source: echogarden-project/espeak-ng commit 9a550bef455f03b459f51796e3482833aab7fbc0.
# Run from the extracted source directory with emscripten/emsdk:4.0.21.
set -eu
SPEECH_BUILD_ROOT=$(dirname "$(pwd)")
SPEECH_SONIC_SOURCE="$SPEECH_BUILD_ROOT/sonic-fbf75c3d6d846bad3bb3d456cbc5d07d9fd8c104"
cmake -B build-native "-DFETCHCONTENT_SOURCE_DIR_SONIC-GIT=$SPEECH_SONIC_SOURCE" -D CMAKE_BUILD_TYPE=Release -D CMAKE_INSTALL_PREFIX=/usr -D USE_ASYNC=OFF -D USE_MBROLA=OFF -D USE_LIBPCAUDIO=OFF -D USE_LIBSONIC=OFF -D ENABLE_TESTS=OFF
cmake --build build-native -j 4
cmake --build build-native --target data
emcmake cmake -B build-emscripten "-DFETCHCONTENT_SOURCE_DIR_SONIC-GIT=$SPEECH_SONIC_SOURCE" -D CMAKE_BUILD_TYPE=Release -D CMAKE_C_FLAGS_RELEASE='-O3 -DNDEBUG -flto=thin' -D CMAKE_CXX_FLAGS_RELEASE='-O3 -DNDEBUG -flto=thin' -D CMAKE_INSTALL_PREFIX=/usr -D BUILD_SHARED_LIBS=OFF -D USE_ASYNC=OFF -D USE_MBROLA=OFF -D USE_LIBPCAUDIO=OFF -D USE_LIBSONIC=OFF -D USE_SPEECHPLAYER=ON -D USE_KLATT=ON -D COMPILE_INTONATIONS=OFF -D ENABLE_TESTS=OFF
cmake --build build-emscripten -j 4
# Remove unneeded generated dictionaries and language descriptors only.
# Common phoneme tables, variants, English, and Mandarin data remain.
python3 - <<'PY'
from pathlib import Path
root = Path('build-native/espeak-ng-data')
for path in root.glob('*_dict'):
    if path.name not in ('en_dict', 'cmn_dict'):
        path.unlink()
for path in (root / 'lang').rglob('*'):
    if path.is_file():
        relative = path.relative_to(root / 'lang').as_posix()
        if not (relative.startswith('gmw/en') or relative.startswith('sit/cmn')):
            path.unlink()
PY
cd emscripten
emmake make clean
emmake make 'EM_WEBIDL_BINDER=python3 $(EMSCRIPTEN)/tools/webidl_binder.py' 'EM_FILE_PACKAGER=python3 $(EMSCRIPTEN)/tools/file_packager.py'
