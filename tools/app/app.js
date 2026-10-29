/* =========================================================================
   PULSE · MBBS — line-by-time mastery
   9 subjects · 454 chapters · 3,665 units · 40,117 questions, all offline
   ========================================================================= */
const BANK = JSON.parse(document.getElementById('bankData').textContent);

const SUBJECTS = [
  {id:'medv1', name:'Volume 1',      sp:'Medicine',      em:'📘', icoBg:'#E9F2FA', icoBgD:'#1B2733', acc:'#2C6E9E'},
  {id:'medv2', name:'Volume 2',      sp:'Medicine',      em:'📕', icoBg:'#F1ECF7', icoBgD:'#2A2434', acc:'#8E1F30', legacy:{key:'pulseMed_done', pre:'MED-', shared:true}},
  {id:'medv3', name:'Volume 3',      sp:'Medicine',      em:'📙', icoBg:'#FBF0DC', icoBgD:'#33291A', acc:'#A5681A', legacy:{key:'pulseMed_done', pre:'MED-', skip:true}},
  {id:'peds',  name:'Pediatrics',    sp:'Paediatrics',   em:'🧒', icoBg:'#E9F5F1', icoBgD:'#1E2C28', acc:'#2C7A6B', legacy:{key:'pulse_peds_done', pre:'PEDS-'}},
  {id:'obg',   name:'Obs',           sp:'OBG',           em:'🤰', icoBg:'#F3EDF9', icoBgD:'#2A2438', acc:'#6C4E8E', legacy:{key:'pulse_done', pre:'OBG-'}},
  {id:'gyne',  name:'Gyne',          sp:'Gynaecology',   em:'🌸', icoBg:'#FCEEF2', icoBgD:'#331F27', acc:'#B84E6C'},
  {id:'pharm', name:'Pharm',         sp:'Pharmacology',  em:'💊', icoBg:'#EAF5EC', icoBgD:'#1F2A21', acc:'#2E7D4F', legacy:{key:'pulse_done', pre:'PHARM-'}},
  {id:'surg',  name:'Surgery',       sp:'Surgery',       em:'🔪', icoBg:'#FBEFE8', icoBgD:'#33251C', acc:'#B4602C', legacy:{key:'pulse_surgery_done', pre:'SURG-'}},
  {id:'derma', name:'Derma',         sp:'Dermatology',   em:'🧴', icoBg:'#FBECF1', icoBgD:'#33222A', acc:'#A63E63', legacy:{stratum:true}},
  {id:'ortho', name:'Ortho',         sp:'Orthopaedics',  em:'🦴', icoBg:'#EAF1F8', icoBgD:'#1E2833', acc:'#2C5F86', legacy:{key:'pulse_done', pre:'ORTHO-'}},
  {id:'oph',   name:'Ophthalmology', sp:'Ophthalmology', em:'👁️', icoBg:'#E9F3F8', icoBgD:'#1C2933', acc:'#26697F', legacy:{key:'pulseOph_done', pre:'OPH-'}},
  {id:'aneesh',name:'Aneesh',        sp:'Aneesh Notes',  em:'📝', icoBg:'#F4F1E6', icoBgD:'#2C2A1F', acc:'#8A7A2C'}
];
SUBJECTS.forEach(s => { s.d = BANK[s.id]; });
for(let i=SUBJECTS.length-1;i>=0;i--) if(!SUBJECTS[i].d) SUBJECTS.splice(i,1);
const subjectById = id => SUBJECTS.find(s=>s.id===id);
function viewSubjectId(v){
  if (v.s && subjectById(v.s)) return v.s;
  if ((v.v==='quiz'||v.v==='results') && run && run.s) return run.s;
  return null;
}

/* ---------------- state ---------------- */
const SKEY = 'pulse_mbbs_state_v2';
const ACCENTS = {
  maroon: {name:'Maroon', accent:'#8E1F30', ecg:'#B3283C', a1:'#CE9438', a2:'#A5681A', ball:'#AB7539', ball2:'#8C5B26'},
  blue:   {name:'Ocean',  accent:'#1B4E7A', ecg:'#2C79B8', a1:'#2F7FBF', a2:'#1E5A8C', ball:'#3A78AE', ball2:'#255E8C'},
  emerald:{name:'Emerald',accent:'#1E6B4A', ecg:'#2E9468', a1:'#35A06E', a2:'#1F7350', ball:'#2F8A61', ball2:'#1E6344'},
  orange: {name:'Sunset', accent:'#A94E1B', ecg:'#E0752C', a1:'#E08A33', a2:'#B4611B', ball:'#C4762C', ball2:'#9C5518'},
  violet: {name:'Violet', accent:'#5A3C8E', ecg:'#7B58B8', a1:'#8158C0', a2:'#5B3A8C', ball:'#7454A8', ball2:'#54387E'},
  teal:   {name:'Teal',   accent:'#126E6E', ecg:'#1E8C8C', a1:'#22999A', a2:'#156E70', ball:'#1F8A8A', ball2:'#146466'},
  rose:   {name:'Rose',   accent:'#A63E63', ecg:'#CE5380', a1:'#D05C86', a2:'#9E3F62', ball:'#C0507A', ball2:'#94385C'},
  slate:  {name:'Slate',  accent:'#3A4148', ecg:'#5A646C', a1:'#5A646C', a2:'#3C4349', ball:'#545C64', ball2:'#3B4248'}
};
const DEFAULT = {xp:0, streak:0, lastDay:null, done:{}, wrong:{}, flags:{}, srs:{}, last:null, unlockAll:false,
  prefs:{theme:'light', accent:'maroon', fs:2, haptics:true, goal:50}, log:{}, subStats:{}, tests:[], mock:null,
  notes:{}, edits:{}, unitStats:{}, time:{}, pace:{n:0, ms:0}};
/* Personal corrections: original bank and question keys are never mutated. */
let editDraft = null;
function validQuestionEdit(q){
  if (!Array.isArray(q) || typeof q[0]!=='string' || !q[0].trim() || typeof q[3]!=='string') return false;
  /* fill and matching questions carry their key in slot 7, not in q[1]/q[2] */
  if (typeof richKind==='function' && richKind(q)) return true;
  return Array.isArray(q[1]) && q[1].length>=2 && q[1].length<=26
    && q[1].every(x=>typeof x==='string' && x.trim().length>0)
    && Number.isInteger(q[2]) && q[2]>=0 && q[2]<q[1].length;
}
function cleanEdits(edits){
  if(!edits || typeof edits!=='object' || Array.isArray(edits)) return {};
  const out={};
  Object.keys(edits).forEach(k=>{
    const p=k.split('#'), s=subjectById(p[0]);
    if(s && /^\d+$/.test(p[1]||'') && s.d.q[+p[1]] && validQuestionEdit(edits[k])) out[k]=edits[k];
  });
  return out;
}
function effectiveQ(sid,qi){ return (S.edits||{})[qKey(sid,qi)] || subjectById(sid).d.q[qi]; }
function editButton(it){
  const key=qKey(it.s,it.q);
  return '<div class="question-tools"><span>'+((S.edits||{})[key]?'Personal edit':'')+'</span>'
    + '<button class="edit-question" data-edit-question="'+key+'" aria-label="Edit question">✎ Edit question</button></div>';
}
function openQuestionEditor(key){
  const p=key.split('#'), s=subjectById(p[0]); if(!s || !s.d.q[+p[1]]) return;
  const q=effectiveQ(p[0],+p[1]);
  editDraft={key:key,sid:p[0],qi:+p[1],q:JSON.parse(JSON.stringify(q)),dirty:false};
  document.body.style.overflow='hidden';
  drawQuestionEditor();
}
function closeQuestionEditor(force){
  if(!force && editDraft && editDraft.dirty && !confirm('Discard your unsaved question changes?')) return;
  editDraft=null; document.getElementById('questionEditor')?.remove(); document.body.style.overflow='';
}
function optionsEditorBlock(q){
  if (typeof richKind!=='function') return '';
  if (isFillQ(q)){
    const m=qMeta(q)||{};
    return '<h3>Answer</h3><p class="editor-help">This is a fill-in-the-blank question. The accepted answer comes from the book source.</p>'
      + '<div class="editor-note"><b>'+esc(m.blank||'')+'</b>'
      + ((m.aliases&&m.aliases.length)?'<span class="editor-alias">Also accepted: '+esc(m.aliases.join(', '))+'</span>':'')+'</div>';
  }
  if (isMatchQ(q)){
    const m=qMeta(q)||{}, key=matchKey(q);
    return '<h3>Matching pairs</h3><p class="editor-help">This is a matching question. The pairs and their key come from the book source.</p>'
      + '<div class="editor-note">'+(m.left||[]).map((L,i)=>'<div><b>'+esc(L)+'</b> \u2192 '+esc((m.right||[])[key[i]]||'')+'</div>').join('')+'</div>';
  }
  return '<h3>Options & correct answer</h3><p class="editor-help">Select the circle next to the correct option.</p>'
    + q[1].map((o,i)=>'<div class="editor-option"><label><input type="radio" name="editCorrect" value="'+i+'" '+(q[2]===i?'checked':'')+' aria-label="Correct answer '+String.fromCharCode(65+i)+'">'+String.fromCharCode(65+i)+'</label><textarea data-edit-option="'+i+'" rows="2" maxlength="10000" aria-label="Option '+String.fromCharCode(65+i)+'">'+esc(o)+'</textarea><button type="button" data-edit-remove="'+i+'" '+(q[1].length<=2?'disabled':'')+' aria-label="Remove option '+String.fromCharCode(65+i)+'">\u00d7</button></div>').join('')
    + '<button type="button" class="btn sm" data-edit-add '+(q[1].length>=26?'disabled':'')+'>+ Add option</button>';
}
function drawQuestionEditor(){
  const d=editDraft;if(!d)return;
  let el=document.getElementById('questionEditor');
  if(!el){
    el=document.createElement('div');el.id='questionEditor';el.className='question-editor';
    el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','editorTitle');
    document.body.appendChild(el);
    el.addEventListener('click',e=>{
      e.stopPropagation();const t=e.target;
      if(t.closest('[data-edit-close]')){closeQuestionEditor(false);return;}
      if(t.closest('[data-edit-save]')){saveQuestionEdit();return;}
      if(t.closest('[data-edit-original]')){
        if(confirm('Remove your personal correction and restore the bundled original?')){
          const old=S.edits[d.key];delete S.edits[d.key];
          try{localStorage.setItem(SKEY,JSON.stringify(S));}catch(err){if(old)S.edits[d.key]=old;alert('Storage is full. Export a backup before making more changes.');return;}
          closeQuestionEditor(true);render();toast('Original restored. Past scores are unchanged.');
        }return;
      }
      if(t.closest('[data-edit-add]')){if(d.q[1].length<26){d.q[1].push('');d.dirty=true;drawQuestionEditor();}return;}
      const rm=t.closest('[data-edit-remove]');if(rm && d.q[1].length>2){
        const i=+rm.dataset.editRemove;d.q[1].splice(i,1);
        if(d.q[2]===i)d.q[2]=-1;else if(d.q[2]>i)d.q[2]--;
        d.dirty=true;drawQuestionEditor();return;
      }
    });
    el.addEventListener('input',e=>{
      if(!editDraft)return;const t=e.target;
      if(t.id==='editStem')d.q[0]=t.value;
      if(t.id==='editExplanation')d.q[3]=t.value;
      if(t.hasAttribute('data-edit-option'))d.q[1][+t.dataset.editOption]=t.value;
      if(t.name==='editCorrect')d.q[2]=+t.value;
      d.dirty=true;
    });
  }
  el.innerHTML='<div class="editor-panel"><div class="editor-heading"><div><h2 id="editorTitle">Edit question</h2><p>'+esc(subjectById(d.sid).name)+' · Question '+(d.qi+1)+'</p></div><button type="button" data-edit-close aria-label="Close editor">×</button></div>'
    + '<div class="editor-scroll"><p class="editor-help">Add the missing case or matching lists below. Changes stay on this device and are included in progress backups. Past scores are not recalculated; an already answered question uses the correction on its next attempt.</p>'
    + '<label for="editStem">Question / full case</label><textarea id="editStem" rows="7" maxlength="30000">'+esc(d.q[0])+'</textarea>'
    + optionsEditorBlock(d.q)
    + '<label for="editExplanation">Explanation</label><textarea id="editExplanation" rows="5" maxlength="30000">'+esc(d.q[3]||'')+'</textarea>'
    + '<p id="editError" role="alert"></p>'
    + ((S.edits||{})[d.key]?'<button type="button" class="btn ghost full" data-edit-original>Restore original question</button>':'')
    + '</div><div class="editor-actions"><button type="button" class="btn ghost" data-edit-close>Cancel</button><button type="button" class="btn accent" data-edit-save>Save changes</button></div></div>';
}
function saveQuestionEdit(){
  const d=editDraft;if(!d)return;
  const q=d.q;q[0]=q[0].trim();
  if(!(typeof richKind==='function' && richKind(q))) q[1]=q[1].map(s=>s.trim());
  q[3]=(q[3]||'').trim();
  if(!validQuestionEdit(q)){document.getElementById('editError').textContent=((typeof richKind==='function' && richKind(q))
      ? 'Enter the question text. The answer key for this question type comes from the book source.'
      : 'Enter a question, at least two non-empty options, and select the correct answer.');return;}
  S.edits=S.edits||{};const old=S.edits[d.key];S.edits[d.key]=q;
  try{localStorage.setItem(SKEY,JSON.stringify(S));}catch(e){
    if(old)S.edits[d.key]=old;else delete S.edits[d.key];
    document.getElementById('editError').textContent='Could not save: device storage is full. Export a backup and free space first.';return;
  }
  closeQuestionEditor(true);render();toast('Question correction saved');
}

let S = load();
function load(){
  try{ const raw = localStorage.getItem(SKEY);
    if(raw){ const o = JSON.parse(raw);
      return Object.assign({}, DEFAULT, o, {done:o.done||{}, wrong:o.wrong||{}, flags:o.flags||{}, srs:o.srs||{},
        log:o.log||{}, subStats:o.subStats||{}, tests:o.tests||[], notes:o.notes||{}, edits:cleanEdits(o.edits), unitStats:o.unitStats||{},
        time:o.time||{}, pace:o.pace||{n:0,ms:0},
        prefs:Object.assign({}, DEFAULT.prefs, o.prefs||{})}); }
  }catch(e){}
  return JSON.parse(JSON.stringify(DEFAULT));
}
function save(){ try{ localStorage.setItem(SKEY, JSON.stringify(S)); }catch(e){} }

/* ---------------- appearance prefs ---------------- */
const hex2rgb = hex => { const n = parseInt(hex.slice(1),16);
  return [(n>>16)&255,(n>>8)&255,n&255].join(','); };
function resolveTheme(){ return prefs().theme==='auto'
  ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : prefs().theme; }
