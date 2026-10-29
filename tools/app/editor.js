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
