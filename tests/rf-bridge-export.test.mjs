import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RF_APPS,
  isTrustedRfOrigin,
  resolveRfAppUrl,
  base64UrlToBytes,
  sendToRfApp,
  installRfImportReceiver,
} from '../dist/rf-bridge.js';
import { encodeWavPcm16, lessonSpeechItems, renderLessonWav } from '../dist/speech.js';
import { LessonStore, buildInstantLesson } from '../dist/lessons.js';
import { pinyinFor } from '../dist/vendor/language.js';

test('rf-bridge v1 resolves target URLs, MASQUE coopRelay, and completes synchronous window.open + rf:ack', async () => {
  assert.deepEqual(RF_APPS.lingrove.accepts, ['audio', 'json', 'image']);
  assert.equal(isTrustedRfOrigin('https://ripperclip.retrofleshed.com'), true);
  assert.equal(isTrustedRfOrigin('http://127.0.0.1:4173'), true);
  assert.equal(isTrustedRfOrigin('https://attacker.invalid'), false);

  const masqueUrl = new URL(resolveRfAppUrl('masque', 'lingrove', 'image', 'mouth', 'rf_tok'));
  assert.equal(masqueUrl.pathname, '/rf-relay.html');
  assert.equal(masqueUrl.searchParams.get('rf_import'), '1');

  const prevWin = globalThis.window;
  const prevLoc = globalThis.location;
  const prevHist = globalThis.history;
  const listeners = new Map();
  const order = [];
  let openedWin = null;

  globalThis.location = new URL('http://127.0.0.1:4173/#/read/tea');
  globalThis.history = { state: null, replaceState: () => {} };
  globalThis.window = {
    location: globalThis.location,
    opener: null,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    open(url, target) {
      order.push(`open:${target}:${new URL(url).hostname}`);
      openedWin = {
        postMessage(msg, targetOrigin) {
          assert.equal(targetOrigin, 'https://ripperclip.retrofleshed.com');
          order.push(`post:${msg.type}:${msg.kind}:${msg.name}`);
          for (const fn of listeners.get('message') ?? []) {
            fn({
              origin: 'https://ripperclip.retrofleshed.com',
              source: openedWin,
              data: { type: 'rf:ack', token: msg.token, app: 'ripperclip' },
            });
          }
        },
      };
      setTimeout(() => {
        for (const fn of listeners.get('message') ?? []) {
            const postsBefore = order.filter(v => v.startsWith('post:')).length;
            fn({ origin: 'https://attacker.invalid', source: openedWin, data: { type: 'rf:ready' } });
            fn({ origin: 'https://ripperclip.retrofleshed.com', source: {}, data: { type: 'rf:ready' } });
            assert.equal(order.filter(v => v.startsWith('post:')).length, postsBefore);
          fn({
            origin: 'https://ripperclip.retrofleshed.com',
            source: openedWin,
            data: { type: 'rf:ready', app: 'ripperclip' },
          });
        }
      }, 10);
      return openedWin;
    },
  };

  try {
    const p = sendToRfApp({
      from: 'lingrove',
      to: 'ripperclip',
      kind: 'audio',
      producePayload: async () => {
        order.push('produce');
        return { blob: encodeWavPcm16(new Int16Array([1000, -1000]), 22050), name: 'tea-lesson.wav', mime: 'audio/wav' };
      },
    });
    assert.equal(order[0], 'open:_blank:ripperclip.retrofleshed.com');
    const res = await p;
    assert.deepEqual(res, { delivered: true, fallback: false });
    assert.ok(order.includes('post:rf:import:audio:tea-lesson.wav'));

    // Hash #rf_b64 receiver
    const imported = [];
    const payload = new TextEncoder().encode(JSON.stringify({ id: 'h1', title: 'Hash Lesson', lines: [['Hi', '你好', '']] }));
    const b64 = Buffer.from(payload).toString('base64url');
    assert.equal(base64UrlToBytes(b64).byteLength, payload.byteLength);
    const meta = encodeURIComponent(JSON.stringify({
      token: 'rf_h1',
      from: 'petstudio',
      to: 'lingrove',
      kind: 'json',
      name: 'lesson.json',
      mime: 'application/json',
    }));
    globalThis.location = new URL(`http://127.0.0.1:4173/#rf_meta=${meta}&rf_b64=${b64}`);
    globalThis.window.location = globalThis.location;
    installRfImportReceiver({
      appId: 'lingrove',
      accepts: ['image', 'json', 'audio'],
      onImport: (pkt) => imported.push(pkt),
    });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(imported.length, 1);
    assert.equal(imported[0].kind, 'json');
    assert.equal(imported[0].name, 'lesson.json');
  } finally {
    globalThis.window = prevWin;
    globalThis.location = prevLoc;
    globalThis.history = prevHist;
  }
});