function prefs(){ return S.prefs || DEFAULT.prefs; }
function applyPrefs(){
  const p = prefs(), A = ACCENTS[p.accent] || ACCENTS.maroon, r = document.documentElement;
  r.dataset.theme = resolveTheme(); r.dataset.fs = String(p.fs||2);
  r.dataset.accent = p.accent;
  r.style.setProperty('--accent', A.accent); r.style.setProperty('--ecg', A.ecg);
  r.style.setProperty('--wordmark', resolveTheme()==='dark' ? A.ecg : A.accent);
  r.style.setProperty('--a1', A.a1); r.style.setProperty('--a2', A.a2);
  r.style.setProperty('--ball', A.ball); r.style.setProperty('--ball2', A.ball2);
  const rgb = hex2rgb(A.accent);
  r.style.setProperty('--accA1','rgba('+rgb+',.09)');
  r.style.setProperty('--accA2','rgba('+rgb+',.18)');
  r.style.setProperty('--accA3','rgba('+rgb+',.48)');
  r.style.setProperty('--accA4','rgba('+rgb+',.85)');
  const mt = document.getElementById('metaTheme');
  if (mt) mt.setAttribute('content', resolveTheme()==='dark' ? '#14110F' : '#F6F4F0');
  if (window.PulseAndroid && window.PulseAndroid.setTheme)
    window.PulseAndroid.setTheme(resolveTheme());
}
function setPref(k, v){ prefs()[k] = v; save(); applyPrefs(); render(); }
const icobg = s => (resolveTheme()==='dark' && s.icoBgD) ? s.icoBgD : s.icoBg;
const isDark = () => resolveTheme()==='dark';
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{
  if (prefs().theme==='auto'){ applyPrefs(); render(); } });

/* ---------------- activity tracking ---------------- */
const dayKey = (d) => { const x = d ? new Date(d) : new Date();
  return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };
function todayStats(){ const k = dayKey(); return (S.log && S.log[k]) || {a:0,c:0}; }
function logAnswer(sid, ok, unitKey){
  const k = dayKey();
  S.log = S.log || {}; S.log[k] = S.log[k] || {a:0,c:0};
  S.log[k].a++; if (ok) S.log[k].c++;
  S.subStats = S.subStats || {}; S.subStats[sid] = S.subStats[sid] || {a:0,c:0};
  S.subStats[sid].a++; if (ok) S.subStats[sid].c++;
  if (unitKey){
    S.unitStats = S.unitStats || {}; S.unitStats[unitKey] = S.unitStats[unitKey] || {a:0,c:0};
    S.unitStats[unitKey].a++; if (ok) S.unitStats[unitKey].c++;
  }
}
/* ---- study time (focus sessions) ---- */
function bankFocus(secs){ if(!secs) return; const k = dayKey(); S.time = S.time||{}; S.time[k] = (S.time[k]||0) + Math.round(secs); save(); }
function focusToday(){ return Math.round(((S.time||{})[dayKey()]||0)/60); }
function focusTotal(){ return Math.round(Object.keys(S.time||{}).reduce((a,k)=>a+S.time[k],0)/60); }
/* ---- pace ---- */
function paceLabel(){
  const p = S.pace || {n:0,ms:0};
  if (!p.n || !p.ms) return null;
  const s = p.ms/p.n/1000;
  return (s<10 ? s.toFixed(1) : Math.round(s)) + 's per question';
}
/* ---- weakest units ---- */
function resolveUnitKey(k){
  const p = String(k).split('|'), s = subjectById(p[0]); if(!s) return null;
  const i = s.d.u.findIndex(u=>String(u[0])===String(p[1]) && String(u[1])===String(p[2]));
  return i>=0 ? {s:s, i:i, u:s.d.u[i]} : null;
}
function weakUnits(limit){
  return Object.keys(S.unitStats||{}).map(k=>{
    const st = S.unitStats[k]; if(!st || st.a < 6) return null;
    const r = resolveUnitKey(k); if(!r) return null;
    return {k:k, s:r.s, i:r.i, u:r.u, a:st.a, c:st.c, pct:100*st.c/st.a};
  }).filter(Boolean).sort((x,y)=>x.pct-y.pct || y.a-x.a).slice(0, limit||5);
}
/* ---- notes ---- */
function noteKeys(){
  return Object.keys(S.notes||{}).filter(k=>String(S.notes[k]||'').trim());
}
function noteLabel(k){
  const p = String(k).split('#'), s = subjectById(p[0]); if(!s) return {s:null,u:null,key:k};
  const i = findUnitByAbs(s, +p[1]);
  return {s:s, u:(i>=0?s.d.u[i]:null), key:k};
}
function haptic(pattern){ try{ if (prefs().haptics){ if (window.PulseAndroid && window.PulseAndroid.vibrate) window.PulseAndroid.vibrate(); else if (navigator.vibrate) navigator.vibrate(pattern); } }catch(e){} }

/* ---------------- spaced revision (SRS) ---------------- */
/* box -> interval in minutes */
const IV = [10, 1440, 4320, 10080, 23040, 50400, 108000, 230400];
const IVLABEL = ['10 min','1 day','3 days','7 days','16 days','35 days','75 days','160 days'];
function srsOf(key){ return S.srs[key] || null; }
function srsDue(key){ const r = srsOf(key); return r ? r[1] : 0; }
function srsRate(key, grade){
  let box = srsOf(key) ? srsOf(key)[0] : 0;
  if (grade==='again') box = 0;
  else if (grade==='hard') box = Math.max(0, box-1);
  else if (grade==='good') box = box + 1;
  else if (grade==='easy') box = box + 2;
  box = Math.max(0, Math.min(IV.length-1, box));
  S.srs[key] = [box, Date.now() + IV[box]*60000];
  return box;
}
function srsNextLabel(key, grade){
  let box = srsOf(key) ? srsOf(key)[0] : 0;
  if (grade==='again') box = 0; else if (grade==='hard') box = Math.max(0, box-1);
  else if (grade==='good') box = box + 1; else if (grade==='easy') box = box + 2;
  box = Math.max(0, Math.min(IV.length-1, box));
  return IVLABEL[box];
}
function dueKeys(limit){
  const now = Date.now(), out = [];
  Object.keys(S.srs).forEach(k=>{ if(S.srs[k][1] <= now) out.push(k); });
  out.sort((a,b)=>S.srs[a][1]-S.srs[b][1]);
  return limit ? out.slice(0,limit) : out;
}
function upcomingCount(){
  const dayEnd = new Date(); dayEnd.setHours(23,59,59,999);
  return Object.keys(S.srs).filter(k=>S.srs[k][1] > Date.now() && S.srs[k][1] <= dayEnd.getTime()).length;
}
function masteredPct(){
  const t = totUnits(); return t ? 100*Object.keys(S.done).length/t : 0;
}

/* ---------------- helpers ---------------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rich = s => esc(s).replace(/&lt;(\/?)(b|i|em|strong|br|ul|li|sub|sup)&gt;/g, '<$1$2>');
const num = n => Number(n).toLocaleString('en-IN');
const uArr = (s,u) => s.id+'|'+u[0]+'|'+u[1];
const qKey = (sid, qi) => sid+'#'+qi;
const mark = (text, q) => {
  const t = String(text||'');
  if(!q) return rich(t);
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if(i<0) return rich(t);
  return esc(t.slice(0,i))+'<mark>'+esc(t.slice(i,i+q.length))+'</mark>'+esc(t.slice(i+q.length));
};
function ring(pct, acc, size, label){
  size = size||40; const r = size/2-4, c = 2*Math.PI*r, off = c*(1-Math.min(pct,100)/100);
  const lbl = label!=null ? label : (pct>=1 ? Math.round(pct)+'%' : '');
  return '<span class="progring'+(size>=100?' bigring':'')+'" style="width:'+size+'px;height:'+size+'px">'
    +'<svg width="'+size+'" height="'+size+'"><circle class="trk" cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke-width="3.4"/>'
    +'<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+acc+'" stroke-width="3.4" stroke-linecap="round"'
    +' stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/></svg><span>'+lbl+'</span></span>';
}
function toast(msg){
  const t = document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .3s'; t.style.opacity='0'; setTimeout(()=>t.remove(),320); }, 2100);
}
function fmtLabel(f){
  const m = {recall:'Recall', scenario:'Scenario', numeric:'Numeric', truefalse:'True / False',
    tf:'True / False', oddoneout:'Odd one out', odd:'Odd one out', fillup:'Fill up', fill:'Fill up',
    match:'Match', management:'Management', case:'Case', mcq:'MCQ'};
  return m[String(f||'').toLowerCase()] || (f ? String(f).replace(/^\w/,c=>c.toUpperCase()) : 'MCQ');
}
/* ---------- rich question kinds: fill-in-the-blank and matching ----------
   Some sources do not store every question as multiple choice. A fill question
   carries a `blank` (plus optional `aliases`); a match question carries
   left/right pair lists and a key. The flat bank tuple keeps that payload in an
   optional slot 7, so slots 0-6 mean exactly what they always did. */
