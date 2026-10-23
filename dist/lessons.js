export const STORAGE_KEY='lingrove-lessons-v2';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const defaults={topic:'',level:'A2',length:4,format:'story',focus:'',instructions:''};
export function cleanSpec(value={}){
  return {topic:String(value.topic||'').slice(0,400),level:['A1','A2','B1','B2'].includes(value.level)?value.level:'A2',length:[4,6,8].includes(Number(value.length))?Number(value.length):4,format:['story','dialogue','phrases'].includes(value.format)?value.format:'story',focus:String(value.focus||'').slice(0,160),instructions:String(value.instructions||'').slice(0,300)};
}
function cleanLesson(value,index=0){
  if(!value||!Array.isArray(value.lines)||!value.lines.length)return null;
  const lines=value.lines.slice(0,200).map(line=>Array.isArray(line)?line:[line?.en,line?.es??line?.zh,line?.pinyin]).filter(line=>typeof line[0]==='string'||typeof line[1]==='string').map(line=>[String(line[0]||'').slice(0,2000),String(line[1]||'').slice(0,2000),String(line[2]||'').slice(0,2000)]);
  if(!lines.length)return null;
  const rawLang=value.language||value.originalLanguage,lang=rawLang==='zh'?'zh':rawLang==='es'?'es':'en';
  return {id:String(value.id||`imported-${index}`).slice(0,160),title:String(value.title||'My lesson').slice(0,120),zhTitle:String(value.zhTitle||value.esTitle||'').slice(0,120),language:lang,level:['A1','A2','B1','B2'].includes(value.level)?value.level:'A2',lines,createdAt:Number(value.createdAt)||0,updatedAt:Number(value.updatedAt)||0,spec:cleanSpec(value.spec||{topic:value.subtitle?.replace(/^Your lesson about /,''),level:value.level,length:lines.length})};
}
export class LessonStore{
  constructor(storage){
    this.storage=storage;this.readError=null;
    try{
      const current=storage.getItem(STORAGE_KEY);
      if(current){const data=JSON.parse(current);this.data={...data,lessons:(data.lessons||[]).map(cleanLesson).filter(Boolean),draft:cleanSpec(data.draft)};return}
      const old=JSON.parse(storage.getItem('lingrove-v1')||'{}');
      this.data={version:2,language:old.language==='zh'?'zh':old.language==='es'?'es':'en',languageChosen:false,draft:{...defaults},lessons:(old.custom||[]).map((l,i)=>cleanLesson({...l,language:old.language},i)).filter(Boolean),speech:{rate:.85,mode:'auto'},showTranslations:true,showPinyin:true};
    }catch{this.readError='Saved data could not be read in this browser.';this.data={version:2,language:'en',languageChosen:false,draft:{...defaults},lessons:[],speech:{rate:.85,mode:'auto'},showTranslations:true,showPinyin:true}}
  }
  write(next){
    try{this.storage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{throw new Error('This browser could not save the lesson. Download a backup before closing this page.')}
    this.data=next;
  }
  preferences(patch){this.write({...this.data,...patch})}
  save(lesson){this.write({...this.data,lessons:[lesson,...this.data.lessons.filter(l=>l.id!==lesson.id)]})}
  remove(id){this.write({...this.data,lessons:this.data.lessons.filter(l=>l.id!==id)})}
  importBackup(raw){
    const parsed=JSON.parse(raw),items=Array.isArray(parsed.lessons)?parsed.lessons:parsed.lesson?[parsed.lesson]:[];
    if(!items.length||items.length>300)throw new Error('Choose a Lingrove lesson backup with up to 300 lessons.');
    const lessons=items.map(cleanLesson).filter(Boolean);if(lessons.length!==items.length)throw new Error('Some lessons in this backup are incomplete.');
    const existing=new Set(this.data.lessons.map(l=>l.id));let added=0;
    for(const lesson of lessons){if(existing.has(lesson.id))continue;existing.add(lesson.id);added++}
    const unique=new Map(this.data.lessons.map(l=>[l.id,l]));for(const lesson of lessons)if(!unique.has(lesson.id))unique.set(lesson.id,lesson);
    this.write({...this.data,lessons:[...unique.values()]});return added;
  }
}
export function parseLesson(raw,{spec,language,id=crypto.randomUUID(),now=Date.now()}={}){
  let data;try{data=JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'').trim())}catch{throw new Error('The lesson was incomplete. Try a shorter lesson or a simpler prompt.')}
  if(!Array.isArray(data.lines)||data.lines.length!==spec.length)throw new Error('The model did not finish the requested number of lines. Try again with a shorter lesson.');
  const lines=data.lines.map(line=>{
    if(language==='es'){const es=typeof line.es==='string'?line.es:typeof line.zh==='string'?line.zh:'';if(typeof line.en!=='string'||!es||!/[A-Za-z]/.test(line.en)||!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(es)||line.en.length>800||es.length>800)throw new Error('A translation was incomplete. Try generating again.');return [line.en.trim(),es.trim(),'']}
    if(typeof line.en!=='string'||typeof line.zh!=='string'||!/[A-Za-z]/.test(line.en)||!/[\u3400-\u9fff]/u.test(line.zh)||line.en.length>800||line.zh.length>800)throw new Error('A translation was incomplete. Try generating again.');
    return [line.en.trim(),line.zh.trim(),''];
  });
  const rawTitle=language==='es'?(typeof data.esTitle==='string'&&data.esTitle?data.esTitle:typeof data.zhTitle==='string'?data.zhTitle:''):(typeof data.zhTitle==='string'?data.zhTitle:'');
  return {id,title:typeof data.title==='string'&&data.title.trim()?data.title.trim().slice(0,120):spec.topic,zhTitle:rawTitle.slice(0,120),language:language==='zh'?'zh':language==='es'?'es':'en',level:spec.level,lines,spec:{...spec},createdAt:now,updatedAt:now};
}
export function lessonMessages(spec,language){
  if(language==='es'){const esFormat={story:'a coherent short story',dialogue:'a natural dialogue between A and B: alternate questions and answers, one turn per line. Prefix BOTH en and es with A: or B: for the speaker',phrases:'useful standalone phrases for the situation'}[spec.format];return [{role:'system',content:`Write English–Spanish lessons. The student is learning Spanish at CEFR ${spec.level}. Return JSON: title (English), esTitle (Spanish), lines (objects with en and es). Write exactly ${spec.length} lines, as ${esFormat}. Use short sentences, at most 12 English words per line. Translate each English line into natural Spanish with exactly the same meaning. ${spec.format==='dialogue'?'Example turns: {"en":"A: What would you like?","es":"A: ¿Qué te gustaría?"}, {"en":"B: I would like some water, please.","es":"B: Me gustaría un poco de agua, por favor."}.':'Example: {"en":"I really like apples.","es":"Me gustan mucho las manzanas."}.'} No extra keys. /no_think`},{role:'user',content:`Topic: ${spec.topic}${spec.focus?'\nInclude this vocabulary or grammar: '+spec.focus:''}${spec.instructions?'\nOther requests: '+spec.instructions:''}`}]}
  const format={story:'a coherent short story',dialogue:'a natural dialogue between A and B: alternate questions and answers, one turn per line. Prefix BOTH en and zh with A: or B: for the speaker',phrases:'useful standalone phrases for the situation'}[spec.format];
  return [{role:'system',content:`Write English–Simplified Chinese lessons. The student is learning ${language==='zh'?'Mandarin Chinese':'English'} at CEFR ${spec.level}. Return JSON: title (English), zhTitle (Chinese), lines (objects with en and zh). Write exactly ${spec.length} lines, as ${format}. Use short sentences, at most 12 English words per line. Translate each English line into natural Simplified Chinese with exactly the same meaning. ${spec.format==='dialogue'?'Example turns: {"en":"A: What would you like?","zh":"A: 你想要什么？"}, {"en":"B: I would like some water, please.","zh":"B: 请给我一些水。"}.':'Example: {"en":"I really like apples.","zh":"我很喜欢苹果。"}.'} No pinyin or extra keys. /no_think`},{role:'user',content:`Topic: ${spec.topic}${spec.focus?'\nInclude this vocabulary or grammar: '+spec.focus:''}${spec.instructions?'\nOther requests: '+spec.instructions:''}`}];
}
export function lessonText(lesson){return [lesson.title,lesson.zhTitle,`${lesson.level} · ${lesson.language==='zh'?'Learning Chinese':lesson.language==='es'?'Learning Spanish':'Learning English'}`,'',...lesson.lines.flatMap(line=>[...line.filter(Boolean),''])].join('\n')}
export function backup(lessons){return JSON.stringify({app:'Lingrove',version:2,exportedAt:new Date().toISOString(),lessons},null,2)}
