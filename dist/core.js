import {lessons,phrases,baseWords} from './content.js';
export const normalize=s=>s.trim().toLocaleLowerCase().replace(/[“”"‘’.,!?;:。！？，；：\s]+$/g,'');
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const curated=new Map();
for(const w of [...baseWords,...lessons.flatMap(l=>l.words)]){
  curated.set(`en:${normalize(w[0])}`,{text:w[0],translation:w[1],pinyin:w[2],source:'Built-in dictionary'});
  for(const zh of w[1].split(/[；;]/))if(!/[（…]/.test(zh))curated.set(`zh:${normalize(zh)}`,{text:zh,translation:w[0],pinyin:w[2],source:'Built-in dictionary'});
}
for(const line of [...lessons.flatMap(l=>l.lines),...Object.values(phrases).flat()]){
  curated.set(`en:${normalize(line[0])}`,{text:line[0],translation:line[1],pinyin:line[2],source:'Built-in bilingual lesson'});
  curated.set(`zh:${normalize(line[1])}`,{text:line[1],translation:line[0],pinyin:line[2],source:'Built-in bilingual lesson'});
}
let dictionaryPromise;
export function loadDictionary(){return dictionaryPromise??=(fetch('./dictionary.json').then(r=>{if(!r.ok)throw new Error('The dictionary could not load. Please reconnect and try again.');return r.json()}).catch(e=>{dictionaryPromise=null;throw e}))}
export async function lookupDictionary(text,from){
  const key=normalize(text);
  const known=curated.get(`${from}:${key}`);if(known)return {...known,text};
  const dict=await loadDictionary();
  const match=from==='zh'?dict.zh[key]:dict.en[key];
  if(!match)return null;
  return {text,translation:match[0],pinyin:match[1],source:'CC-CEDICT · dictionary meaning'};
}
export function segment(text,lang){
  if(typeof Intl.Segmenter==='function')return [...new Intl.Segmenter(lang,{granularity:'word'}).segment(text)].map(s=>({text:s.segment,word:s.isWordLike}));
  return text.split(/(\s+|[.,!?;:，。！？；：])/).filter(Boolean).map(t=>({text:t,word:/[\p{L}\p{N}]/u.test(t)}));
}
export function parseGeneratedLesson(raw,{topic,level,id=crypto.randomUUID()}={}){
  let cleaned=raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'').trim();
  const first=cleaned.indexOf('{'),last=cleaned.lastIndexOf('}');
  if(first<0||last<first)throw new Error('The model did not finish a bilingual lesson. Try a shorter lesson or a simpler topic.');
  let data;try{data=JSON.parse(cleaned.slice(first,last+1))}catch{throw new Error('The lesson was incomplete. Try again with a shorter topic.');}
  const lines=data.lines;
  if(!Array.isArray(lines)||lines.length<2||lines.length>12)throw new Error('The model did not return enough bilingual sentences. Please try again.');
  const checked=lines.map(l=>Array.isArray(l)?l:[l.en,l.zh,l.pinyin||'']).map(l=>{
    if(typeof l[0]!=='string'||typeof l[1]!=='string'||!/[a-z]/i.test(l[0])||!/[\u3400-\u9fff]/.test(l[1])||l[0].length>800||l[1].length>800)throw new Error('The model returned an incomplete translation. Please generate again.');
    return [l[0].trim(),l[1].trim(),typeof l[2]==='string'?l[2].trim():''];
  });
  return {id,title:typeof data.title==='string'?data.title.slice(0,120):topic,zhTitle:typeof data.zhTitle==='string'?data.zhTitle.slice(0,120):'',subtitle:`Your lesson about ${topic}`,category:'Your lessons',level,minutes:Math.max(1,Math.ceil(checked.reduce((a,l)=>a+l[0].split(/\s+/).length,0)/100)),image:'books',lines:checked,words:[],generated:true};
}
export function scheduleReview(word,rating,now=Date.now()){
  const interval=rating==='again'?0:rating==='good'?Math.max(1,(word.interval||0)*2):Math.max(4,(word.interval||0)*3);
  return {...word,interval,due:now+(interval?interval*86400000:60000),reviews:(word.reviews||0)+1};
}
export function toCSV(words){return '\uFEFF'+[['Word','Translation','Pinyin','Language','Context'],...words.map(w=>[w.text,w.translation,w.pinyin||'',w.from,w.context||''])].map(row=>row.map(s=>{let v=String(s);if(/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'}).join(',')).join('\r\n')}