function qMeta(q){ const x = Array.isArray(q) ? q[7] : null; return (x && typeof x==='object') ? x : null; }
function richKind(q){
  const m = qMeta(q);
  if (m && m.t==='fill' && typeof m.blank==='string' && m.blank.trim()) return 'fill';
  if (m && m.t==='match' && Array.isArray(m.left) && Array.isArray(m.right)
      && m.left.length===m.right.length && m.left.length>=2) return 'match';
  return '';
}
function isFillQ(q){ return richKind(q)==='fill'; }
function isMatchQ(q){ return richKind(q)==='match'; }
function isRichQ(q){ return !!richKind(q); }
function matchKey(q){
  const m = qMeta(q) || {};
  if (Array.isArray(m.key) && Array.isArray(m.left) && m.key.length===m.left.length) return m.key;
  return Array.isArray(q[2]) ? q[2] : [];
}
function normFill(s){
  return String(s==null?'':s).toLowerCase()
    .replace(/,/g,'')
    .replace(/[\u2013\u2014\u2212]/g,'-')
    .replace(/[\u03bc\u00b5]/g,'u')
    .replace(/\u03b1/g,'a').replace(/\u03b2/g,'b').replace(/\u03b3/g,'g')
    .replace(/[^a-z0-9+\-/%. ]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function stripUnits(s){
  return String(s)
    .replace(/\b(mg\/l|mg\/dl|mg\/kg|mg|mcg|ug|iu|hours?|hrs?|days?|weeks?|wks?|years?|yrs?|months?|min|minutes?|seconds?|sec|od|bd|tds|qid|percent|meq\/l|mmol\/l|ng\/ml)\b/g,'')
    .replace(/%/g,'').replace(/\s+/g,' ').trim();
}
function fillMatches(q, input){
  const m = qMeta(q) || {};
  const cands = [m.blank].concat(m.aliases||[]).filter(x=>typeof x==='string' && x.trim()).map(normFill);
  const n = normFill(input);
  if (!n || !cands.length) return false;
  if (cands.indexOf(n)>=0) return true;
  /* a typed answer often ends in a full stop; that alone must not fail it */
  const nEnd = n.replace(/[.;:,]+$/,'').trim();
  if (nEnd && cands.indexOf(nEnd)>=0) return true;
  const ns = stripUnits(n);
  if (ns && cands.some(c=>stripUnits(c)===ns)) return true;
  return cands.some(c=>c.replace(/ /g,'')===n.replace(/ /g,''));
}
function matchFilled(q, chosen){
  const k = matchKey(q);
  return Array.isArray(chosen) && k.length>0 && k.every((v,i)=>chosen[i]!=null);
}
function matchCorrect(q, chosen){
  const k = matchKey(q);
  return matchFilled(q, chosen) && k.every((v,i)=>chosen[i]===v);
}
/* The canonical correct answer on one line, for results and flashcards. */
function correctAnswerText(q){
  const m = qMeta(q);
  if (isFillQ(q)) return m.blank;
  if (isMatchQ(q)){
    const k = matchKey(q);
    return m.left.map((L,i)=>L+' \u2192 '+(m.right[k[i]]!=null?m.right[k[i]]:'')).join('; ');
  }
  return (Array.isArray(q[1]) && Number.isInteger(q[2]) && q[1][q[2]]!=null) ? String(q[1][q[2]]) : '';
}
/* What the learner chose. `chosen` is an option index for MCQ, a string for
   fill, and an array of right-hand indexes for match. */
function chosenAnswerText(q, chosen){
  const m = qMeta(q);
  if (isFillQ(q)) return typeof chosen==='string' ? chosen : '';
  if (isMatchQ(q)){
    if (!Array.isArray(chosen)) return '';
    return m.left.map((L,i)=>L+' \u2192 '+(m.right[chosen[i]]!=null?m.right[chosen[i]]:'\u2014')).join('; ');
  }
  return (Array.isArray(q[1]) && Number.isInteger(chosen) && chosen>=0 && q[1][chosen]!=null) ? String(q[1][chosen]) : '';
}
function totUnits(){ return SUBJECTS.reduce((a,s)=>a+s.d.u.length,0); }
function totQs(){ return SUBJECTS.reduce((a,s)=>a+s.d.q.length,0); }
function subjDone(s){ let d=0; s.d.u.forEach(u=>{ if(S.done[uArr(s,u)]) d++; }); return d; }
function unitQuestions(s,u){ return s.d.q.slice(u[5], u[5]+u[6]); }
function hasFlags(s,u){ const pre = uArr(s,u)+'#'; return Object.keys(S.flags).some(k=>k.indexOf(pre)===0); }
function findUnitByAbs(s, idx){
  let lo=0, hi=s.d.u.length-1;
  while(lo<=hi){ const mid=(lo+hi)>>1, u=s.d.u[mid];
    if(idx < u[5]) hi=mid-1; else if(idx >= u[5]+u[6]) lo=mid+1; else return mid; }
  return -1;
}
function nextUnitIdx(s){ const u=s.d.u; for(let i=0;i<u.length;i++) if(!S.done[uArr(s,u[i])]) return i; return -1; }
function unlocked(s,i){ if(S.unlockAll) return true; if(i===0) return true; return !!S.done[uArr(s,s.d.u[i-1])]; }
function touchStreak(){
  const d = new Date().toDateString();
  if(S.lastDay === d) return;
  const y = new Date(Date.now()-86400000).toDateString();
  S.streak = (S.lastDay === y) ? (S.streak||0)+1 : 1;
  S.lastDay = d;
}
const unitOf = v => subjectById(v.s).d.u[v.i];

/* ---------------- shell ---------------- */
const app = document.getElementById('app');
const elTop = document.getElementById('top');
const tabsEl = document.getElementById('tabs');
let nav = [{v:'home'}], tab = 'subjects', run = null, sheetOpen = false, cardRun = null, noteOpen = false;
const cur = () => nav[nav.length-1];
function go(view, replace){ if(replace) nav[nav.length-1] = view; else nav.push(view); render(); }
function back(){ if(editDraft){closeQuestionEditor(false);return;} if(nav.length>1){ nav.pop(); render(); } }
function setTab(t){
  tab = t; sheetOpen = false; noteOpen = false;
  nav = [{v: t==='subjects' ? 'home' : t==='review' ? 'review' : t==='test' ? 'test' : 'search'}];
  render();
}
function headerBrand(){
  return '<div class="brand"><div class="brandrow"><span style="flex:1">'
    + '<h1 class="word">PULSE</h1><div class="tag">line-by-time mastery</div></span>'
    + themeBtn()
    + '<button class="gearbtn" data-gear aria-label="Settings">'
    + '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003.4 15a2 2 0 010-4h.1A1.7 1.7 0 004.7 8.1l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010.4 4.2V4a2 2 0 114 0v.2a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9h.2a2 2 0 010 4h-.2a1.7 1.7 0 00-1.9 1.9z"/></svg></button>'
    + '</div>'
    + '<svg class="ecg" viewBox="0 0 600 34" preserveAspectRatio="none" aria-hidden="true">'
      + '<path d="M0 22 H70 l8 -14 l9 26 l8 -22 l7 10 H150 H250 l8 -14 l9 26 l8 -22 l7 10 H340 H440 l8 -14 l9 26 l8 -22 l7 10 H600"/>'
    + '</svg></div>';
}
function themeBtn(){
  const d = isDark();
  return '<button class="gearbtn" data-theme-toggle aria-label="Switch theme">'
    + (d
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M20.5 14.6A8.5 8.5 0 019.4 3.5 8.5 8.5 0 1020.5 14.6z"/></svg>')
    + '</button>';
}
function headerBar(title){
  return '<div class="barrow">'
    + '<button class="backbtn on" id="navBack" aria-label="Back">'
    + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>'
    + '<span class="bartitle">'+esc(title)+'</span>'
    + themeBtn()
    + '<button class="gearbtn" data-gear aria-label="Settings">'
    + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003.4 15a2 2 0 010-4h.1A1.7 1.7 0 004.7 8.1l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010.4 4.2V4a2 2 0 114 0v.2a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9h.2a2 2 0 010 4h-.2a1.7 1.7 0 00-1.9 1.9z"/></svg></button>'
    + '</div>';
}
function render(){
  const v = cur();
  const sv = viewSubjectId(v) ? subjectById(viewSubjectId(v)) : null;
  if (v.v==='home' || v.v==='review' || v.v==='test' || v.v==='search' && nav.length===1) elTop.innerHTML = headerBrand();
  else elTop.innerHTML = headerBar(
      v.v==='vols' ? v.fam
    : v.v==='chapters' ? sv.name
    : v.v==='chapter' || v.v==='guide' ? 'Chapter '+String(sv.d.c[v.c!=null?v.c:unitOf(v)[0]][0]).padStart(2,'0')
    : v.v==='quiz' ? (run ? run.title : 'Quiz')
    : v.v==='cards'   ? (cardRun ? cardRun.title : 'Flashcards')
    : v.v==='results' ? 'Results'
    : v.v==='search' ? 'Search' : (sv ? sv.name : 'PULSE'));
  elTop.className = (v.v==='home' ? '' : 'bar');

  const html =
      v.v==='home'    ? viewHome()
    : v.v==='vols'    ? viewVols(v.fam)
    : v.v==='chapters' ? viewChapters(sv)
    : v.v==='chapter'  ? viewChapter(sv, v.c)
    : v.v==='guide'    ? viewGuide(sv, unitOf(v), v.i)
    : v.v==='quiz'     ? viewQuiz()
    : v.v==='results'  ? viewResults()
    : v.v==='review'   ? viewReview()
    : v.v==='revsub'   ? viewRevSub(sv)
    : v.v==='test'     ? viewTest()
    : v.v==='cards'    ? viewCards()
    : v.v==='search'   ? viewSearch(v.q)
    : viewHome();
  app.innerHTML = html + (sheetOpen ? settingsSheet() : '');

  // tab bar
  const hide = v.v==='quiz' || v.v==='cards';
  tabsEl.classList.toggle('hide', hide);
  [...tabsEl.querySelectorAll('.tab')].forEach(b=>b.classList.toggle('on', b.dataset.tab===tab));
  const due = dueKeys().length, mis = Object.keys(S.wrong).length;
  const badge = document.getElementById('tabBadge');
  const n = due + mis;
  badge.textContent = n > 99 ? '99+' : n;
  badge.classList.toggle('hidden', n===0 && Object.keys(S.flags).length===0);
  document.getElementById('footMeta').textContent = num(totQs())+' questions · works offline';
  { const al=document.getElementById('apkLink'); if(al) al.hidden = !!window.PulseAndroid; }
  const nb = document.getElementById('navBack'); if(nb) nb.onclick = back;
  if (v.v==='quiz' && run && run.mode==='test' && run.timerEnd && !run.done) startTimer(); else clearInterval(timerInt);
  focusPaint();
  window.scrollTo(0,0);
}

/* ================= HOME ================= */
function viewHome(){
  const done = Object.keys(S.done).length;
  let cont = '';
  if (run && !run.done && S.active){
    const rs = run.s!=null ? subjectById(run.s) : null;
    cont = '<button class="subcard" data-resume-quiz="1" style="border-color:#E8DCC6;background:#FFFDF7">'
      + '<span class="ico" style="background:'+(rs?icobg(rs):'var(--accA1)')+'">'+(rs?rs.em:'\u25b6')+'</span>'
      + '<span class="tt"><b>'+esc(run.title||'Resume quiz')+'</b><span>Continue \u00b7 question '+(run.idx+1)+' of '+run.items.length+(run.answered?' \u00b7 '+run.correct+' correct':'')+'</span></span>'
      + '<span class="rt"><svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></span></button>';
  } else if (S.last && subjectById(S.last.s)){
    const s = subjectById(S.last.s), u = s.d.u[S.last.i];
    if (u) cont = '<button class="subcard" data-continue="1" style="border-color:#E8DCC6;background:#FFFDF7">'
      + '<span class="ico" style="background:'+icobg(s)+'">'+s.em+'</span>'
      + '<span class="tt"><b>'+esc(u[2])+'</b><span>Continue · '+esc(s.name)+' · '+u[6]+' questions left</span></span>'
      + '<span class="rt"><svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></span></button>';
  }
  const t = todayStats(), goal = prefs().goal || 50;
  const qd = qotdKey(), qsub = subjectById(qd.sid);
  const qs = qsub, qtext = qsub ? effectiveQ(qsub.id,qd.qi)[0] : '';
  const gp = Math.min(100, goal ? 100*t.a/goal : 0);
  return '<div class="view">'
    + '<div class="stats">'
      + '<div class="stat xp"><b>'+num(S.xp)+'</b><span>XP</span></div>'
      + '<div class="stat st"><b>'+(S.streak||0)+'</b><span>Day streak</span></div>'
      + '<div class="stat ms"><b>'+done+'</b><span>Mastered</span></div>'
    + '</div>'
    + '<div class="goal"><div class="top"><b>Today\u2019s goal</b>'
      + '<span>'+t.a+' / '+goal+' questions'+(t.a?' \u00b7 '+Math.round(100*t.c/t.a)+'% correct':'')+'</span></div>'
      + '<div class="gb"><i style="width:'+gp.toFixed(1)+'%"></i></div></div>'
    + '<div class="toolrow">'
      + '<button class="tool" id="focusTool"><span class="big">'+(focus&&focus.running?'Focusing…':focusToday()+' min')+'</span>'
        + '<b>Focus timer</b><span>'+(focus&&focus.running?'Tap to pause':'25 minute study session')+'</span></button>'
      + '<button class="tool tiny" data-qotd="1"><span class="big">QUESTION OF THE DAY</span>'
        + '<b>'+esc(qs ? qs.name : 'PULSE')+'</b><span>'+esc(qotdExcerpt(qtext, 58))+'</span></button>'
    + '</div>'
    + (cont ? cont : '')
    + '<div class="sechead"><i></i><h2>Subjects</h2><em>'+num(totUnits())+' units · '+num(totQs())+' Q</em></div>'
    + '<div class="list">' + (function(){
        const groups = [], gi = {};
        SUBJECTS.forEach(s=>{ if(gi[s.sp]==null){ gi[s.sp]=groups.length; groups.push({sp:s.sp, ms:[]}); } groups[gi[s.sp]].ms.push(s); });
        return groups.map(g=>{
          if (g.ms.length===1){
            const s = g.ms[0];
            const dn = subjDone(s), tot = s.d.u.length, pct = tot ? 100*dn/tot : 0;
            return '<button class="subcard" data-sub="'+s.id+'">'
              + '<span class="ico" style="background:'+icobg(s)+'">'+s.em+'</span>'
              + '<span class="tt"><b>'+esc(s.name)+'</b><span>Marrow Edition 8 · '+s.d.c.length+' chapters · '+num(s.d.q.length)+' questions</span></span>'
              + '<span class="rt">'+(pct>0?ring(pct, s.acc, 38):'')+'<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></span>'
            + '</button>';
          }
          const chs = g.ms.reduce((a,s)=>a+s.d.c.length,0), qn = g.ms.reduce((a,s)=>a+s.d.q.length,0);
          const dn = g.ms.reduce((a,s)=>a+subjDone(s),0), un = g.ms.reduce((a,s)=>a+s.d.u.length,0);
          const pct = un ? 100*dn/un : 0;
          return '<button class="subcard" data-fam="'+esc(g.sp)+'">'
            + '<span class="ico" style="background:#F4EEE4">📚</span>'
            + '<span class="tt"><b>'+esc(g.sp)+'</b><span>'+g.ms.length+' volumes · '+chs+' chapters · '+num(qn)+' questions</span></span>'
            + '<span class="rt">'+(pct>0?ring(pct, g.ms[0].acc, 38):'')+'<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></span>'
          + '</button>';
        }).join('');
      })() + '</div>'
    + '<div class="note">'+(window.PulseAndroid
      ? 'Your progress, notes and revision schedule save on this phone. Back up from Settings before uninstalling or clearing app data.'
      : 'Tap the gear for <b>import from the old modules</b>, unlocking every unit, or a reset. Progress, XP and revision schedules save on this device automatically.')+'</div>'
  + '</div>';
}

/* ================= SUBJECT VOLUMES ================= */
function viewVols(fam){
  const ms = SUBJECTS.filter(s=>s.sp===fam);
  if(!ms.length) return '<div class="empty">Nothing here yet.</div>';
  const qn = ms.reduce((a,s)=>a+s.d.q.length,0), chs = ms.reduce((a,s)=>a+s.d.c.length,0);
  const dn = ms.reduce((a,s)=>a+subjDone(s),0), un = ms.reduce((a,s)=>a+s.d.u.length,0);
  const pct = un ? 100*dn/un : 0;
  return '<div class="view">'
    + '<div class="subcard" style="margin-top:14px;cursor:default;box-shadow:none;background:var(--card2)">'
      + '<span class="ico" style="background:#F4EEE4">\u{1f4da}</span>'
      + '<span class="tt"><b>'+esc(fam)+'</b><span>Marrow Edition 8 · '+ms.length+' volumes · '+chs+' chapters · '+num(qn)+' questions</span></span>'
      + '<span class="rt">'+(dn?ring(pct, ms[0].acc, 44):'')+'</span>'
    + '</div>'
    + '<div class="list">' + ms.map(s=>{
        const d2 = subjDone(s), tot = s.d.u.length, p = tot ? 100*d2/tot : 0;
        return '<button class="subcard" data-sub="'+s.id+'">'
          + '<span class="ico" style="background:'+icobg(s)+'">'+s.em+'</span>'
          + '<span class="tt"><b>'+esc(s.name)+'</b><span>'+s.d.c.length+' chapters · '+num(s.d.q.length)+' questions'+(d2?' · '+d2+'/'+tot+' units':'')+'</span></span>'
          + '<span class="rt">'+(p>0?ring(p, s.acc, 38):'')+'<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></span>'
        + '</button>';
      }).join('') + '</div>'
  + '</div>';
}

/* ================= CHAPTERS ================= */
function viewChapters(s){
  const dn = subjDone(s), tot = s.d.u.length;
  const qsPer = s.d.c.map(()=>0), unPer = s.d.c.map(()=>0), donePer = s.d.c.map(()=>0);
  s.d.u.forEach(u=>{ const c=u[0]; unPer[c]++; if(S.done[uArr(s,u)]) donePer[c]++; });
  s.d.c.forEach((c,i)=>{ const next = s.d.c[i+1] ? s.d.c[i+1][0] : null; });
  // questions per chapter
  s.d.u.forEach(u=>{ qsPer[u[0]] += u[6]; });
  const curI = nextUnitIdx(s);
  return '<div class="view">'
    + '<div class="subcard" style="margin-top:14px;cursor:default;box-shadow:none;background:var(--card2)">'
      + '<span class="ico" style="background:'+icobg(s)+'">'+s.em+'</span>'
      + '<span class="tt"><b>'+esc(s.name)+'</b><span>'+esc(s.sp)+' · '+s.d.c.length+' chapters · '+num(s.d.q.length)+' questions</span></span>'
      + '<span class="rt">'+(tot&&dn?ring(100*dn/tot, s.acc, 44):'')+'</span>'
    + '</div>'
    + '<div class="btns">'
      + (curI>=0 ? '<button class="btn primary full" data-resume="1">Continue · '+esc(s.d.u[curI][2])+'</button>'
                 : '<button class="btn green full" data-drill="'+s.id+'">Subject complete · drill 25 random</button>')
      + '<button class="btn ghost full" data-drill="'+s.id+'">Random drill · 25 questions</button>'
    + '</div>'
    + '<div class="sechead"><i></i><h2>Chapters</h2><em>'+dn+'/'+tot+' units done</em></div>'
    + '<div class="list">' + s.d.c.map((c,i)=>{
        const pct = unPer[i] ? 100*donePer[i]/unPer[i] : 0;
        return '<button class="chrow" data-ch="'+i+'">'
          + '<span class="numball'+(pct>=100&&unPer[i]?' done':'')+'">'+c[0]+'</span>'
          + '<span class="tt"><b>'+esc(c[1])+'</b><span>'+qsPer[i]+' questions · '+donePer[i]+'/'+unPer[i]+' units'+(c[2]?' · p'+c[2]:'')+'</span></span>'
          + '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>'
        + '</button>';
      }).join('') + '</div>'
  + '</div>';
}

/* ================= CHAPTER (path) ================= */
function viewChapter(s, c){
  const ch = s.d.c[c];
  const list = [];
  s.d.u.forEach((u,i)=>{ if(u[0]===c) list.push({u,i}); });
  const dn = list.filter(x=>S.done[uArr(s,x.u)]).length;
  const qs = list.reduce((a,x)=>a+x.u[6],0);
  const curI = nextUnitIdx(s);
  const cells = list.map(({u,i},p)=>{
    const rec = S.done[uArr(s,u)];
    const lock = !unlocked(s,i);
    const isCur = (i===curI);
    const sub = u[6]+' questions'+(u[5]!=null&&ch[2]?' · p'+ch[2]:'');
    if (isCur && !rec){
      return '<button class="node current" data-unit="'+i+'">'
        + '<span class="startwrap" style="margin-bottom:0"><span class="startchip">'+(dn?'Continue':'Start')+'</span>'
        + '<span class="startball"><svg width="34" height="34" viewBox="0 0 24 24" fill="#4A3606"><path d="M8 5.5v13l11-6.5z"/></svg></span></span>'
        + '<span class="nodewrap" style="margin-top:4px"><span class="t">'+esc(u[2])+'</span><span class="m">'+sub+'</span></span></button>';
    }
    const cls = rec ? 'done' : (lock ? 'locked' : '');
    const inner = rec ? '✓' : (lock ? '🔒' : (p+1));
    return '<button class="node '+cls+'" data-unit="'+i+'"'+(lock?' disabled':'')+'>'
      + '<span class="circle">'+inner+'</span>'
      + '<span class="nodewrap"><span class="t">'+esc(u[2])+'</span><span class="m">'+sub+'</span></span>'
      + (hasFlags(s,u)?'<span class="m" style="color:#B8860B">★ starred</span>':'')
    + '</button>';
  }).join('');
  return '<div class="view">'
    + '<div class="banner">'
      + '<div class="kick">'+esc(s.name.toUpperCase())+' · BOOK p.'+(ch[2]||'—')+'</div>'
      + '<h2>'+esc(ch[1])+'</h2>'
      + '<p>'+list.length+' units · '+qs+' questions · '+dn+'/'+list.length+' complete</p>'
      + '<div class="bar"><i style="width:'+(list.length?100*dn/list.length:0).toFixed(1)+'%"></i></div>'
    + '</div>'
    + (S.unlockAll ? '<div class="note" style="margin-top:14px">All units are unlocked — you can jump to any unit.</div>' : '')
    + '<div class="path">' + cells + '</div>'
  + '</div>';
}

/* ================= GUIDE ================= */
function viewGuide(s, u, i){
  const rec = S.done[uArr(s,u)];
  const bullets = (u[3]||'').split('\n').filter(b=>b.trim());
  const starred = hasFlags(s,u);
  return '<div class="view" style="--acc:'+s.acc+'">'
    + '<div class="banner" style="background:linear-gradient(140deg,#2E5C4E,#1F3F36)">'
      + '<div class="kick">'+esc(s.name.toUpperCase())+' · UNIT '+esc(u[1])+'</div>'
      + '<h2>'+esc(u[2])+'</h2>'
      + '<p>'+u[6]+' questions'+(rec?' · best '+rec.r+'/'+rec.t:'')+(u[4]?' · diagram: '+esc(u[4]):'')+'</p>'
    + '</div>'
    + (bullets.length ? '<div class="note" style="margin-top:14px"><b style="display:block;font-size:10.5px;letter-spacing:2px;color:var(--green);margin-bottom:10px">GUIDE</b>'
        + '<ul style="margin:0;padding-left:19px;font-size:14px;line-height:1.72;color:var(--ink2)">'
        + bullets.map(b=>'<li style="margin-bottom:8px">'+rich(b)+'</li>').join('') + '</ul></div>' : '')
    + '<div class="btns">'
      + '<button class="btn primary full" data-start="'+i+'">'+(rec?'Redo unit':'Start unit')+' · '+u[6]+' questions</button>'
      + (rec?'<button class="btn ghost full" data-start-rnd="'+i+'">Shuffle & retry</button>':'')
      + '<button class="btn ghost full" data-cards-unit="'+i+'">Flashcards \u00b7 '+u[6]+' cards</button>'
      + (starred?'<button class="btn ghost full" data-practice-flags="'+i+'">Practise starred here</button>':'')
    + '</div>'
  + '</div>';
}

/* ---------------- focus timer (pomodoro) ---------------- */
const FOCUS_LEN = 25*60*1000;
let focus = null, focusInt = null;
function focusEl(){ let el = document.getElementById('focusPill');
  if (!el){ el = document.createElement('div'); el.id = 'focusPill'; el.className = 'focuspill'; document.body.appendChild(el);
    el.addEventListener('click', e=>{
      if (e.target.closest('.x')) focusReset(); else focusToggle(); }); }
  return el; }
function focusPaint(){
  const v = cur();
  const hidden = (v.v==='quiz' || v.v==='cards' || sheetOpen);
  const el = focusEl();
  if (hidden || !focus){ el.style.display='none'; return; }
  el.style.display = 'flex';
  const ms = focus ? (focus.running ? Math.max(0, focus.end - Date.now()) : focus.leftMs) : FOCUS_LEN;
  const mm = Math.floor(ms/60000), ss = Math.floor((ms%60000)/1000);
  el.className = 'focuspill' + (focus && focus.running ? ' run' : '');
  el.innerHTML = '<span class="dotp"></span><span>'+(focus&&focus.running?'':'Focus · ')+mm+':'+String(ss).padStart(2,'0')+'</span>'
    + '<span class="x">'+(focus&&focus.running?'✕':'+')+'</span>';
}
function focusToggle(){
  if (!focus) focus = {running:false, leftMs:FOCUS_LEN};
  if (!focus.running){
    focus.running = true; focus.end = Date.now() + focus.leftMs; focus.started = Date.now();
    if (focusInt) clearInterval(focusInt);
    focusInt = setInterval(()=>{
      if (!focus || !focus.running){ clearInterval(focusInt); return; }
      if (focus.end - Date.now() <= 0){
        bankFocus(Math.min(FOCUS_LEN, Date.now()-focus.started)/1000);
        clearInterval(focusInt);
        focus = {running:false, leftMs:FOCUS_LEN};
        haptic([30,80,30]); toast('Focus session complete · 25 min banked');
      }
      focusPaint();
    }, 1000);
    toast('Focus session started · 25 minutes');
  } else {
    const left = Math.max(0, focus.end - Date.now());
    bankFocus(Math.max(0, Math.min(FOCUS_LEN, Date.now()-focus.started))/1000);
    focus.running = false; focus.leftMs = left;
    if (focusInt) clearInterval(focusInt);
    toast('Focus paused');
  }
  focusPaint();
}
function focusReset(){
  if (focus && focus.running) bankFocus(Math.max(0, Math.min(FOCUS_LEN, Date.now()-focus.started))/1000);
  focus = null; if (focusInt) clearInterval(focusInt);
  save(); render();
  toast('Focus timer reset');
}
/* ---------------- question of the day ---------------- */
let flatIdx = null;
function flatIndex(){
  if (flatIdx) return flatIdx;
  flatIdx = [];
  SUBJECTS.forEach(s=>{ for(let q=0;q<s.d.q.length;q++) flatIdx.push({s:s.id, q:q}); });
  return flatIdx;
}
function qotdKey(){
  const k = dayKey(); let n = 0; for (let i=0;i<k.length;i++) n = (n*31 + k.charCodeAt(i)) % 1000003;
  const idx = flatIndex()[n % flatIndex().length];
  return {key: qKey(idx.s, idx.q), sid: idx.s, qi: idx.q};
}
function qotdExcerpt(text, n){
  const t = String(text||'').replace(/\s+/g,' ').trim();
  return t.length > n ? t.slice(0, n-1)+'…' : t;
}

/* ================= QUIZ ================= */
function buildRun(items, title, opts){
  opts = opts||{};
  run = { title:title, items:items, idx:0, correct:0, answered:0, xp:0, log:[], startTs:Date.now(), qStart:Date.now(),
          s:(opts.s||null), i:(opts.i!=null?opts.i:null), mode:opts.mode||'unit', done:false, rated:{}, qtime:0,
          draft:'', match:null, msel:null };
  noteOpen = false;
  persistRun();
}
function resultsNextIdx(){
  if(!run) return -1;
  const s = run.s!=null ? subjectById(run.s) : null; if(!s) return -1;
  let cur = (run.i!=null) ? run.i : -1;
  if(cur<0 && run.items && run.items.length){
    const last = run.items[run.items.length-1];
    cur = (last.u!=null) ? last.u : findUnitByAbs(s,last.q);
  }
  if(cur<0) return nextUnitIdx(s);
  return (cur+1 < s.d.u.length) ? cur+1 : -1;
}
function persistRun(){
  try{ if(run && !run.done) S.active = JSON.parse(JSON.stringify(run)); else delete S.active; save(); }catch(e){}
}
function restoreActive(){
  const a = S && S.active;
  if(!a || typeof a!=='object' || !Array.isArray(a.items)) return false;
  a.items = a.items.filter(it=>it && typeof it.s==='string' && Number.isInteger(it.q) && subjectById(it.s) && subjectById(it.s).d.q[it.q]);
  if(!a.items.length){ delete S.active; save(); return false; }
  if(!(a.idx>=0) || a.idx>=a.items.length) a.idx=0;
  if(!Array.isArray(a.log)) a.log=[];
  a.done=false; a.draft=''; a.match=null; a.msel=null;
  run=a; noteOpen=false; sheetOpen=false; cardRun=null;
  nav=[{v:'home'},{v:'quiz'}]; tab='subjects';
  if(run.mode==='test' && run.timerEnd && Date.now()>run.timerEnd) collectResults();
  return true;
}
function runUnitKey(it){
  const s = subjectById(it.s); if(!s) return null;
  const i = (it.u!=null) ? it.u : findUnitByAbs(s, it.q);
  return i>=0 ? uArr(s, s.d.u[i]) : null;
}
const itemQ = it => {
  if(run){const i=run.items.indexOf(it);if(i>=0 && run.log[i] && run.log[i].question) return run.log[i].question;}
  return effectiveQ(it.s,it.q);
};
function startUnit(s, i, shuffle){
  const u = s.d.u[i], items = [];
  for(let k=0;k<u[6];k++) items.push({s:s.id, q:u[5]+k, u:i});
  if (shuffle) items.sort(()=>Math.random()-0.5);
  S.last = {s:s.id, i:i}; save();
  buildRun(items, u[2], {s:s.id, i:i, mode:'unit'});
  go({v:'quiz'});
}
function startDrill(s, count, mode, keys){
  let items = [];
  if (keys && keys.length){
    items = keys.map(k=>{ const p=k.split('#'); return {s:p[0], q:+p[1], u:null}; });
  } else {
    const pool = [];
    (s ? [s] : SUBJECTS).forEach(sub=>{
      sub.d.u.forEach((u,i)=>{ if(!s && S.done[uArr(sub,u)] && Math.random()>0.3) return;
        for(let k=0;k<u[6];k++) pool.push({s:sub.id, q:u[5]+k, u:i}); });
    });
    items = pool.sort(()=>Math.random()-0.5).slice(0, count||25);
  }
  if(!items.length){ toast('Nothing to practise yet'); return; }
  items.forEach(it=>{ if(it.u==null){ const s2=subjectById(it.s); const ui=findUnitByAbs(s2,it.q); if(ui>=0) it.u=ui; } });
  const titles = {wrong:'Mistakes review', flags:'Starred review', mix:'Mixed review', srs:'Spaced revision'};
  buildRun(items, titles[mode] || (s ? s.name+' drill' : 'Random drill'), {s: s?s.id:null, i:null, mode: mode||'drill'});
  go({v:'quiz'});
}
function viewQuiz(){
  if(!run) return '<div class="empty">No quiz loaded.</div>';
  const it = run.items[run.idx], q = itemQ(it), s = subjectById(it.s);
  const u = it.u!=null ? s.d.u[it.u] : null;
  const answered = run.log[run.idx] || null;
  const key = qKey(it.s, it.q);
  const note = (S.notes||{})[key];
  const flagged = !!S.flags[key];
  const sch = srsOf(key);
  const test = run.mode==='test';
  const revealed = !test || run.revealed;
  const dots = run.items.map((x,k)=>'<span class="'+(k<run.answered?(test?'done':(run.log[k]&&run.log[k].ok?'ok':'no')):(k===run.idx?'now':''))+'"></span>').join('');
  return '<div class="view">'
    + '<div class="qtop">'
      + (test ? '<span class="chip">MOCK TEST</span>' : '<span class="chip">'+esc(s.name)+'</span>')
      + '<span class="chip fmt">'+fmtLabel(q[4])+'</span>'
      + (q[6] && (!u || q[6]!==u[2]) ? '<span class="chip sec">'+esc(q[6])+'</span>' : '')
      + (q[5]?'<span class="chip">p'+q[5]+'</span>':'')
      + (run.timerEnd ? '<span class="chip timer">\u23f1 <span id="timerText">--:--</span></span>' : '')
      + '<button class="notebtn'+(note?' on':'')+'" id="noteBtn" aria-label="Note">✎</button>'
      + '<button class="flagbtn'+(flagged?' on':'')+'" id="flagBtn" aria-label="Star">'+(flagged?'★':'☆')+'</button>'
    + '</div>'
    + '<div class="dots">'+dots+'</div>'
    + '<div class="qbar"><i style="width:'+(100*run.answered/run.items.length).toFixed(1)+'%"></i></div>'
    + '<div class="qmeta"><span>Question '+(run.idx+1)+' of '+run.items.length+'</span><span>'+(test ? run.answered+' answered' : run.correct+' correct \u00b7 +'+run.xp+' XP')+'</span></div>'
    + '<div class="qcard">'
      + editButton(it)
      + (answered && S.edits[key] ? '<p class="editor-help">This attempt keeps the question as answered. Your correction applies on the next attempt.</p>' : '')
      + questionHtml(q)
      + '<div class="opts" id="opts">'+optionsHtml(q,answered,revealed,test)+'</div>'
      + (noteOpen ? '<textarea class="noteedit" id="noteTa" placeholder="Your note on this question \u2014 appears in Review and in your backup">'+esc(note||'')+'</textarea>'
          + '<div class="btns" style="margin-top:10px"><button class="btn primary full" id="noteSave">Save note</button>'
          + (note ? '<button class="btn ghost" id="noteDel">Delete</button>' : '')+'</div>'
        : (note && revealed ? '<div class="usernote"><b>Your note</b>'+esc(note)+'</div>' : ''))
      + (answered && !revealed ? '<div class="note" style="margin-top:14px">Answer locked in \u2014 you will see the score and explanations when the test ends.</div>' : '')
      + (answered && revealed ? '<div class="exp'+(answered.ok?'':' bad')+'">'
          + (answered.ok ? '<b>Correct</b>' : (isMatchQ(q) ? '' : '<b>Answer: '+answerHead(q)+'</b>'))
          + rich(q[3]||'Answer recorded in the book.')+'</div>' : '')
      + (answered && revealed ? '<div class="rate">'
          + '<div class="rl">Spaced revision · when to see this again'+(sch?' ':'')+'</div>'
          + '<div class="rbtns">'
            + '<button class="rbtn again" data-rate="again">Again<small>'+srsNextLabel(key,'again')+'</small></button>'
            + '<button class="rbtn hard" data-rate="hard">Hard<small>'+srsNextLabel(key,'hard')+'</small></button>'
            + '<button class="rbtn good" data-rate="good">Good<small>'+srsNextLabel(key,'good')+'</small></button>'
            + '<button class="rbtn easy" data-rate="easy">Easy<small>'+srsNextLabel(key,'easy')+'</small></button>'
          + '</div></div>' : '')
      + '<div class="qfoot">'
        + (answered ? '<button class="btn primary" id="nextQ">'+(run.idx+1>=run.items.length?(test?'Finish test':'Finish session'):'Next question')+'</button>'
                    : (test ? '<button class="btn primary" id="skipQ">Skip question</button>'
                            : '<button class="btn ghost full" id="skipQ">Skip & reveal</button>'))
      + '</div>'
      + (test ? '<button class="btn ghost full" id="submitTest" style="margin-top:10px">Submit test now</button>' : '')
    + '</div>'
  + '</div>';
}
function optionHtml(o,k,q,answered,test){
  let cls='', dis='';
  if (answered){
    dis=' disabled';
    if (test && run && !run.revealed){ cls = (k===answered.chosen) ? ' chosen' : ' dim'; }
    else if (k===q[2]) cls=' right';
    else if (k===answered.chosen) cls=' wrong';
    else cls=' dim';
  }
  return '<button class="opt'+cls+'" data-opt="'+k+'"'+dis+'>'
    + '<span class="l">'+String.fromCharCode(65+k)+'</span><span class="o">'+rich(o)+'</span></button>';
}
function answerHead(q){
  return isRichQ(q) ? esc(correctAnswerText(q)||'\u2014') : String.fromCharCode(65+q[2]);
}
/* The interactive answer area: MCQ buttons, a fill box, or a matching board. */
function optionsHtml(q, answered, revealed, test){
  const kind = richKind(q);
  if (kind==='fill')  return fillHtml(q, answered, revealed);
  if (kind==='match') return matchHtml(q, answered, revealed);
  return q[1].map((o,k)=>optionHtml(o,k,q,answered,test)).join('');
}
function fillHtml(q, answered, revealed){
  const draft = (run && typeof run.draft==='string') ? run.draft : '';
  if (answered){
    const val = typeof answered.chosen==='string' ? answered.chosen : draft;
    if (!revealed)
      return '<div class="fillwrap"><input class="fillin" type="text" value="'+esc(val)+'" disabled aria-label="Your answer">'
        + '<div class="fillfb">Answer locked in \u2014 it is marked when the test ends.</div></div>';
    return '<div class="fillwrap"><input class="fillin '+(answered.ok?'right':'wrong')+'" type="text" value="'+esc(val)+'" disabled aria-label="Your answer">'
      + '<div class="fillfb '+(answered.ok?'ok':'no')+'">'+(answered.ok?'Correct':(val?'Answer: <b>'+esc(correctAnswerText(q))+'</b>':'Skipped \u2014 answer: <b>'+esc(correctAnswerText(q))+'</b>'))+'</div></div>';
  }
  return '<div class="fillwrap">'
    + '<input class="fillin" id="fillBox" type="text" value="'+esc(draft)+'" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type the missing word or value" aria-label="Your answer">'
    + '<button class="btn primary" id="fillCheck">Check answer</button>'
    + '</div>';
}
function matchState(q){
  const m = qMeta(q) || {};
  const n = Array.isArray(m.left) ? m.left.length : 0;
  if (!run) return [];
  if (!Array.isArray(run.match) || run.match.length!==n) run.match = new Array(n).fill(null);
  return run.match;
}
function matchHtml(q, answered, revealed){
  const m = qMeta(q), key = matchKey(q);
  const done = !!answered;
  const chosen = done ? (Array.isArray(answered.chosen) ? answered.chosen : [])
                      : matchState(q);
  const sel = (!done && run) ? run.msel : null;
  let rows = '';
  m.left.forEach((L,i)=>{
    const c = chosen[i];
    let cls = 'mslot', label = (c!=null && m.right[c]!=null) ? m.right[c] : 'Tap, then pick a match';
    if (done && revealed){
      const okCell = c===key[i];
      cls += okCell ? ' right' : ' wrong';
      if (!okCell) label = 'Correct: '+m.right[key[i]];
    } else if (done) cls += ' locked';
    else if (c!=null) cls += ' filled';
    if (!done && sel===i) cls += ' sel';
    rows += '<div class="mrow"><span class="mleft">'+rich(L)+'</span>'
      + '<button type="button" class="'+cls+'" data-mslot="'+i+'"'+(done?' disabled':'')+'>'+rich(label)+'</button></div>';
  });
  let bank = '';
  if (!done){
    bank = '<div class="mbank">'+m.right.map((R,j)=>{
      const used = chosen.indexOf(j)>=0;
      return '<button type="button" class="mchip'+(used?' used':'')+'" data-mchip="'+j+'"'+(used?' disabled':'')+'>'+rich(R)+'</button>';
    }).join('')+'</div>';
  }
  const complete = done || matchFilled(q, chosen);
  return '<div class="matchwrap">'+rows+bank
    + (done ? '' : '<button class="btn primary" id="matchCheck"'+(complete?'':' disabled')+'>Check answer</button>')
    + '</div>';
}
function questionHtml(q){
  const fmt = String(q[4]||'').toLowerCase();
  let text = String(q[0]||'');
  if ((fmt==='fillup' || fmt==='fill' || isFillQ(q)) && text.indexOf('____')>=0)
    return '<p class="qtext">'+esc(text).split('____').join('<span class="blank"></span>')+'</p>';
  if (fmt==='match'){
    const parts = text.split(/\s*(?:…|\.\.\.)\s*/);
    if (parts.length>=2){
      const left = [], right = [];
      (parts[0].match(/(?:^|\s)(\d)\)\s*([\s\S]*?)(?=\s+\d\)\s*|$)/g)||[]).forEach(m=>{
        const mm = m.trim().match(/^(\d)\)\s*([\s\S]*)$/); if(mm) left.push([mm[1],mm[2].trim()]); });
      (parts[1].match(/(?:^|\s)([A-Z])\)\s*([\s\S]*?)(?=\s+[A-Z]\)\s*|$)/g)||[]).forEach(m=>{
        const mm = m.trim().match(/^([A-Z])\)\s*([\s\S]*)$/); if(mm) right.push([mm[1],mm[2].trim()]); });
      const stem = parts[0].replace(/(?:^|\s)\d\)\s*[\s\S]*$/,'').trim();
      if (left.length>=2 && right.length>=2){
        const n = Math.max(left.length, right.length); let rows='';
        for(let i=0;i<n;i++) rows += '<tr><td class="k">'+(left[i]?left[i][0]:'')+'</td><td>'+(left[i]?rich(left[i][1]):'')+'</td>'
          + '<td class="k" style="padding-left:14px">'+(right[i]?right[i][0]:'')+'</td><td>'+(right[i]?rich(right[i][1]):'')+'</td></tr>';
        return '<p class="qtext">'+rich(stem||'Match the following')+'</p><table class="pairs">'+rows+'</table>';
      }
    }
  }
  return '<p class="qtext">'+rich(text)+'</p>';
}
function answer(i){
  if(!run || run.log[run.idx]) return;
  const q = itemQ(run.items[run.idx]);
  commitAnswer(i, i===q[2]);
}
function answerFill(){
  if(!run || run.log[run.idx]) return;
  const q = itemQ(run.items[run.idx]), box = document.getElementById('fillBox');
  const val = String(box ? box.value : (run.draft||'')).trim();
  if (!val){ toast('Type an answer first'); if(box) box.focus(); return; }
  run.draft = val;
  commitAnswer(val, fillMatches(q, val));
}
function answerMatch(){
  if(!run || run.log[run.idx]) return;
  const q = itemQ(run.items[run.idx]);
  const chosen = matchState(q).slice();
  if (!matchFilled(q, chosen)){ toast('Match every item first'); return; }
  commitAnswer(chosen, matchCorrect(q, chosen));
}
function commitAnswer(chosen, ok){
  if(!run || run.log[run.idx]) return;
  const it = run.items[run.idx], q = itemQ(it), key = qKey(it.s, it.q);
  run.log[run.idx] = {chosen:chosen, ok:ok, question:JSON.parse(JSON.stringify(q))};
  run.answered++;
  const isTest = run.mode === 'test';
  const spent = Math.min(600000, Math.max(400, Date.now() - (run.qStart||Date.now())));
  run.qtime = (run.qtime||0) + spent;
  S.pace = S.pace || {n:0, ms:0}; S.pace.n++; S.pace.ms += spent;
  if (ok){ run.correct++; run.xp += 10; delete S.wrong[key]; if(!isTest) floatXP('+10 XP'); }
  else { S.wrong[key] = 1; }
  logAnswer(it.s, ok, runUnitKey(it));
  haptic(ok ? 8 : [10,40,10]);
  if (isTest) srsRate(key, ok ? 'good' : 'again');
  // pending default grade; the four buttons can override it, otherwise it is
  // applied when moving on so nothing is ever left unscheduled
  run.pending = run.pending || {};
  if (!isTest) run.pending[key] = ok ? 'good' : 'again';
  persistRun(); render();
}
function floatXP(t){
  const el = document.createElement('div'); el.className='xpf'; el.textContent=t;
  el.style.left='50%'; el.style.top='40%'; document.body.appendChild(el);
  setTimeout(()=>el.remove(),1100);
}
function rate(k){
  const it = run.items[run.idx], key = qKey(it.s,it.q);
  const next = srsNextLabel(key, k);
  srsRate(key, k);
  if (run.pending) delete run.pending[key];
  persistRun(); toast('Next review in '+next); render();
}
function applyPending(){
  if(!run || !run.pending) return;
  const it = run.items[run.idx], key = qKey(it.s,it.q);
  if (run.pending[key]){ srsRate(key, run.pending[key]); delete run.pending[key]; }
}
function nextQ(){ if(!run) return; applyPending(); noteOpen = false;
  if(run.idx+1>=run.items.length){ collectResults(); return; }
  run.idx++; run.qStart = Date.now(); run.draft=''; run.match=null; run.msel=null;
  persistRun(); render(); }
