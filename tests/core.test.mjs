import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGeneratedLesson,curated,normalize,segment,scheduleReview,escapeHTML,toCSV} from '../dist/core.js';
import {lessons} from '../dist/content.js';
test('every original story has aligned English and Chinese sentences',()=>{
  assert.equal(new Set(lessons.map(l=>l.id)).size,lessons.length);
  for(const l of lessons){assert.ok(l.lines.length>=4);for(const [en,zh,py] of l.lines){assert.match(en,/[A-Za-z]/);assert.match(zh,/[\u3400-\u9fff]/);assert.ok(py)}}
});
test('bilingual lookup maps a sentence both ways',()=>{
  const [en,zh]=lessons[0].lines[0];assert.equal(curated.get('en:'+normalize(en)).translation,zh);assert.equal(curated.get('zh:'+normalize(zh)).translation,en);
});
test('Chinese segmentation retains original text and offers word boundaries',()=>{
  const s='我喜欢学习中文。';const parts=segment(s,'zh');assert.equal(parts.map(p=>p.text).join(''),s);assert.ok(parts.filter(p=>p.word).length>2);
});
test('model output validation rejects missing bilingual pairs',()=>{
  assert.throws(()=>parseGeneratedLesson('{"lines":[["Hello",""]]}',{topic:'Test',level:'A1',id:'test'}));
  assert.throws(()=>parseGeneratedLesson('{"lines":[["Hello","Hello"],["Goodbye","Goodbye"]]}',{topic:'Test',level:'A1',id:'test'}));
  const l=parseGeneratedLesson('```json\n{"title":"A new day","zhTitle":"新的一天","lines":[["Hello.","你好。","Nǐ hǎo."],["Goodbye.","再见。","Zàijiàn."]]}\n```',{topic:'Greetings',level:'A1',id:'test'});assert.equal(l.lines.length,2);assert.equal(l.id,'test');assert.equal(l.generated,true);
});
test('review dates respect recall difficulty and previous interval',()=>{
  const now=10000;assert.equal(scheduleReview({},'again',now).due,now+60000);assert.equal(scheduleReview({},'good',now).interval,1);assert.equal(scheduleReview({interval:4,reviews:2},'easy',now).interval,12);assert.equal(scheduleReview({reviews:2},'good',now).reviews,3);
});
test('imported and generated text is escaped, CSV preserves Chinese and quotes',()=>{
  assert.equal(escapeHTML('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');const csv=toCSV([{text:'hello, "friend"',translation:'你好',from:'en'}]);assert.ok(csv.includes('"hello, ""friend"""'));assert.ok(csv.includes('你好'));
});
