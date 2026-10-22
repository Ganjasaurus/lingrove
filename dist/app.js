import {ai,subscribeAI,enableAI,cancelAI,complete,stopGeneration,normalizeAIError} from './ai.js?v=6';
import {lessonSchema} from './ai-support.js?v=6';
import {pinyinFor} from './vendor/language.js?v=6';
import {LessonStore,escapeHTML as esc,cleanSpec,parseLesson,lessonMessages,lessonText,backup} from './lessons.js?v=6';
import {speech,playSpeech,stopSpeech,subscribeSpeech} from './speech.js?v=6';
import {isAppleMobile} from './setup-support.js?v=6';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const paths={arrow:'M4 12h16m-6-6 6 6-6 6',back:'M20 12H4m6-6-6 6 6 6',spark:'m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z',sound:'M11 4 6 8H2v8h4l5 4V4Z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14',stop:'M6 6h12v12H6Z',check:'m5 12 4 4L19 6',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',book:'M12 5v15M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Z',plus:'M12 5v14M5 12h14',close:'m6 6 12 12M6 18 18 6',settings:'M4 7h16M4 17h16M9 4v6M15 14v6',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z'};
const icon=name=>`<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name]||paths.spark}"/></svg>`;
let storage;try{storage=localStorage}catch{storage={getItem(){return null},setItem(){throw new Error('Storage unavailable')}}}
const library=new LessonStore(storage),unsaved=new Map();
let language=library.data.language||'en',chosen=!!library.data.languageChosen,draft=cleanSpec(library.data.draft),busy=false,genError='',genStarted=0,generatedChars=0,setupPromise=null,wasCancelled=false;
let screen='setup',lessonId=null,search='',editing=false,translations=library.data.showTranslations!==false,pinyin=library.data.showPinyin!==false;
let speechSettings={rate:.85,mode:'auto',...library.data.speech};
const langName=lang=>lang==='zh'?'Chinese':'English';
const allLessons=()=>[...unsaved.values(),...library.data.lessons.filter(l=>!unsaved.has(l.id))];
const current=()=>allLessons().find(l=>l.id===lessonId);
const title=l=>l.language==='zh'&&l.zhTitle?l.zhTitle:l.title;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),5500)}
function preferences(patch){try{library.preferences(patch)}catch{toast('Preferences could not be saved in this browser.')}}
function navigate(next,id){editing=false;stopSpeech();screen=next;lessonId=id||null;const hash='#/'+(next==='reader'?'read/'+encodeURIComponent(id):next);if(location.hash!==hash)history.pushState(null,'',hash);render();window.scrollTo({top:0,behavior:'instant'})}
function route(){const [part,id]=(location.hash||'').replace(/^#\/?/,'').split('/');if(part==='read'){try{return {screen:'reader',id:decodeURIComponent(id||'')}}catch{return {screen:'saved'}}}return {screen:part==='saved'||part==='library'?'saved':part==='language'?'language':part==='setup'?'setup':'create'}}
function shell(){return `<header class="topbar"><a class="brand" href="#/create" data-nav="create"><img src="/assets/leaf.svg" alt="">lingrove<span>.</span></a><nav aria-label="Main navigation"><button class="nav-button ${screen==='create'?'active':''}" data-nav="create">${icon('plus')}<span>New lesson</span></button><button class="nav-button ${screen==='saved'?'active':''}" data-nav="saved">${icon('book')}<span>Saved<span class="saved-count">${allLessons().length||''}</span></span></button></nav></header><main id="main" tabindex="-1"></main><footer><span>Made by you. Written on your device.</span><button class="text-button" data-action="settings">Settings</button></footer>`}
function render(){
  $('#app').innerHTML=shell();
  if(screen==='setup')renderSetup();else if(screen==='language')renderLanguage();else if(screen==='saved')renderSaved();else if(screen==='reader')renderReader();else renderCreate();
  document.title=(screen==='reader'&&current()?title(current()):screen==='saved'?'Saved lessons':'Your own language lesson')+' · Lingrove';
  updateAI();updateSpeech();
}
function renderSetup(){
  $('#main').innerHTML=`<section class="onboarding setup-card"><span class="step-label">STEP 1 OF 3 · YOUR LESSON WRITER</span><div class="setup-mark"><img src="/assets/leaf.svg" alt=""></div><h1>A little AI.<br><em>All yours.</em></h1><p class="lede">Getting Qwen ready to write your lessons.</p><div class="model-label">Qwen3.5 · Phone mode</div><div id="setup-progress" class="setup-progress" role="status" aria-live="polite"></div><p class="fine-print">About 550 MB on the first visit. Downloads automatically and stays in this browser when storage is available. Wi-Fi is best.</p><div id="setup-actions" class="button-row"></div><p class="quiet">No account or API key inside the app. Keep this page open.</p></section>`;
}
async function startSetup(){
  if(setupPromise)return setupPromise;wasCancelled=false;
  const loading=enableAI('phone');setupPromise=loading;
  try{const ready=await loading;if(ready&&screen==='setup')navigate(chosen?'create':'language');return ready}
  finally{if(setupPromise===loading)setupPromise=null;updateAI()}
}
function renderLanguage(){
  $('#main').innerHTML=`<section class="onboarding"><span class="step-label">STEP 2 OF 3 · YOUR LANGUAGE</span><h1>What would you<br><em>like to learn?</em></h1><p class="lede">Every lesson includes English and Chinese.<br>Choose the language you want to practise.</p><div class="language-options"><button class="language-card" data-language="en"><span class="language-symbol">Aa</span><span><strong>English</strong><small>学英语 · Chinese translations</small></span>${icon('arrow')}</button><button class="language-card" data-language="zh"><span class="language-symbol han">文</span><span><strong>Chinese</strong><small>学中文 · English translations & pinyin</small></span>${icon('arrow')}</button></div><p class="quiet">You can change this whenever you make a lesson.</p></section>`;
}
function renderCreate(){
  $('#main').innerHTML=`<section class="builder"><div class="builder-intro"><span class="step-label">YOUR LESSON, YOUR WAY</span><h1>What do you want<br><em>to learn today?</em></h1><p class="lede">One idea. A lesson made just for you.</p></div><form id="lesson-form" class="surface"><div class="form-top"><label class="compact-select">${icon('globe')}<select id="lesson-language" aria-label="Language you are learning" ${busy?'disabled':''}><option value="en" ${language==='en'?'selected':''}>Learning English</option><option value="zh" ${language==='zh'?'selected':''}>Learning Chinese</option></select></label><span class="private-label">On your device</span></div><label class="field-label" for="lesson-topic">Tell Qwen what your lesson should be about</label><textarea id="lesson-topic" rows="4" maxlength="400" placeholder="Describe a topic, a real-life situation, or something you want to say…" required ${busy?'disabled':''}>${esc(draft.topic)}</textarea><details class="customize" ${busy?'open':''}><summary>${icon('settings')}Customize your lesson <span id="spec-summary">${draft.level} · ${draft.length} lines · ${draft.format}</span></summary><div class="custom-grid"><label>Level<select id="lesson-level" ${busy?'disabled':''}>${[['A1','A1 · Beginner'],['A2','A2 · Elementary'],['B1','B1 · Intermediate'],['B2','B2 · Upper intermediate']].map(([v,label])=>`<option value="${v}" ${draft.level===v?'selected':''}>${label}</option>`).join('')}</select></label><label>Length<select id="lesson-length" ${busy?'disabled':''}>${[4,6,8].map(n=>`<option value="${n}" ${draft.length===n?'selected':''}>${n} lines${n===4?' · Quick lesson':''}</option>`).join('')}</select></label><label class="wide">Format<select id="lesson-format" ${busy?'disabled':''}>${[['story','Short story'],['dialogue','Conversation'],['phrases','Useful phrases']].map(([v,label])=>`<option value="${v}" ${draft.format===v?'selected':''}>${label}</option>`).join('')}</select></label><label class="wide">Words or grammar to practise <span class="optional">optional</span><input id="lesson-focus" maxlength="160" value="${esc(draft.focus)}" placeholder="Any vocabulary, sentence patterns, or grammar…" ${busy?'disabled':''}></label><label class="wide">Anything else? <span class="optional">optional</span><textarea id="lesson-instructions" rows="2" maxlength="300" placeholder="Who is it for? What should it include or avoid?" ${busy?'disabled':''}>${esc(draft.instructions)}</textarea></label></div></details><div class="ai-notice" id="ai-notice" aria-live="polite"></div><button class="button primary generate" id="generate-button" type="submit" ${busy?'disabled':''}>${icon('spark')}${busy?'Creating your lesson…':'Create my lesson'}</button><div id="generation-status" aria-live="polite"></div><p class="form-note">Saved automatically on this device. Small models can make mistakes; review the language before teaching.</p></form></section>`;
  $('#lesson-language').onchange=e=>{language=e.target.value;chosen=true;preferences({language,languageChosen:true})};
  for(const [id,key] of [['lesson-topic','topic'],['lesson-level','level'],['lesson-length','length'],['lesson-format','format'],['lesson-focus','focus'],['lesson-instructions','instructions']])$('#'+id).oninput=e=>{draft=cleanSpec({...draft,[key]:e.target.value});$('#spec-summary').textContent=`${draft.level} · ${draft.length} lines · ${draft.format}`;clearTimeout(renderCreate.persistTimer);renderCreate.persistTimer=setTimeout(()=>preferences({draft}),400)};
  $('#lesson-form').onsubmit=e=>{e.preventDefault();generateLesson()};updateGeneration();updateAI();
}
async function generateLesson(){
  if(busy||!draft.topic.trim())return;
  stopSpeech();const spec=cleanSpec(draft),target=language;genError='';busy=true;genStarted=Date.now();generatedChars=0;renderCreate();
  try{
    if(ai.status!=='ready'){const ready=await startSetup();if(!ready||wasCancelled)throw new Error(ai.error||'Download paused or unavailable. Your lesson prompt is kept; retry when you’re ready.')}
    const raw=await complete(lessonMessages(spec,target),{json:true,schema:lessonSchema(spec.length),temperature:.55,max_tokens:spec.length===8?1600:spec.length===6?1300:950,totalTimeoutMs:spec.length===8?420000:300000,onToken:text=>{generatedChars=text.length;updateGeneration()}});
    const lesson=parseLesson(raw,{spec,language:target});lesson.lines=lesson.lines.map(line=>[line[0],line[1],pinyinFor(line[1])]);
    try{library.save(lesson)}catch(error){unsaved.set(lesson.id,lesson);toast(error.message)}
    busy=false;navigate('reader',lesson.id);
  }catch(error){genError=normalizeAIError(error).message;busy=false;if(screen==='create')renderCreate();else toast(genError)}
  finally{busy=false;updateGeneration()}
}
function updateGeneration(){
  const el=$('#generation-status');if(!el)return;
  el.innerHTML=busy?`<div class="generation-progress"><span class="spinner"></span><div><strong>${ai.status==='ready'?'Writing your lesson':'Preparing your lesson writer'}</strong><span>${Math.floor((Date.now()-genStarted)/1000)}s${generatedChars?' · '+generatedChars+' characters written':' · Keep this page open'}</span></div><button type="button" class="text-button" data-action="stop-generation">Stop</button></div>`:genError?`<div class="error" role="alert">${esc(genError)}</div>`:'';
}
function renderSaved(){
  $('#main').innerHTML=`<section class="saved-page"><div class="page-heading"><div><span class="step-label">YOUR OWN LITTLE LIBRARY</span><h1>Saved <em>lessons.</em></h1><p class="lede">Only the lessons you make. Ready when you are.</p></div><button class="button primary" data-nav="create">${icon('plus')}New lesson</button></div><div class="saved-toolbar"><input id="saved-search" type="search" placeholder="Find a lesson…" aria-label="Search saved lessons" value="${esc(search)}"><details class="menu"><summary>Backups</summary><div><button data-action="export-all">Download all lessons</button><button data-action="import">Import a backup</button></div></details></div><div id="saved-list"></div><p class="form-note">Saved in this browser, with no account needed. Download a backup to keep a copy or move your lessons to another device.</p><input id="backup-file" type="file" accept=".json,application/json" hidden></section>`;
  $('#saved-search').oninput=e=>{search=e.target.value;paintSaved()};$('#backup-file').onchange=importFile;paintSaved();
}
function paintSaved(){
  const items=allLessons().filter(l=>[l.title,l.zhTitle,l.spec?.topic].join(' ').toLowerCase().includes(search.toLowerCase()));
  $('#saved-list').innerHTML=items.length?items.map(l=>`<a class="saved-lesson" href="#/read/${encodeURIComponent(l.id)}" data-open="${esc(l.id)}"><span class="lesson-initial">${l.language==='zh'?'文':'Aa'}</span><span class="saved-info"><strong>${esc(title(l))}</strong><small>${langName(l.language)} · ${esc(l.level)} · ${l.lines.length} lines${unsaved.has(l.id)?' · Not yet saved':''}</small></span>${icon('arrow')}</a>`).join(''):`<div class="empty"><span class="empty-icon">${icon('book')}</span><h2>${search?'No matching lessons':'Your first lesson starts with an idea.'}</h2><p>${search?'Try a different search.':'Create something you want to learn. It will be saved here automatically.'}</p>${!search?'<button class="button primary" data-nav="create">Create a lesson</button>':''}</div>`;
}
function speechButton(key,label,attrs='',small=false){return `<button class="${small?'listen-button':'button secondary'}" data-speech-key="${esc(key)}" ${attrs} aria-label="${esc(label)}">${icon('sound')}<span>${esc(label)}</span></button>`}
function renderReader(){
  const l=current();if(!l){$('#main').innerHTML=`<section class="empty"><h1>That lesson isn’t here.</h1><p>Saved lessons stay in the browser where you made them.</p><button class="button primary" data-nav="saved">Your saved lessons</button></section>`;return}
  if(editing){renderEdit(l);return}
  const primary=l.language==='zh'?1:0,other=1-primary;
  $('#main').innerHTML=`<article class="lesson-reader"><div class="reader-back"><button class="text-button" data-nav="saved">${icon('back')}Saved lessons</button><span class="save-status ${unsaved.has(l.id)?'warning':''}">${unsaved.has(l.id)?'Not saved yet':icon('check')+'Saved on this device'}</span></div><header class="lesson-heading"><span class="step-label">${langName(l.language)} · ${esc(l.level)} · ${l.lines.length} LINES</span><h1>${esc(title(l))}</h1>${l.language==='zh'?`<p class="subtitle">${esc(l.title)}</p>`:l.zhTitle?`<p class="subtitle" lang="zh-CN">${esc(l.zhTitle)}</p>`:''}</header><div class="reader-actions">${speechButton('all-en','Listen in English','data-read-all="en"')}${speechButton('all-zh','听中文','data-read-all="zh"')}<details class="menu"><summary aria-label="Lesson actions">More</summary><div><button data-action="edit">Edit lesson</button><button data-action="remix">Customise & create another</button><button data-action="export-text">Download text</button><button data-action="export-lesson">Download backup</button><button data-action="print">Print</button><button class="danger" data-action="delete">Delete lesson</button></div></details></div><div id="speech-status" class="speech-status" aria-live="polite"></div>${unsaved.has(l.id)?'<div class="error">This lesson is not saved. <button class="text-button" data-action="save-again">Try saving again</button> or download a backup from More.</div>':''}<div class="reader-options"><label><input type="checkbox" id="show-translations" ${translations?'checked':''}>Show translations</label><label><input type="checkbox" id="show-pinyin" ${pinyin?'checked':''}>Pinyin</label><button class="text-button" data-action="audio-settings">Voice & speed</button></div><div id="lesson-lines">${l.lines.map((line,i)=>`<section class="lesson-line" data-line="${i}"><span class="line-number">${String(i+1).padStart(2,'0')}</span><div class="line-body"><div class="language-line"><p lang="${primary?'zh-CN':'en'}">${esc(line[primary]||'Text not added yet.')}</p>${line[primary]?speechButton(`line-${i}-${primary}`,primary?'Listen in Chinese':'Listen in English',`data-read-line="${i}" data-field="${primary}"`,true):''}</div>${primary===1&&pinyin?`<p class="pinyin">${esc(line[2])}</p>`:''}<details class="translation" ${translations?'open':''}><summary>${other?'Chinese translation':'English translation'}</summary><div class="language-line"><p lang="${other?'zh-CN':'en'}">${esc(line[other]||'Add a translation with Edit lesson.')}</p>${line[other]?speechButton(`line-${i}-${other}`,other?'Listen in Chinese':'Listen in English',`data-read-line="${i}" data-field="${other}"`,true):''}</div>${other===1&&pinyin?`<p class="pinyin">${esc(line[2])}</p>`:''}</details></div></section>`).join('')}</div><div class="lesson-end"><p>Made for your curiosity.<br><span>AI can make mistakes. You can edit every line.</span></p><button class="button primary" data-nav="create">${icon('plus')}Make another lesson</button></div></article>`;
  $('#show-translations').onchange=e=>{translations=e.target.checked;preferences({showTranslations:translations});$$('.translation').forEach(d=>d.open=translations)};
  $('#show-pinyin').onchange=e=>{pinyin=e.target.checked;preferences({showPinyin:pinyin});renderReader();updateSpeech()};
}
function renderEdit(l){
  $('#main').innerHTML=`<section class="editor"><div class="page-heading"><div><span class="step-label">MAKE IT YOUR OWN</span><h1>Edit your <em>lesson.</em></h1></div></div><form id="edit-form" class="surface"><div class="custom-grid"><label>English title<input id="edit-title" maxlength="120" required value="${esc(l.title)}"></label><label>Chinese title<input id="edit-zh-title" maxlength="120" value="${esc(l.zhTitle)}"></label></div>${l.lines.map((line,i)=>`<fieldset><legend>Line ${i+1}</legend><label>English<textarea data-edit-en="${i}" maxlength="2000" rows="2">${esc(line[0])}</textarea></label><label>中文<textarea data-edit-zh="${i}" maxlength="2000" rows="2">${esc(line[1])}</textarea></label></fieldset>`).join('')}<div id="edit-error" role="alert"></div><div class="button-row"><button class="button primary" type="submit">${icon('check')}Save changes</button><button class="button secondary" type="button" data-action="cancel-edit">Cancel</button></div></form></section>`;
  $('#edit-form').onsubmit=e=>{e.preventDefault();const changed={...l,title:$('#edit-title').value.trim(),zhTitle:$('#edit-zh-title').value.trim(),updatedAt:Date.now(),lines:l.lines.map((_,i)=>{const en=$(`[data-edit-en="${i}"]`).value.trim(),zh=$(`[data-edit-zh="${i}"]`).value.trim();return [en,zh,zh?pinyinFor(zh):'']})};if(changed.lines.some(line=>!line[0]&&!line[1])){$('#edit-error').textContent='Each line needs text in at least one language.';return}try{library.save(changed);unsaved.delete(l.id);editing=false;render();toast('Changes saved.')}catch(error){$('#edit-error').textContent=error.message}};
}
function modal(title,body){const d=$('#modal');d.innerHTML=`<div class="modal-header"><h2>${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">${icon('close')}</button></div>${body}`;if(!d.open)d.showModal();d.scrollTop=0}
function audioSettings(){
  modal('Make yourself heard.',`<p>Hear the lesson and its translation separately.</p><label class="field-label">Voice<select id="voice-mode"><option value="auto" ${speechSettings.mode==='auto'?'selected':''}>Automatic · device voice when available</option><option value="basic" ${speechSettings.mode==='basic'?'selected':''}>Basic voice · works without installed voices</option></select></label><p class="form-note">The basic voice sounds robotic but works on your device. Its audio files download the first time you use it.</p><label class="field-label">Speed <output id="rate-label">${speechSettings.rate}×</output><input id="speech-rate" type="range" min="0.6" max="1.2" step="0.05" value="${speechSettings.rate}"></label><div class="button-row">${speechButton('test-en','Test English','data-test-voice="en"')}${speechButton('test-zh','测试中文','data-test-voice="zh"')}</div><div id="modal-speech-status" class="speech-status" aria-live="polite"></div><p class="form-note">If you still hear nothing, turn up your phone’s media volume and check Bluetooth headphones or silent mode.</p>`);
  $('#voice-mode').onchange=e=>{speechSettings.mode=e.target.value;stopSpeech();preferences({speech:speechSettings})};$('#speech-rate').oninput=e=>{speechSettings.rate=Number(e.target.value);$('#rate-label').textContent=speechSettings.rate+'×';preferences({speech:speechSettings})};updateSpeech();
}
function settings(){modal('Just the essentials.',`<div class="settings-list"><button class="button secondary" data-action="audio-settings">${icon('sound')}Voice & speed</button><button class="button secondary" data-action="open-setup">${icon('download')}Qwen download & status</button><button class="button secondary" data-action="choose-language">${icon('globe')}Choose learning language</button></div><p>Lessons are saved only in this browser. Download backups from Saved lessons.</p><p class="form-note">Qwen runs on your device; your prompts aren’t sent to an AI service. Model files come from Hugging Face. Download access in mainland China may vary. Device speech may use your phone’s speech provider; the basic voice runs here.</p><p class="form-note"><a href="/licenses/Qwen3.5-Apache-2.0.txt" target="_blank">Qwen licence</a> · <a href="/licenses/speech-notice.txt" target="_blank">Basic voice licence</a> · <a href="/vendor/speech/speech-source.tar.gz" download>Voice source code</a></p>`)}
function updateAI(){
  const progress=$('#setup-progress'),actions=$('#setup-actions');
  const browserHelp=ai.status==='error'&&ai.recovery==='browser';
  if(progress){
    const label=ai.phase==='verifying'?'Checking a first reply…':ai.phase==='storage'?'Checking storage…':ai.phase==='loading'?'Loading Qwen…':Math.round(ai.progress*100)+'%';
    progress.innerHTML=ai.status==='error'?`<div class="error" role="alert">${esc(ai.error)}</div>${browserHelp?`<p class="browser-help">${isAppleMobile()?'Use Share → Open in Safari. If it isn’t listed, copy the link and paste it into Safari.':'Copy the link and open it directly in your browser, outside this app’s preview.'}</p>`:''}`:ai.status==='ready'?`<p class="ready">${icon('check')}Qwen is ready.</p>`:ai.status==='loading'?`<progress max="1" value="${ai.progress}" aria-label="Qwen download progress"></progress><strong>${label}</strong><p>${esc(ai.text)}</p>`:'<p>Download paused. Your saved lessons are still available.</p>';
    actions.innerHTML=ai.status==='loading'?'<button class="button secondary" data-action="cancel-setup">Pause download</button>':browserHelp?'<button class="button primary" data-action="copy-app-link">Copy link to open in browser</button><button class="button secondary" data-action="retry-setup">Retry here</button>':`<button class="button primary" data-action="${ai.status==='ready'?'setup-next':'retry-setup'}">${ai.status==='ready'?'Continue':ai.status==='error'?'Retry download':'Resume download'}${icon('arrow')}</button>`;
    if(ai.status!=='loading'||allLessons().length)actions.insertAdjacentHTML('beforeend','<button class="text-button" data-nav="saved">Open saved lessons</button>');
  }
  const notice=$('#ai-notice');if(notice)notice.innerHTML=ai.status==='ready'?`<span class="ready-dot"></span>Qwen is ready`:(ai.status==='loading'?`<span class="spinner small"></span>${esc(ai.phase==='verifying'?'Checking Qwen…':ai.text)}`:ai.status==='error'?'<button type="button" class="text-button" data-action="open-setup">Qwen setup needs attention — view help</button>':`${icon('download')} Qwen will load when you create your lesson.`);
  updateGeneration();
}
async function copyAppLink(){
  const url=new URL('/',location.href).href;
  try{await navigator.clipboard.writeText(url);toast(isAppleMobile()?'Link copied. Paste it into Safari.':'Link copied. Paste it into your browser.')}
  catch{modal('Open in your browser.',`<p>Copy this link and paste it into ${isAppleMobile()?'Safari':'your browser'}.</p><input id="browser-link" aria-label="App link" readonly value="${esc(url)}">`);$('#browser-link').focus();$('#browser-link').select();$('#browser-link').setSelectionRange(0,url.length)}
}

function read(items,key){if(speech.key===key&&speech.status!=='idle'&&speech.status!=='error'){stopSpeech();return}playSpeech(items,{...speechSettings,key})}
function updateSpeech(){
  for(const el of $$('#speech-status,#modal-speech-status')){el.textContent=speech.message||'';el.classList.toggle('error',speech.status==='error')}
  for(const button of $$('[data-speech-key]')){const active=speech.key===button.dataset.speechKey&&['loading','speaking'].includes(speech.status);button.classList.toggle('playing',active);button.setAttribute('aria-pressed',String(active));const label=button.getAttribute('aria-label');button.innerHTML=icon(active?'stop':'sound')+`<span>${active?(speech.status==='loading'?'Preparing…':'Stop'):esc(label)}</span>`}
}
function download(name,text,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function importFile(e){const file=e.target.files?.[0];if(!file)return;try{if(file.size>4000000)throw new Error('This backup is too large. Choose a file under 4 MB.');const count=library.importBackup(await file.text());toast(`${count} lesson${count===1?'':'s'} added.`);renderSaved()}catch(error){toast(error.message)}}

document.addEventListener('click',e=>{
  const el=e.target.closest('button,a');if(!el)return;
  if(el.classList.contains('skip-link')){e.preventDefault();$('#main').focus();return}
  if(el.dataset.nav){e.preventDefault();navigate(el.dataset.nav==='create'&&!chosen?'language':el.dataset.nav);return}
  if(el.dataset.open){e.preventDefault();navigate('reader',el.dataset.open);return}
  if(el.dataset.language){language=el.dataset.language;chosen=true;preferences({language,languageChosen:true});navigate('create');$('#lesson-topic')?.focus({preventScroll:true});return}
  if(el.dataset.readAll){const l=current(),lang=el.dataset.readAll;if(l)read(l.lines.map(line=>({text:line[lang==='zh'?1:0],lang})),el.dataset.speechKey);return}
  if(el.hasAttribute('data-read-line')){const l=current(),field=Number(el.dataset.field),line=l?.lines[Number(el.dataset.readLine)];if(line)read([{text:line[field],lang:field?'zh':'en'}],el.dataset.speechKey);return}
  if(el.dataset.testVoice){const lang=el.dataset.testVoice;read([{text:lang==='zh'?'你好！我们一起学习中文。':'Hello! Let’s learn something new.',lang}],el.dataset.speechKey);return}
  const l=current();switch(el.dataset.action){
    case 'settings':settings();break;
    case 'copy-app-link':copyAppLink();break;
    case 'audio-settings':audioSettings();break;
    case 'close-modal':$('#modal').close();break;
    case 'open-setup':$('#modal').close();navigate('setup');break;
    case 'choose-language':$('#modal').close();navigate('language');break;
    case 'retry-setup':startSetup();break;
    case 'setup-next':navigate(chosen?'create':'language');break;
    case 'cancel-setup':wasCancelled=true;cancelAI();break;
    case 'stop-generation':if(ai.status==='loading'){wasCancelled=true;cancelAI()}else stopGeneration();break;
    case 'edit':stopSpeech();editing=true;render();break;
    case 'cancel-edit':editing=false;render();break;
    case 'remix':if(l){draft=cleanSpec(l.spec);language=l.language;chosen=true;preferences({draft,language,languageChosen:true});navigate('create')}break;
    case 'save-again':if(l)try{library.save(l);unsaved.delete(l.id);renderReader();toast('Lesson saved.')}catch(error){toast(error.message)}break;
    case 'export-text':if(l)download('lingrove-lesson.txt',lessonText(l));break;
    case 'export-lesson':if(l)download('lingrove-lesson.json',backup([l]),'application/json');break;
    case 'export-all':download('lingrove-lessons.json',backup(allLessons()),'application/json');break;
    case 'import':$('#backup-file').click();break;
    case 'print':window.print();break;
    case 'delete':if(l&&confirm(`Delete “${title(l)}” from this browser?`)){try{library.remove(l.id);unsaved.delete(l.id);navigate('saved');toast('Lesson deleted.')}catch(error){toast(error.message)}}break;
  }
});
subscribeAI(updateAI);subscribeSpeech(updateSpeech);setInterval(()=>{if(busy)updateGeneration()},1000);
window.addEventListener('popstate',()=>{const next=route();editing=false;stopSpeech();screen=next.screen;lessonId=next.id;render()});
window.addEventListener('pagehide',()=>stopSpeech());
const initial=route();
if(initial.screen==='reader'||initial.screen==='saved'){screen=initial.screen;lessonId=initial.id}else screen='setup';
render();if(library.readError)toast(library.readError);
// The owner requested automatic first-visit downloading. Cached model files are reused.
startSetup();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{});