function skipQ(){
  const it = run.items[run.idx], key = qKey(it.s,it.q);
  run.log[run.idx] = {chosen:-1, ok:false, skipped:true, question:JSON.parse(JSON.stringify(itemQ(it)))}; run.answered++;
  S.wrong[key]=1; srsRate(key,'again'); logAnswer(it.s, false, runUnitKey(it)); persistRun();
  if (run.mode==='test') nextQ(); else render();
}
function collectResults(){
  if(!run) return;
  clearInterval(timerInt);
  applyPending();
  run.done = true;
  if (run.mode==='test'){
    run.revealed = true;
    const per = {};
    run.items.forEach((it,k)=>{ const lg = run.log[k] || {};
      per[it.s] = per[it.s] || {c:0,t:0}; per[it.s].t++; if (lg.ok) per[it.s].c++; });
    run.per = per;
    S.tests = S.tests || [];
    S.tests.unshift({ts:Date.now(), n:run.items.length, correct:run.correct, total:run.items.length,
      acc: run.items.length ? Math.round(100*run.correct/run.items.length) : 0,
      mins: Math.max(1, Math.round((Date.now()-run.startTs)/60000)), per:per});
    S.tests = S.tests.slice(0,30);
  }
  if (run.mode==='unit' && run.s!=null && run.i!=null){
    const s = subjectById(run.s), u = s.d.u[run.i], key = uArr(s,u), prev = S.done[key];
    const rec = {r:run.correct, t:run.items.length, ts:Date.now()};
    S.done[key] = (prev && prev.r > rec.r) ? prev : rec;
    run.bonus = 15 + (run.correct===run.items.length ? 25 : 0);
    run.xp += run.bonus;
    S.last = {s:run.s, i:run.i};
  }
  delete S.active;
  S.xp = (S.xp||0) + run.xp;
  touchStreak(); save();
  go({v:'results'});
}
let timerInt = null;
function startTimer(){
  clearInterval(timerInt);
  if (!run || !run.timerEnd) return;
  const tick = ()=>{
    const el = document.getElementById('timerText');
    if (!run || run.done){ clearInterval(timerInt); return; }
    const left = Math.max(0, run.timerEnd - Date.now());
    const mm = Math.floor(left/60000), ss = Math.floor((left%60000)/1000);
    if (el) el.textContent = mm + ':' + String(ss).padStart(2,'0');
    if (el && left < 60000) el.parentNode.style.background = 'var(--red)';
    if (left <= 0){ clearInterval(timerInt); toast('Time up \u2014 test submitted'); collectResults(); }
  };
  tick(); timerInt = setInterval(tick, 1000);
}
function startMock(){
  const m = S.mock, subs = m.subs.indexOf('ALL')>=0 ? SUBJECTS : SUBJECTS.filter(s=>m.subs.indexOf(s.id)>=0);
  const pool = [];
  subs.forEach(s=>s.d.u.forEach((u,i)=>{ for(let k=0;k<u[6];k++) pool.push({s:s.id, q:u[5]+k, u:i}); }));
  if (pool.length < 5){ toast('Pick at least one subject'); return; }
  const items = pool.sort(()=>Math.random()-0.5).slice(0, Math.min(m.count, pool.length));
  buildRun(items, 'MOCK TEST', {s:null, i:null, mode:'test'});
  run.timerEnd = m.minutes ? Date.now() + m.minutes*60000 : null;
  run.revealed = false;
  persistRun();
  go({v:'quiz'});
}
function viewResults(){
  if(!run) return '<div class="empty">No session.</div>';
  const pct = run.items.length ? 100*run.correct/run.items.length : 0;
  const s = run.s!=null ? subjectById(run.s) : null;
  const nxt = resultsNextIdx();
  const acc = run.answered ? Math.round(100*run.correct/run.answered) : 0;
  return '<div class="view">'
    + '<div class="banner" style="background:linear-gradient(140deg,'+(pct>=80?'#3E8C60,#2A6644':pct>=50?'#CE9438,#A5681A':'#B4602C,#8A4520')+')">'
      + '<div class="kick">'+(run.mode==='test' ? 'MOCK TEST RESULT' : (pct>=80?'EXCELLENT':pct>=50?'GOOD EFFORT':'KEEP GOING'))+'</div>'
      + '<h2>'+esc(run.title)+'</h2>'
      + '<p>'+run.correct+'/'+run.items.length+' correct · '+acc+'% accuracy · +'+run.xp+' XP</p>'
      + '<div class="bar"><i style="width:'+pct.toFixed(1)+'%"></i></div>'
    + '</div>'
    + '<div class="qcard">'
      + '<div class="scorewrap">'+ring(pct, pct>=80?'#3E8C60':pct>=50?'#C4872C':'#C0392B', 104, Math.round(pct)+'%')
        + '<span style="flex:1;min-width:150px">'
          + '<div style="display:flex;gap:22px;flex-wrap:wrap">'
            + '<div><b style="font-family:var(--serif);font-size:22px">'+run.correct+'</b><div style="font-size:9.5px;font-weight:800;letter-spacing:1.2px;color:var(--mut);text-transform:uppercase">Correct</div></div>'
            + '<div><b style="font-family:var(--serif);font-size:22px">'+run.answered+'</b><div style="font-size:9.5px;font-weight:800;letter-spacing:1.2px;color:var(--mut);text-transform:uppercase">Attempted / '+run.items.length+'</div></div>'
            + '<div><b style="font-family:var(--serif);font-size:22px;color:var(--olive)">+'+run.xp+'</b><div style="font-size:9.5px;font-weight:800;letter-spacing:1.2px;color:var(--mut);text-transform:uppercase">XP</div></div>'
            + (run.answered ? '<div><b style="font-family:var(--serif);font-size:22px">'+Math.round(run.qtime/run.answered/1000)+'s</b><div style="font-size:9.5px;font-weight:800;letter-spacing:1.2px;color:var(--mut);text-transform:uppercase">Per question</div></div>' : '')
          + '</div>'
        + '</span>'
      + '</div>'
      + '<div class="btns">'
        + (nxt>=0 && s ? '<button class="btn primary full" data-unit="'+nxt+'">Next unit →</button>' : '')
        + (s ? ((run.i!=null ? '<button class="btn ghost" data-start="'+run.i+'">Redo</button>' : '') + '<button class="btn ghost" data-open-chapters="'+s.id+'">Chapters</button>')
             : '<button class="btn ghost full" data-tab-home="1">Done</button>')
      + '</div>'
    + '</div>'
    + (run.mode==='test' && run.per ? '<div class="sechead"><i></i><h2>Subject breakdown</h2><em>'+run.items.length+' questions</em></div>'
        + '<div class="list">'+Object.keys(run.per).map(id=>{
            const s = subjectById(id), r = run.per[id], p = r.t?100*r.c/r.t:0;
            return '<div class="accrow"><b>'+s.em+' '+esc(s.name)+'</b><span class="track"><i style="width:'+p.toFixed(1)+'%;background:'+(p>=70?'var(--green)':p>=45?'var(--a1)':'var(--red)')+'"></i></span>'
              + '<em>'+r.c+'/'+r.t+'</em></div>';
          }).join('')+'</div>' : '')
    + '<div class="sechead"><i></i><h2>Review</h2><em>'+run.items.length+' questions</em></div>'
    + '<div class="list">' + run.items.map((it,k)=>{
        const q = itemQ(it), lg = run.log[k]||{}, ok = !!lg.ok, sub = subjectById(it.s);
        const uu = it.u!=null ? sub.d.u[it.u] : null;
        return '<div class="rev '+(ok?'ok':'no')+'"><button data-rev="'+k+'">'
          + '<span class="m">'+(ok?'✓':'✗')+'</span>'
          + '<span style="flex:1"><span style="display:block">'+rich(String(q[0]).slice(0,220))+'</span>'
          + '<span style="display:block;font-family:var(--mono);font-size:10px;color:var(--dim);margin-top:5px">'+esc(sub.name)+(uu?' · '+esc(uu[1]):'')+'</span></span>'
          + '<span style="color:var(--dim)">▾</span></button>'
          + '<div class="body">'
            + '<div>Your answer: '+(lg.skipped?'<span style="color:var(--mut)">skipped</span>':'<em>'+esc(chosenAnswerText(q, lg.chosen)||'\u2014')+'</em>')+'</div>'
            + (ok?'':'<div>Correct: <em>'+esc(correctAnswerText(q))+'</em></div>')
            + '<div class="ex">'+(q[3]?rich(q[3]):'—')+'</div>'
          + '</div></div>';
      }).join('') + '</div>'
  + '</div>';
}