test('renderLessonWav concatenates Int16Array PCM chunks with 0.35s silence pauses and 44-byte RIFF WAV header', async () => {
  const sampleLesson = {
    id: 'tea',
    title: 'Ordering tea',
    zhTitle: '点茶',
    language: 'zh',
    level: 'A2',
    lines: [
      ['I would like tea.', '我想要一杯茶。', 'Wǒ xiǎng yào yì bēi chá.'],
    ],
  };
  const items = lessonSpeechItems(sampleLesson, { lang: 'bilingual' });
  assert.equal(items.length, 3); // zhTitle + zh line + en line

  const sampleRate = 10000;
  const chunkLen = 500;
  const wavBlob = await renderLessonWav(sampleLesson, {
    lang: 'bilingual',
    rate: 0.9,
    pauseSec: 0.35,
    synthesizeFn: async (item) => {
      const pcm = new Int16Array(chunkLen);
      pcm.fill(item.lang === 'zh' ? 4200 : -3100);
      return { pcm, sampleRate };
    },
  });
  assert.equal(wavBlob.type, 'audio/wav');
  const ab = await wavBlob.arrayBuffer();
  const dv = new DataView(ab);
  const tag = (off) => String.fromCharCode(...new Uint8Array(ab, off, 4));
  assert.equal(tag(0), 'RIFF');
  assert.equal(tag(8), 'WAVE');
  assert.equal(tag(12), 'fmt ');
  assert.equal(tag(36), 'data');
  assert.equal(dv.getUint16(20, true), 1);
  assert.equal(dv.getUint16(22, true), 1);
  assert.equal(dv.getUint32(24, true), sampleRate);
  assert.equal(dv.getUint16(34, true), 16);

  const pcmOut = new Int16Array(ab, 44);
  const pauseSamples = Math.round(sampleRate * 0.35); // 3500
  const tailSamples = Math.round(sampleRate * 0.12); // 1200
  assert.equal(pcmOut.length, chunkLen * 3 + pauseSamples * 2 + tailSamples);
  assert.equal(pcmOut[0], 4200);
  // First 0.35s pause must be silence (0)
  assert.equal(pcmOut[chunkLen + 100], 0);
  // Second chunk starts right after 0.35s pause
  assert.equal(pcmOut[chunkLen + pauseSamples], 4200);
  // Third chunk (English) starts after second 0.35s pause
  assert.equal(pcmOut[chunkLen * 2 + pauseSamples * 2], -3100);
});

test('buildInstantLesson converts .md/.txt with CJK lines and populates tonal pinyin via pinyinFor', () => {
  const md = `# 春天的公园\nGood morning! | 早上好！\nThe flowers are blooming.\n花儿都开了。`;
  const built = buildInstantLesson(md, { filename: 'park.md', defaultLang: 'en', pinyinFn: pinyinFor, id: 'md-1', now: 1000 });
  assert.equal(built.language, 'zh');
  assert.equal(built.title, '春天的公园');
  assert.equal(built.lines.length, 2);
  assert.equal(built.lines[0][0], 'Good morning!');
  assert.equal(built.lines[0][1], '早上好！');
  assert.match(built.lines[0][2], /zǎo/i);
  assert.equal(built.lines[1][0], 'The flowers are blooming.');
  assert.equal(built.lines[1][1], '花儿都开了。');
  assert.ok(built.lines[1][2].length > 0);

  // Single-lesson JSON object also imports via LessonStore.importBackup
  const mem = new Map();
  const store = new LessonStore({ getItem: (k) => mem.get(k) || null, setItem: (k, v) => mem.set(k, v) });
  assert.equal(store.importBackup(JSON.stringify(built)), 1);
  assert.equal(store.data.lessons[0].id, 'md-1');
});