/* ================= REVIEW TAB ================= */
function viewReview(){
  const due = dueKeys(), up = upcomingCount();
  const wrongs = Object.keys(S.wrong), flags = Object.keys(S.flags);
  const tracked = Object.keys(S.srs);
  const barDays = [];
  for(let d=0; d<7; d++){
    const start = new Date(); start.setHours(0,0,0,0);
    const s0 = start.getTime() + d*86400000, s1 = s0 + 86400000;
    barDays.push(tracked.filter(k=>S.srs[k][1] >= s0 && S.srs[k][1] < s1).length);
  }
  const maxBar = Math.max(1, ...barDays);
  const labels = ['today','+1','+2','+3','+4','+5','+6'];
  const bySub = SUBJECTS.map(s=>{
    const nm = s.name;
    const w = wrongs.filter(k=>k.indexOf(s.id+'#')===0).length;
    const f = flags.filter(k=>k.indexOf(s.id+'#')===0).length;
    const dd = due.filter(k=>k.indexOf(s.id+'#')===0).length;
    return {s, w, f, dd};
  }).filter(x=>x.w||x.f||x.dd);
  return '<div class="view">'
    + '<div class="duecard">'
      + '<div class="k">SPACED REVISION</div>'
      + '<h3>'+(due.length ? due.length+' question'+(due.length>1?'s':'')+' due now' : 'Nothing due right now')+'</h3>'
      + '<div class="row">'
        + '<div><b>'+due.length+'</b><span>Due now</span></div>'
        + '<div><b>'+up+'</b><span>Today+</span></div>'
        + '<div><b>'+num(tracked.length)+'</b><span>Rotation</span></div>'
        + '<div><b>'+Object.keys(S.done).length+'</b><span>Mastered</span></div>'
      + '</div>'
      + '<div class="btns">'
        + (due.length ? '<button class="btn gold full" data-srs-drill="1">Revise '+due.length+' due now</button>' : '')
        + '<button class="btn ghost full" data-srs-all="1">Practise everything in rotation</button>'
      + '</div>'
      + '<div class="bars">'+barDays.map((n,i)=>'<i class="'+(n?'has':'')+'" style="height:'+Math.max(5,Math.round(52*n/maxBar))+'px" title="'+n+' due"></i>').join('')+'</div>'
      + '<div class="barlabel">'+labels.map(l=>'<span>'+l+'</span>').join('')+'</div>'
    + '</div>'

    + '<div class="sechead"><i style="background:var(--red)"></i><h2>Mistakes review</h2><em>'+wrongs.length+' saved</em></div>'
    + (wrongs.length
        ? '<div class="btns" style="margin-top:0"><button class="btn maroon full" data-review="wrong">Re-solve all '+wrongs.length+' mistakes</button></div>'
        : '<div class="note">Nothing here. Every question you miss lands here automatically, and clears itself once you get it right.</div>')

    + '<div class="sechead"><i style="background:#C9A227"></i><h2>Starred</h2><em>'+flags.length+' saved</em></div>'
    + (flags.length
        ? '<div class="btns" style="margin-top:0"><button class="btn full" data-review="flags">Practise '+flags.length+' starred</button></div>'
        : '<div class="note">Star a question while solving (☆ top-right) to keep it for later.</div>')
    + (wrongs.length + flags.length ? '<div class="btns"><button class="btn ghost full" data-review="mix">Mixed session</button></div>' : '')

    + (bySub.length ? '<div class="sechead"><i style="background:var(--violet)"></i><h2>By subject</h2><em>tap to drill</em></div>'
      + '<div class="list">'+bySub.map(x=>
        '<button class="subcard" data-revsub="'+x.s.id+'"><span class="ico" style="background:'+x.s.icoBg+'">'+x.s.em+'</span>'
        + '<span class="tt"><b>'+esc(x.s.name)+'</b><span>'+x.dd+' due · '+x.w+' mistakes · '+x.f+' starred</span></span>'
        + '<span class="rt"><svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></span></button>').join('')+'</div>' : '')
    + '<div class="sechead"><i style="background:var(--accent)"></i><h2>Flashcards</h2><em>'+(Object.keys(S.wrong).length + Object.keys(S.flags).length)+' in decks</em></div>'
    + '<div class="btns" style="margin-top:0">'
      + '<button class="btn full" data-cards="wrong"'+(Object.keys(S.wrong).length?'':' disabled')+'>Cards from mistakes · '+Object.keys(S.wrong).length+'</button>'
      + '<button class="btn full" data-cards="flags"'+(Object.keys(S.flags).length?'':' disabled')+'>Cards from starred · '+Object.keys(S.flags).length+'</button>'
      + '<button class="btn full" data-cards="srs"'+(dueKeys().length?'':' disabled')+'>Cards due now · '+dueKeys().length+'</button>'
    + '</div>'
    + '<div class="sechead"><i style="background:var(--red)"></i><h2>Weakest units</h2><em>'+(weakUnits(99).length)+' tracked</em></div>'
    + (weakUnits(5).length ? '<div class="list">'+weakUnits(5).map(w=>
        '<button class="accrow" data-weak="'+w.k+'" style="cursor:pointer;font-family:inherit;text-align:left;width:100%;border:1px solid var(--line)">'
        + '<b>'+w.s.em+' '+esc(w.u[2])+'</b>'
        + '<span class="track"><i style="width:'+w.pct.toFixed(1)+'%;background:'+(w.pct>=70?'var(--green)':w.pct>=45?'var(--a1)':'var(--red)')+'"></i></span>'
        + '<em>'+Math.round(w.pct)+'%</em></button>').join('')+'</div>'
      : '<div class="note">Answer six or more questions in a unit and its accuracy shows up here, weakest first \u2014 tap one to drill it.</div>')
    + '<div class="sechead"><i style="background:var(--violet)"></i><h2>Your notes</h2><em>'+noteKeys().length+' saved</em></div>'
    + (noteKeys().length ? '<div class="list">'+noteKeys().slice(0,10).map(k=>{
          const L = noteLabel(k);
          return '<div class="noterow" data-note-open="'+k+'">'
            + '<span class="nt"><span class="lab">'+esc(L.s?L.s.name:'Question')+(L.u?' \u00b7 '+esc(String(L.u[2])):'')+'</span>'
            + '<p>'+esc(S.notes[k])+'</p></span>'
            + '<button class="del" data-note-del="'+k+'" aria-label="Delete note">\u00d7</button></div>';
        }).join('')+'</div>'
      : '<div class="note">Write a note on any question while solving \u2014 it shows up here and inside your backup file.</div>')
    + '<div class="sechead"><i style="background:var(--green)"></i><h2>Activity</h2><em>last 14 weeks</em></div>'
    + '<div class="toolrow" style="margin-top:0">'
      + '<div class="tool"><span class="big">'+focusToday()+' min</span><b>Focus today</b><span>'+focusTotal()+' min all time</span></div>'
      + '<div class="tool"><span class="big">'+(paceLabel()||'\u2014')+'</span><b>Your pace</b><span>across '+num((S.pace||{}).n||0)+' answers</span></div>'
    + '</div>'
    + heatmapHtml()
    + '<div class="sechead"><i style="background:var(--olive)"></i><h2>Accuracy by subject</h2><em>tap to drill</em></div>'
    + (accuracyRows().length ? '<div class="list">'+accuracyRows().map(r=>
        '<button class="accrow" data-drill="'+r.s.id+'" style="cursor:pointer;font-family:inherit;text-align:left;width:100%;border:1px solid var(--line)">'
        + '<b>'+r.s.em+' '+esc(r.s.name)+'</b>'
        + '<span class="track"><i style="width:'+r.pct.toFixed(1)+'%;background:'+(r.pct>=70?'var(--green)':r.pct>=45?'var(--a1)':'var(--red)')+'"></i></span>'
        + '<em>'+r.pct+'%</em></button>').join('')+'</div>'
      : '<div class="note">Answer a few questions and your accuracy per subject shows up here.</div>')
    + '<div class="note">How revision works: every answered question is scheduled on an expanding interval — the four buttons under each answer set when you will see it again (Again → 10 min, Good → next step, Easy → skip ahead). Wrong answers are also collected under Mistakes until you clear them.</div>'
  + '</div>';
}
function viewRevSub(s){
  const due = dueKeys().filter(k=>k.indexOf(s.id+'#')===0);
  const wrongs = Object.keys(S.wrong).filter(k=>k.indexOf(s.id+'#')===0);
  const flags = Object.keys(S.flags).filter(k=>k.indexOf(s.id+'#')===0);
  const keys = wrongs.concat(due.filter(k=>wrongs.indexOf(k)<0), flags.filter(k=>wrongs.indexOf(k)<0 && due.indexOf(k)<0));
  const rows = keys.map(k=>{
    const qi = +k.split('#')[1], q = effectiveQ(s.id,qi);
    const ui = findUnitByAbs(s, qi), u = ui>=0 ? s.d.u[ui] : null;
    const isW = !!S.wrong[k], isD = due.indexOf(k)>=0;
    const col = isW ? 'var(--red)' : isD ? 'var(--violet)' : '#C9A227';
    return '<button class="rowline" data-preview="'+k+'"><span class="ico2" style="color:'+col+'">'+(isW?'✗':isD?'↻':'★')+'</span>'
      + '<span class="tt"><b>'+rich(String(q[0]).slice(0,140))+'</b><span>'+(u?esc(u[1])+' · ':'')+esc(s.name)+'</span></span>'
      + '<svg class="chev" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></button>';
  }).join('');
  return '<div class="view">'
    + '<div class="subcard" style="margin-top:14px;cursor:default;box-shadow:none;background:var(--card2)">'
      + '<span class="ico" style="background:'+icobg(s)+'">'+s.em+'</span>'
      + '<span class="tt"><b>'+esc(s.name)+'</b><span>'+due.length+' due · '+wrongs.length+' mistakes · '+flags.length+' starred</span></span>'
    + '</div>'
    + '<div class="btns">'
      + (due.length?'<button class="btn gold full" data-sub-srs="'+s.id+'">Revise '+due.length+' due</button>':'')
      + (wrongs.length?'<button class="btn maroon full" data-sub-review="'+s.id+'|wrong">Mistakes</button>':'')
      + (flags.length?'<button class="btn full" data-sub-review="'+s.id+'|flags">Starred</button>':'')
    + '</div>'
    + (rows ? '<div class="list" style="margin-top:14px">'+rows+'</div>' : '<div class="empty">Nothing saved here yet.</div>')
  + '</div>';
}

function heatmapHtml(){
  const weeks = 14, cells = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const dow = (today.getDay()+6)%7;
  const start = new Date(today.getTime() - (dow + (weeks-1)*7)*86400000);
  let total = 0;
  for (let i=0;i<weeks*7;i++){
    const d = new Date(start.getTime()+i*86400000), k = dayKey(d);
    const a = (S.log && S.log[k] && S.log[k].a) || 0; total += a;
    const lvl = a===0?0 : a<10?1 : a<25?2 : a<50?3 : 4;
    cells.push('<i class="'+(lvl?'l'+lvl:'')+(d>today?' hidden':'')+'" title="'+k+' \u00b7 '+a+' questions"></i>');
  }
  const doneDays = Object.keys(S.log||{}).filter(k=>(S.log[k].a||0)>0).length;
  return '<div class="heatwrap"><div class="heat">'+cells.join('')+'</div>'
    + '<div class="heatlegend"><span>'+num(total)+' questions over '+doneDays+' active day'+(doneDays===1?'':'s')+'</span>'
    + '<span style="margin-left:auto">less</span><i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>more</span></div></div>';
}
function accuracyRows(){
  return SUBJECTS.map(s=>{
    const st = (S.subStats||{})[s.id];
    if (!st || !st.a) return null;
    return {s:s, pct: 100*st.c/st.a, a: st.a, c: st.c};
  }).filter(Boolean).sort((x,y)=>x.pct-y.pct);
}

/* ================= FLASHCARDS ================= */
function startCards(keys, title, shuffle){
  const items = [], seen = {};
  (keys||[]).forEach(k=>{
    const p = String(k).split('#'), s = subjectById(p[0]);
    if (!s || !s.d.q[+p[1]]) return;
    const kk = p[0]+'#'+p[1]; if (seen[kk]) return; seen[kk] = 1;
    const ui = findUnitByAbs(s, +p[1]);
    items.push({s:p[0], q:+p[1], u:(ui>=0?ui:null)});
  });
  if (!items.length){ toast('No cards in this set yet'); return; }
  if (shuffle !== false) items.sort(()=>Math.random()-0.5);
  cardRun = {items:items, i:0, flip:false, title:title||'Flashcards'};
  go({v:'cards'});
}
function cardAdvance(){
  if (!cardRun) return;
  if (cardRun.i+1 >= cardRun.items.length){
    toast('Deck complete \u00b7 '+cardRun.items.length+' cards');
    if (nav.length>1){ nav.pop(); cardRun = null; render(); } else { cardRun = null; setTab('review'); render(); }
    return;
  }
  cardRun.i++; cardRun.flip = false; render();
}
function viewCards(){
  if (!cardRun || !cardRun.items.length) return '<div class="view"><div class="empty">No cards in this deck.</div></div>';
  const it = cardRun.items[cardRun.i], s = subjectById(it.s), q = effectiveQ(it.s,it.q);
  const key = qKey(it.s, it.q), note = (S.notes||{})[key];
  const u = (it.u!=null) ? s.d.u[it.u] : null;
  const fl = cardRun.flip;
  return '<div class="view"><div class="fwrap">'
    + editButton(it)
    + '<div class="qmeta"><span>Card '+(cardRun.i+1)+' of '+cardRun.items.length+'</span><span>'+esc(cardRun.title)+'</span></div>'
    + '<div class="qbar"><i style="width:'+(100*(cardRun.i+1)/cardRun.items.length).toFixed(1)+'%"></i></div>'
    + '<div class="fcard'+(fl?' flipped':'')+'" id="fcard">'
      + '<div class="fmeta"><span class="chip">'+esc(s.name)+'</span><span class="chip fmt">'+fmtLabel(q[4])+'</span>'
        + (u ? '<span class="chip">U'+String(u[0]).padStart(2,'0')+'.'+String(u[1]).padStart(2,'0')+'</span>' : '')
        + (S.flags[key] ? '<span class="chip">\u2605</span>' : '')+'</div>'
      + '<div class="fq">'+rich(q[0])+'</div>'
      + (fl
          ? '<div class="ans"><b>Answer</b><p>'+rich(correctAnswerText(q)||'Answer recorded in the book')+'</p>'
            + (q[3] ? '<div class="ansx">'+rich(q[3])+'</div>' : '')
            + (note ? '<div class="usernote"><b>Your note</b>'+esc(note)+'</div>' : '')
          + '</div>'
          : '<div class="hintline">Tap the card to reveal the answer</div>')
    + '</div>'
    + (fl
        ? '<div class="rl" style="text-align:center">How well did you know it? Feeds spaced revision</div>'
          + '<div class="rbtns">'
            + '<button class="rbtn again" data-card-rate="again">Again<small>'+srsNextLabel(key,'again')+'</small></button>'
            + '<button class="rbtn hard" data-card-rate="hard">Hard<small>'+srsNextLabel(key,'hard')+'</small></button>'
            + '<button class="rbtn good" data-card-rate="good">Good<small>'+srsNextLabel(key,'good')+'</small></button>'
            + '<button class="rbtn easy" data-card-rate="easy">Easy<small>'+srsNextLabel(key,'easy')+'</small></button>'
          + '</div>'
          + '<div class="btns"><button class="btn ghost" data-card-nav="-1"'+(cardRun.i===0?' disabled':'')+'>Previous</button>'
          + '<button class="btn ghost" data-card-nav="1">Skip card</button></div>'
        : '<div class="btns"><button class="btn primary full" id="cardFlip">Reveal answer</button>'
          + (cardRun.i>0 ? '<button class="btn ghost" data-card-nav="-1">Previous</button>':'')+'</div>')
    + '</div></div>';
}

/* ================= MOCK TEST TAB ================= */
function viewTest(){
  if (!S.mock) S.mock = {subs:['ALL'], count:50, minutes:30};
  const m = S.mock;
  const history = (S.tests||[]).slice(0,8);
  const best = (S.tests||[]).reduce((a,t)=>Math.max(a, t.acc||0), 0);
  return '<div class="view">'
    + '<div class="banner" style="background:linear-gradient(140deg,var(--accent),var(--ball2))">'
      + '<div class="kick">EXAM MODE</div>'
      + '<h2>Mock test</h2>'
      + '<p>'+(m.count)+' questions'+(m.minutes?' \u00b7 '+m.minutes+' minute timer':' \u00b7 untimed')+' \u00b7 no hints until the end</p>'
    + '</div>'
    + '<div class="lbl" style="font-size:10px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:var(--mut);margin:20px 0 0">Subjects</div>'
    + '<div class="pickchips">'
      + '<button class="pick'+((m.subs||[]).indexOf('ALL')>=0?' on':'')+'" data-pick-sub="ALL">All subjects</button>'
      + SUBJECTS.map(s=>'<button class="pick'+((m.subs||[]).indexOf(s.id)>=0?' on':'')+'" data-pick-sub="'+s.id+'">'+s.em+' '+esc(s.name)+'</button>').join('')
    + '</div>'
    + '<div class="lbl" style="font-size:10px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:var(--mut);margin:18px 0 0">Questions</div>'
    + '<div class="seg">'+[25,50,100,150].map(n=>'<button class="'+(m.count===n?'on':'')+'" data-mock-count="'+n+'">'+n+'</button>').join('')+'</div>'
    + '<div class="lbl" style="font-size:10px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:var(--mut);margin:18px 0 0">Timer</div>'
    + '<div class="seg">'+[[0,'No timer'],[15,'15 min'],[30,'30 min'],[60,'60 min']].map(x=>
        '<button class="'+(m.minutes===x[0]?'on':'')+'" data-mock-mins="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'
    + '<div class="btns"><button class="btn accent full" data-mock-start="1">Start mock test \u00b7 '+m.count+' questions</button></div>'
    + '<div class="note">Exam mode runs like the real thing: answers are locked in without feedback and the explanation for every question, plus a subject-wise breakdown, appears when you submit or the timer runs out. Retry questions still feed your spaced revision schedule.</div>'
    + (history.length ? '<div class="sechead"><i style="background:var(--a1)"></i><h2>Past tests</h2><em>best '+best+'%</em></div>'
      + '<div class="list">'+history.map(t=>{
          const d = new Date(t.ts);
          const col = t.acc>=70?'var(--green)':t.acc>=45?'var(--olive)':'var(--red)';
          return '<div class="hist"><span class="sc" style="color:'+col+'">'+t.acc+'%</span>'
            + '<span class="d"><b>'+t.correct+' / '+t.total+' correct</b>'
            + '<span>'+d.getDate()+' '+d.toLocaleString('en',{month:'short'})+' \u00b7 '+t.mins+' min \u00b7 '+Object.keys(t.per||{}).length+' subject'+(Object.keys(t.per||{}).length===1?'':'s')+'</span></span>'
            + '</div>';
        }).join('')+'</div>' : '')
  + '</div>';
}

/* ================= SEARCH ================= */
function viewSearch(q){
  q = (q||'').trim();
  let units=[], qs=[], chs=[], nts=[];
  if (q.length>1){
    const Q = q.toLowerCase();
    SUBJECTS.forEach(s=>{
      s.d.c.forEach((c,i)=>{ if(c[1].toLowerCase().indexOf(Q)>=0) chs.push({s,i,c}); });
      s.d.u.forEach((u,i)=>{ if(u[2].toLowerCase().indexOf(Q)>=0) units.push({s,i,u}); });
      s.d.q.forEach((x,qi)=>{ if(qs.length<200 && String(effectiveQ(s.id,qi)[0]).toLowerCase().indexOf(Q)>=0) qs.push({s,qi}); });
    });
    Object.keys(S.notes||{}).forEach(k=>{ if(nts.length<40 && String(S.notes[k]).toLowerCase().indexOf(Q)>=0) nts.push(k); });
  }
  const CAP = 50;
  let html = '<div class="view">'
    + '<div class="searchbox">'
      + '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#AEA59A" stroke-width="2.3" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.7-3.7"/></svg>'
      + '<input id="sq" value="'+esc(q)+'" placeholder="Chapter, unit or question text…" autocomplete="off">'
      + (q?'<button class="x" id="sqx">×</button>':'')
    + '</div>';
  if (q.length<=1) html += '<div class="empty">Search all '+num(totUnits())+' units and '+num(totQs())+' questions.<br>Try “hyperkalemia”, “aortic stenosis”, “thrombolysis”.</div>';
  else if (!units.length && !qs.length && !chs.length && !nts.length) html += '<div class="empty">No match for “'+esc(q)+'”.</div>';
  else {
    html += '<div style="font-family:var(--mono);font-size:10.5px;color:var(--dim);margin-top:14px">'
      + units.length+' units · '+chs.length+' chapters · '+qs.length+' questions'+(nts.length?' · '+nts.length+' notes':'')+'</div>';
    if (nts.length) html += '<div class="sechead"><i style="background:var(--violet)"></i><h2>Your notes</h2><em>'+nts.length+'</em></div><div class="list">'
      + nts.map(k=>{ const L = noteLabel(k);
          return '<div class="noterow" data-note-open="'+k+'"><span class="nt"><span class="lab">'+esc(L.s?L.s.name:'Note')+(L.u?' \u00b7 '+esc(String(L.u[2])):'')+'</span>'
            + '<p>'+mark(S.notes[k], q)+'</p></span></div>'; }).join('')+'</div>';
    if (chs.length) html += '<div class="sechead"><i></i><h2>Chapters</h2><em>'+chs.length+'</em></div><div class="list">'
      + chs.slice(0,CAP).map(r=>'<button class="chrow" data-sub="'+r.s.id+'" data-ch="'+r.i+'">'
        + '<span class="numball" style="width:38px;height:38px;flex-basis:38px;font-size:16px">'+r.c[0]+'</span>'
        + '<span class="tt"><b>'+mark(r.c[1],q)+'</b><span>'+esc(r.s.name)+'</span></span>'
        + '<svg class="chev" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></button>').join('')+'</div>';
    if (units.length) html += '<div class="sechead"><i style="background:var(--green)"></i><h2>Units</h2><em>'+units.length+'</em></div><div class="list">'
      + units.slice(0,CAP).map(r=>'<button class="rowline" data-unit-sub="'+r.s.id+'" data-unit="'+r.i+'">'
        + '<span class="ico2">'+r.s.em+'</span>'
        + '<span class="tt"><b>'+mark(r.u[2],q)+'</b><span>'+esc(r.s.name)+' · '+r.u[6]+' questions</span></span>'
        + '<svg class="chev" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></button>').join('')+'</div>'
      + (units.length>CAP?'<div class="empty">+ '+(units.length-CAP)+' more — refine your search</div>':'');
    if (qs.length) html += '<div class="sechead"><i style="background:var(--violet)"></i><h2>Questions</h2><em>'+qs.length+'</em></div><div class="list">'
      + qs.slice(0,CAP).map(r=>{
        const ui = findUnitByAbs(r.s, r.qi), u = ui>=0?r.s.d.u[ui]:null;
        return '<button class="rowline" data-preview="'+r.s.id+'#'+r.qi+'">'
        + '<span class="ico2" style="color:'+r.s.acc+'">'+r.s.em+'</span>'
        + '<span class="tt"><b>'+mark(String(effectiveQ(r.s.id,r.qi)[0]).slice(0,170),q)+'</b><span>'+(u?esc(u[1])+' · ':'')+esc(r.s.name)+'</span></span>'
        + '<svg class="chev" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></button>';
      }).join('')+'</div>';
  }
  return html + '</div>';
}

/* ================= SETTINGS SHEET ================= */
function settingsSheet(){
  const p = prefs(), A = ACCENTS[p.accent] || ACCENTS.maroon;
  const done = Object.keys(S.done).length;
  return '<div class="sheet" id="sheetMask"><div class="inner" id="sheetInner">'
    + '<h3>Settings</h3>'
    + '<p style="margin:0;color:var(--mut);font-size:12.5px">'+num(totUnits())+' units \u00b7 '+num(totQs())+' questions \u00b7 '+done+' mastered \u00b7 '+num(S.xp)+' XP</p>'

    + '<div class="lbl">Appearance</div>'
    + '<div class="seg">'+[['light','Light'],['dark','Dark'],['auto','Auto']].map(x=>
        '<button class="'+(p.theme===x[0]?'on':'')+'" data-set-theme="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'

    + '<div class="lbl">Theme colour</div>'
    + '<div class="swatches">'+Object.keys(ACCENTS).map(k=>{
        const a = ACCENTS[k];
        return '<button class="swatch'+(p.accent===k?' on':'')+'" data-set-accent="'+k+'" title="'+a.name+'"'
          + ' style="background:linear-gradient(140deg,'+a.a1+','+a.accent+')"><span>\u2713</span></button>';
      }).join('')+'</div>'

    + '<div class="lbl">Text size</div>'
    + '<div class="seg">'+[[1,'Small'],[2,'Default'],[3,'Large'],[4,'X-Large']].map(x=>
        '<button class="'+((p.fs||2)===x[0]?'on':'')+'" data-set-fs="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'

    + '<div class="lbl">Daily goal</div>'
    + '<div class="seg">'+[25,50,100,200].map(n=>
        '<button class="'+((p.goal||50)===n?'on':'')+'" data-set-goal="'+n+'">'+n+' Q</button>').join('')+'</div>'

    + '<div class="lbl">Feedback</div>'
    + '<div class="seg"><button class="'+(p.haptics?'on':'')+'" data-haptics="1">Vibration '+(p.haptics?'on':'off')+'</button></div>'

    + '<div class="lbl">Data</div>'
    + '<div class="btns" style="margin-top:0">'
      + '<button class="btn full" data-export="1">Download progress backup</button>'
      + '<button class="btn full" data-import-file="1">Restore from backup</button>'
      + (window.PulseAndroid ? '' : '<button class="btn full" data-import="1">Import old modules</button>')
      + '<button class="btn full" data-unlock="1">'+(S.unlockAll?'Lock units sequentially again':'Unlock every unit')+'</button>'
      + '<button class="btn ghost full" data-reset="1" style="color:var(--red)">Reset all progress</button>'
      + '<button class="btn accent full" data-close-sheet="1">Done</button>'
    + '</div>'
    + '<input type="file" id="fileIn" accept="application/json,.json" class="hidden">'
    + '<div class="note" style="margin-top:16px">'+(window.PulseAndroid
      ? 'Everything is stored on your phone. Back up to a JSON file before uninstalling, clearing app data, or changing phones. No account or internet needed.'
      : 'Everything lives in this one file on this device \u2014 no account, no upload. Keep the backup file safe to move progress between phones.')+'</div>'
  + '</div></div>';
}
function exportProgress(){
  try{
    if (window.PulseAndroid && window.PulseAndroid.exportProgress){
      window.PulseAndroid.exportProgress(JSON.stringify(S), 'pulse-mbbs-progress-'+dayKey()+'.json');
      return;
    }
    const blob = new Blob([JSON.stringify(S)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pulse-mbbs-progress-'+dayKey()+'.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
    toast('Backup downloaded');
  }catch(e){ toast('Download not supported here'); }
}
function importProgressJson(json){
    if(editDraft)closeQuestionEditor(true);
    try{
      const o = JSON.parse(json);
      if (!o || typeof o !== 'object' || !o.done || typeof o.done!=='object' || Array.isArray(o.done)
          || !o.wrong || typeof o.wrong!=='object' || Array.isArray(o.wrong)
          || !o.srs || typeof o.srs!=='object' || Array.isArray(o.srs)
          || typeof o.xp!=='number') throw new Error('bad');
      S = Object.assign({}, DEFAULT, o, {done:o.done||{}, wrong:o.wrong||{}, flags:o.flags||{}, srs:o.srs||{},
        log:o.log||{}, subStats:o.subStats||{}, tests:o.tests||[], notes:o.notes||{}, edits:cleanEdits(o.edits), unitStats:o.unitStats||{},
        time:o.time||{}, pace:o.pace||{n:0,ms:0},
        prefs:Object.assign({}, DEFAULT.prefs, o.prefs||{})});
      run=null; save(); applyPrefs(); sheetOpen = false; tab='subjects';
      if(!restoreActive()) nav=[{v:'home'}];
      render();
      toast('Progress restored');
    }catch(e){ toast('That file is not a PULSE backup'); }
}
function importProgressFile(file){
  const fr = new FileReader();
  fr.onload = () => importProgressJson(fr.result);
  fr.onerror = () => toast('Could not open that backup file');
  fr.readAsText(file);
}
// The Android package uses a system document picker, not a WebView file input.
window.PulseNativeImport = importProgressJson;
window.PulseNativeBack = function(){
  if(editDraft){closeQuestionEditor(false);return true;}
  if(sheetOpen){ sheetOpen=false; render(); return true; }
  if(noteOpen){ noteOpen=false; render(); return true; }
  if(nav.length>1){ back(); return true; }
  return false;
};

/* ================= IMPORT ================= */
function importLegacy(){
  let n = 0, skipped = [];
  SUBJECTS.forEach(s=>{
    const L = s.legacy; if(!L) return;
    try{
      if (L.stratum){
        const raw = localStorage.getItem('derm-app-state'); if(!raw) return;
        const st = JSON.parse(raw), stars = st.unitStars||{};
        s.d.u.forEach(u=>{ const cnum = s.d.c[u[0]][0];
          if (stars['ch'+cnum+'::'+u[1]] !== undefined && !S.done[uArr(s,u)]){
            S.done[uArr(s,u)] = {r:u[6], t:u[6], ts:Date.now(), imported:true}; n++; } });
        return;
      }
      if (L.skip){ skipped.push(s.name); return; }
      const raw = localStorage.getItem(L.key); if(!raw) return;
      const arr = JSON.parse(raw); if(!Array.isArray(arr)) return;
      const byId = {}; s.d.u.forEach((u,i)=>{ byId[u[1]] = i; });
      arr.forEach(id=>{
        if (typeof id!=='string' || id.indexOf(L.pre)!==0) return;
        const i = byId[id]; if (i==null) return;
        const u = s.d.u[i];
        if (!S.done[uArr(s,u)]){ S.done[uArr(s,u)] = {r:u[6], t:u[6], ts:Date.now(), imported:true}; n++; }
      });
    }catch(e){}
  });
  S.xp = (S.xp||0) + n*10; save();
  toast(n ? 'Imported '+n+' completed units (+'+n*10+' XP)' : 'No progress found in the old modules');
  if (skipped.length) setTimeout(()=>toast(skipped.join(', ')+' shares its storage key with Volume 2'), 2400);
  render();
}

/* ================= EVENTS ================= */
function previewKey(k){
  const p = k.split('#'), s = subjectById(p[0]);
  const it = {s:p[0], q:+p[1], u:null}; const ui = findUnitByAbs(s, +p[1]); if(ui>=0) it.u = ui;
  buildRun([it], 'Quick look', {s:p[0], i:(ui>=0?ui:null), mode:'drill'});
  go({v:'quiz'});
}
document.addEventListener('click', e=>{
  const t = e.target, v = cur();
  if (t.closest('nav.tabs')) return;
  const eq=t.closest('[data-edit-question]');
  if(eq){
    if(run && run.mode==='test' && !run.done && !confirm('Editing reveals the answer key. Continue editing this mock-test question?'))return;
    openQuestionEditor(eq.dataset.editQuestion);return;
  }
  if (t.closest('[data-gear]')){ sheetOpen = true; render(); return; }
  if (t.closest('[data-theme-toggle]')){
    const d = isDark(); setPref('theme', d ? 'light' : 'dark');
    toast(d ? 'Light theme' : 'Dark theme'); return;
  }
  const st2 = t.closest('[data-set-theme]'); if (st2){ setPref('theme', st2.dataset.setTheme); return; }
  const sa = t.closest('[data-set-accent]'); if (sa){ setPref('accent', sa.dataset.setAccent); return; }
  const sf = t.closest('[data-set-fs]'); if (sf){ setPref('fs', +sf.dataset.setFs); return; }
  const sg = t.closest('[data-set-goal]'); if (sg){ setPref('goal', +sg.dataset.setGoal); return; }
  if (t.closest('[data-haptics]')){ setPref('haptics', !prefs().haptics); return; }
  if (t.closest('[data-export]')){ exportProgress(); return; }
  if (t.closest('[data-import-file]')){
    if (window.PulseAndroid && window.PulseAndroid.pickProgressFile){ window.PulseAndroid.pickProgressFile(); }
    else { const fi = document.getElementById('fileIn'); if (fi) fi.click(); }
    return;
  }
  if (t.closest('[data-mock-start]')){ startMock(); return; }
  const ps = t.closest('[data-pick-sub]'); if (ps){ toggleMockSub(ps.dataset.pickSub); return; }
  const mc = t.closest('[data-mock-count]'); if (mc){ S.mock.count = +mc.dataset.mockCount; save(); render(); return; }
  const mm2 = t.closest('[data-mock-mins]'); if (mm2){ S.mock.minutes = +mm2.dataset.mockMins; save(); render(); return; }
  if (t.closest('#submitTest')){ collectResults(); return; }
  if (t.closest('#focusTool')){ focusToggle(); render(); return; }
  if (t.closest('[data-qotd]')){ const qd = qotdKey(); previewKey(qKey(qd.sid, qd.qi)); return; }
  const cd = t.closest('[data-cards]');
  if (cd){
    const m = cd.dataset.cards;
    const keys = m==='wrong' ? Object.keys(S.wrong) : m==='flags' ? Object.keys(S.flags) : dueKeys();
    startCards(keys, m==='wrong' ? 'Cards from mistakes' : m==='flags' ? 'Cards from starred' : 'Cards due now');
    return;
  }
  const cu = t.closest('[data-cards-unit]');
  if (cu){ const s = subjectById(v.s), i = +cu.dataset.cardsUnit, u = s.d.u[i], keys = [];
    for(let k=u[5];k<u[5]+u[6];k++) keys.push(qKey(s.id,k));
    startCards(keys, u[2], true); return; }
  const wk = t.closest('[data-weak]');
  if (wk){ const r = resolveUnitKey(wk.dataset.weak);
    if (r){ const keys = []; for(let k=r.u[5];k<r.u[5]+r.u[6];k++) keys.push(qKey(r.s.id,k));
      keys.sort(()=>Math.random()-0.5);
      startDrill(r.s, 0, 'weak', keys.slice(0, Math.min(15, keys.length))); }
    return; }
  const nd = t.closest('[data-note-del]');
  if (nd){ const k = nd.dataset.noteDel; delete S.notes[k]; save(); render(); toast('Note deleted'); return; }
  const no = t.closest('[data-note-open]'); if (no){ previewKey(no.dataset.noteOpen); return; }
  if (t.closest('#noteBtn')){ noteOpen = !noteOpen; render(); return; }
  if (t.closest('#noteSave')){
    const ta = document.getElementById('noteTa'), it = run.items[run.idx], k = qKey(it.s, it.q);
    const val = (ta ? ta.value : '').trim();
    S.notes = S.notes || {};
    if (val) S.notes[k] = val; else delete S.notes[k];
    save(); noteOpen = false; render(); toast(val ? 'Note saved' : 'Note cleared'); return;
  }
  if (t.closest('#noteDel')){
    const it = run.items[run.idx]; delete S.notes[qKey(it.s,it.q)];
    save(); noteOpen = false; render(); toast('Note deleted'); return;
  }
  if (t.closest('#cardFlip') || t.closest('#fcard')){
    if (cardRun && !cardRun.flip){ cardRun.flip = true; haptic(6); render(); }
    return;
  }
  const cr = t.closest('[data-card-rate]');
  if (cr && cardRun){
    const it = cardRun.items[cardRun.i], k = qKey(it.s, it.q), grade = cr.dataset.cardRate;
    const next = srsNextLabel(k, grade);
    srsRate(k, grade);
    if (grade==='again') S.wrong[k] = 1; else delete S.wrong[k];
    save(); toast('Next review in '+next); cardAdvance(); return;
  }
  const cn = t.closest('[data-card-nav]');
  if (cn && cardRun){
    if (cn.dataset.cardNav === '-1'){ cardRun.i = Math.max(0, cardRun.i-1); cardRun.flip = false; }
    else cardAdvance();
    return;
  }
  if (t.closest('[data-close-sheet]')){ sheetOpen = false; render(); return; }
  if (t.id==='sheetMask'){ sheetOpen = false; render(); return; }
  if (t.closest('[data-import]')){ importLegacy(); return; }
  if (t.closest('[data-unlock]')){ S.unlockAll = !S.unlockAll; save(); render(); toast(S.unlockAll?'All units unlocked':'Sequential locking restored'); return; }
  if (t.closest('[data-reset]')){
    if (confirm('Erase all progress, XP, mistakes and revision schedules?')){
      S = JSON.parse(JSON.stringify(DEFAULT)); save(); applyPrefs(); sheetOpen=false; nav=[{v:'home'}]; tab='subjects'; render();
    }
    return;
  }
  if (t.closest('#fillCheck')){ answerFill(); return; }
  if (t.closest('#matchCheck')){ answerMatch(); return; }
  const mslot = t.closest('[data-mslot]');
  if (mslot && run && !run.log[run.idx]){
    const i = +mslot.dataset.mslot, q = itemQ(run.items[run.idx]), st = matchState(q);
    if (st[i]!=null){ st[i]=null; run.msel=i; } else { run.msel = (run.msel===i ? null : i); }
    render(); return;
  }
  const mchip = t.closest('[data-mchip]');
  if (mchip && run && !run.log[run.idx]){
    const j = +mchip.dataset.mchip, q = itemQ(run.items[run.idx]), st = matchState(q);
    let slot = (run.msel!=null) ? run.msel : st.indexOf(null);
    if (slot==null || slot<0){ toast('Tap an item on the left first'); return; }
    for (let k=0;k<st.length;k++) if (st[k]===j) st[k]=null;
    st[slot] = j;
    const nx = st.indexOf(null); run.msel = nx<0 ? null : nx;
    render(); return;
  }
  const opt = t.closest('[data-opt]'); if (opt && run){ answer(+opt.dataset.opt); return; }
  const rat = t.closest('[data-rate]'); if (rat && run){ rate(rat.dataset.rate); return; }
  if (t.closest('#nextQ')){ nextQ(); return; }
  if (t.closest('#skipQ')){ skipQ(); return; }
  if (t.closest('#flagBtn')){
    const it = run.items[run.idx], k = qKey(it.s,it.q);
    if (S.flags[k]) delete S.flags[k]; else S.flags[k] = 1;
    save(); render(); return;
  }
  const rev = t.closest('[data-rev]'); if (rev){ rev.closest('.rev').classList.toggle('open'); return; }
  const prev = t.closest('[data-preview]'); if (prev){ previewKey(prev.dataset.preview); return; }
  if (t.closest('[data-srs-drill]')){ startDrill(null, 0, 'srs', dueKeys()); return; }
  if (t.closest('[data-srs-all]')){ startDrill(null, 0, 'srs', Object.keys(S.srs)); return; }
  const sr = t.closest('[data-review]'); if (sr){
    const m = sr.dataset.review;
    const keys = m==='wrong' ? Object.keys(S.wrong) : m==='flags' ? Object.keys(S.flags)
      : Object.keys(S.wrong).concat(Object.keys(S.flags)).filter((x,i,a)=>a.indexOf(x)===i);
    startDrill(null, 0, m, keys); return;
  }
  const ss = t.closest('[data-sub-srs]'); if (ss){ const id=ss.dataset.subSrs; startDrill(subjectById(id),0,'srs',dueKeys().filter(k=>k.indexOf(id+'#')===0)); return; }
  const srv = t.closest('[data-sub-review]');
  if (srv){ const p = srv.dataset.subReview.split('|'), id=p[0], m=p[1];
    const keys = Object.keys(m==='wrong'?S.wrong:S.flags).filter(k=>k.indexOf(id+'#')===0);
    startDrill(subjectById(id),0,m,keys); return; }
  const rsv = t.closest('[data-revsub]'); if (rsv){ go({v:'revsub', s:rsv.dataset.revsub}); return; }
  const st = t.closest('[data-start]');
  if (st){ const sid = (v.v==='results' && run) ? run.s : v.s; startUnit(subjectById(sid), +st.dataset.start, false); return; }
  const str = t.closest('[data-start-rnd]');
  if (str){ const sid = (v.v==='results' && run) ? run.s : v.s; startUnit(subjectById(sid), +str.dataset.startRnd, true); return; }
  const pfl = t.closest('[data-practice-flags]');
  if (pfl){ const s = subjectById(v.s), u = s.d.u[+pfl.dataset.practiceFlags], keys=[];
    for(let k=u[5];k<u[5]+u[6];k++){ if(S.flags[s.id+'#'+k]) keys.push(s.id+'#'+k); }
    startDrill(s,0,'flags',keys); return; }
  const dr = t.closest('[data-drill]'); if (dr){ startDrill(subjectById(dr.dataset.drill), 25, 'drill'); return; }
  const rs = t.closest('[data-resume]');
  if (rs){ const s = subjectById(v.s), i = nextUnitIdx(s); if(i>=0) go({v:'guide', s:s.id, i:i}); return; }
  if (t.closest('[data-resume-quiz]')){ if(run && !run.done) go({v:'quiz'}); return; }
  if (t.closest('[data-continue]') && S.last){ go({v:'guide', s:S.last.s, i:S.last.i}); return; }
  if (t.closest('[data-open-chapters]')){ go({v:'chapters', s:t.closest('[data-open-chapters]').dataset.openChapters}); return; }
  if (t.closest('[data-tab-home]')){ setTab('subjects'); return; }
  const un = t.closest('[data-unit]');
  if (un && !un.disabled){
    const idx = +un.dataset.unit;
    const sid = un.dataset.unitSub || (v.v==='results' && run ? run.s : v.s);
    const s = subjectById(sid);
    if (s && unlocked(s, idx)) go({v:'guide', s:s.id, i:idx});
    else if (s) toast('Locked \u2014 finish the previous unit first');
    return;
  }
  const ch = t.closest('[data-ch]');
  if (ch){
    const host = t.closest('[data-sub]');
    const sid = host ? host.dataset.sub : v.s;
    go({v:'chapter', s:sid, c:+ch.dataset.ch}); return;
  }
  const fm = t.closest('[data-fam]');
  if (fm){ go({v:'vols', fam:fm.dataset.fam}); return; }
  const sub = t.closest('[data-sub]'); if (sub){ go({v:'chapters', s:sub.dataset.sub}); return; }
});
function toggleMockSub(id){
  if (!S.mock) S.mock = {subs:['ALL'], count:50, minutes:30};
  let subs = S.mock.subs || ['ALL'];
  if (id==='ALL') subs = ['ALL'];
  else {
    subs = subs.filter(x=>x!=='ALL');
    subs = subs.indexOf(id)>=0 ? subs.filter(x=>x!==id) : subs.concat(id);
    if (!subs.length) subs = ['ALL'];
  }
  S.mock.subs = subs; save(); render();
}
document.addEventListener('change', e=>{
  if (e.target && e.target.id==='fileIn' && e.target.files && e.target.files[0]) importProgressFile(e.target.files[0]);
});
tabsEl.addEventListener('click', e=>{
  const tb = e.target.closest('.tab'); if(tb) setTab(tb.dataset.tab);
});
addEventListener('keydown', e=>{
  if(editDraft){if(e.key==='Escape'){e.preventDefault();closeQuestionEditor(false);}return;}
  if (cur().v==='cards' && cardRun){
    if (e.key===' ' || e.key==='Enter'){
      e.preventDefault();
      if (!cardRun.flip){ cardRun.flip=true; render(); } else cardAdvance();
    } else if (e.key==='ArrowRight' && cardRun.flip){ e.preventDefault(); cardAdvance(); }
    else if (e.key==='ArrowLeft' && cardRun.i>0){ e.preventDefault(); cardRun.i--; cardRun.flip=false; render(); }
    return;
  }
  if (run && cur().v==='quiz'){
    if (e.target && e.target.id==='fillBox' && e.key==='Enter'){ e.preventDefault(); answerFill(); return; }
    if (document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
    const it = run.items[run.idx], q = itemQ(it), answered = run.log[run.idx];
    if (!answered){
      let i = -1; const k = String(e.key).toUpperCase();
      if (k.length===1 && k>='A' && k<='Z') i = k.charCodeAt(0)-65;
      if (e.key>='1' && e.key<='9') i = +e.key-1;
      if (i>=0 && i<q[1].length){ e.preventDefault(); answer(i); }
    } else if (e.key==='Enter'){ e.preventDefault(); nextQ(); }
    else if (run.mode!=='test' && e.key>='1' && e.key<='4'){
      e.preventDefault(); rate(['again','hard','good','easy'][+e.key-1]); }
    return;
  }
  if (e.key==='Escape'){ if (sheetOpen){ sheetOpen=false; render(); } else back(); }
});
let tmr=null;
document.addEventListener('input', e=>{
  if (e.target.id==='fillBox'){ if (run) run.draft = e.target.value; return; }
  if (e.target.id!=='sq') return;
  const val = e.target.value;
  clearTimeout(tmr);
  tmr = setTimeout(()=>{
    go({v:'search', q:val}, true);
    const el = document.getElementById('sq');
    if (el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, 200);
});
document.addEventListener('click', e=>{ if (e.target.id==='sqx'){ go({v:'search', q:''}); } }, true);
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-tab]');
  if (el && !el.closest('nav.tabs')) setTab(el.dataset.tab);
});

applyPrefs();
const __resumed = restoreActive();
window.__pulse = { get run(){return run;}, ACCENTS, applyPrefs, get prefs(){return prefs();}, setPref, heatmapHtml, get S(){return S;}, get nav(){return nav;}, set nav(v){nav=v;},
  BANK, SUBJECTS, startUnit, startDrill, dueKeys, render,
  richKind, isRichQ, fillMatches, matchFilled, matchCorrect, matchKey, correctAnswerText, chosenAnswerText, qMeta,
  get tab(){return tab;}, setTab };

render();
if(__resumed) toast('Quiz resumed where you left off');
setTimeout(()=>{ const b=document.getElementById('boot'); if(b){ b.classList.add('gone'); setTimeout(()=>b.remove(),350); } }, 140);
