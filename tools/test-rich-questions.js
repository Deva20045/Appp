/* Regression: fill-in-the-blank and matching questions.
 *
 * The Pharm source packs 464 fill and 90 match questions whose answer key the
 * flat bank tuple could not hold (opts was [], ans was null / a list). They used
 * to render a stem with zero answer controls. This suite proves:
 *   - every rich question has a valid payload (all 554, structurally)
 *   - fill answers are graded with the book's normalisation + aliases
 *   - matching is played, checked, scored and revealed
 *   - results / flashcards show real answer text, never "undefined"
 *   - MCQ questions are untouched
 */
const {PW_PATH,HTML,launchOptions}=require('./test-env');
const {chromium}=require(PW_PATH);
const assert=require('assert');

const SUB='pharm';

(async()=>{
  const b=await chromium.launch(launchOptions());
  const errors=[];
  const p=await b.newPage({viewport:{width:393,height:851},isMobile:true,hasTouch:true});
  p.on('pageerror',e=>errors.push(e.message));
  p.on('dialog',d=>d.accept());
  await p.goto(HTML);
  await p.waitForTimeout(700);

  // ---- 1. structural audit of every rich question in the bank -------------
  const audit=await p.evaluate((sub)=>{
    const P=window.__pulse, q=P.SUBJECTS.find(s=>s.id===sub).d.q;
    const rich=[], bad=[];
    q.forEach((row,i)=>{
      const kind=P.richKind(row);
      if(!kind) return;
      const m=P.qMeta(row)||{};
      rich.push({i,kind});
      if(kind==='fill'){
        if(typeof m.blank!=='string'||!m.blank.trim()) bad.push([i,'blank']);
        if(m.aliases && !Array.isArray(m.aliases)) bad.push([i,'aliases']);
      } else {
        if(!Array.isArray(m.left)||!Array.isArray(m.right)) bad.push([i,'pairs']);
        else if(m.left.length!==m.right.length||m.left.length<2) bad.push([i,'length']);
        if(!Array.isArray(m.key)||m.key.length!==m.left.length) bad.push([i,'key']);
        else if(JSON.stringify(m.key.slice().sort((a,b)=>a-b))!==JSON.stringify(m.left.map((_,x)=>x))) bad.push([i,'key-not-permutation']);
      }
    });
    const kinds={}; rich.forEach(r=>kinds[r.kind]=(kinds[r.kind]||0)+1);
    return {total:q.length,rich:rich.length,kinds,bad:bad.slice(0,5),badCount:bad.length,
            emptyOptsWithoutKind:q.filter(r=>Array.isArray(r[1])&&r[1].length===0&&!P.richKind(r)).length};
  },SUB);
  console.log('audit',JSON.stringify(audit));
  assert.equal(audit.kinds.fill,464,'464 fill questions');
  assert.equal(audit.kinds.match,90,'90 match questions');
  assert.equal(audit.badCount,0,'every rich question has a valid key');
  assert.equal(audit.emptyOptsWithoutKind,0,'no question left with empty options and no kind');
  console.log('PASS rich payloads valid ('+audit.rich+' questions)');

  // ---- 2. grading logic, in-page ------------------------------------------
  const logic=await p.evaluate((sub)=>{
    const P=window.__pulse, q=P.SUBJECTS.find(s=>s.id===sub).d.q;
    let fill=null, match=null, mcaq=null;
    q.forEach(row=>{const k=P.richKind(row);
      if(k==='fill'&&!fill) fill=row; if(k==='match'&&!match) match=row;
      if(!k&&Array.isArray(row[1])&&row[1].length>=2&&!mcaq) mcaq=row;});
    const fb=P.qMeta(fill).blank;
    const mk=P.matchCorrect;
    return {
      fillBlank:fb,
      exact:P.fillMatches(fill,fb),
      caseSpace:P.fillMatches(fill,'  '+fb.toUpperCase()+' '),
      punct:P.fillMatches(fill,fb+'.'),
      wrong:P.fillMatches(fill,'definitely-not-the-answer'),
      empty:P.fillMatches(fill,''),
      correctMatch:mk(match,P.matchKey(match)),
      swapped:(()=>{const k=P.matchKey(match).slice();const t=k[0];k[0]=k[1];k[1]=t;return mk(match,k);})(),
      partial:mk(match,[null,null,null,null]),
      mcqOpts:mcaq[1].length, mcqCorrect:mcaq[1][mcaq[2]]
    };
  },SUB);
  console.log('logic',JSON.stringify(logic));
  assert(logic.exact,'exact fill answer accepted');
  assert(logic.caseSpace,'fill answer ignores case and surrounding space');
  assert(logic.punct,'fill answer ignores trailing punctuation');
  assert(!logic.wrong,'wrong fill answer rejected');
  assert(!logic.empty,'empty fill answer rejected');
  assert(logic.correctMatch,'correct mapping accepted');
  assert(!logic.swapped,'swapped mapping rejected');
  assert(!logic.partial,'incomplete mapping rejected');
  console.log('PASS grading logic');

  // ---- 3. fill question end to end ---------------------------------------
  const idx=await p.evaluate((sub)=>{
    const P=window.__pulse, q=P.SUBJECTS.find(s=>s.id===sub).d.q;
    for(let i=0;i<q.length;i++) if(P.richKind(q[i])==='fill') return i;
    return -1;
  },SUB);
  assert(idx>=0,'found a fill question');
  await p.evaluate(([sub,i])=>window.__pulse.startDrill(null,0,'drill',[sub+'#'+i]),[SUB,idx]);
  await p.waitForTimeout(350);
  assert.equal(await p.locator('[data-opt]').count(),0,'no MCQ buttons on a fill question');
  assert.equal(await p.locator('#fillBox').count(),1,'fill input rendered');
  assert.equal(await p.locator('#fillCheck').count(),1,'check button rendered');
  assert((await p.textContent('.chip.fmt')).includes('Fill'),'format chip says Fill up');

  // wrong answer first
  await p.fill('#fillBox','not the answer');
  await p.click('#fillCheck');
  await p.waitForTimeout(250);
  let st=await p.evaluate(()=>{const r=window.__pulse.run;return {answered:r.answered,ok:r.log[0].ok,chosen:r.log[0].chosen};});
  assert.equal(st.answered,1,'answered'); assert.equal(st.ok,false,'wrong answer marked incorrect');
  assert.equal(st.chosen,'not the answer','answer stored');
  assert(await p.isVisible('.fillfb.no'),'wrong feedback shown');
  assert((await p.textContent('.exp')).includes('Answer'),'explanation reveals the answer');
  console.log('PASS fill wrong answer');

  // next question: the same question again, answered correctly
  await p.evaluate(([sub,i])=>window.__pulse.startDrill(null,0,'drill',[sub+'#'+i]),[SUB,idx]);
  await p.waitForTimeout(350);
  const blank=await p.evaluate(([sub,i])=>window.__pulse.qMeta(window.__pulse.SUBJECTS.find(s=>s.id===sub).d.q[i]).blank,[SUB,idx]);
  await p.fill('#fillBox','  '+blank.toUpperCase()+' ');
  await p.click('#fillCheck');
  await p.waitForTimeout(250);
  st=await p.evaluate(()=>{const r=window.__pulse.run;return {ok:r.log[0].ok,correct:r.correct};});
  assert.equal(st.ok,true,'correct fill answer accepted');
  assert.equal(st.correct,1,'score counted');
  assert(await p.isVisible('.fillfb.ok'),'correct feedback shown');
  console.log('PASS fill correct answer');

  // ---- 4. match question end to end --------------------------------------
  const midx=await p.evaluate((sub)=>{
    const P=window.__pulse, q=P.SUBJECTS.find(s=>s.id===sub).d.q;
    for(let i=0;i<q.length;i++) if(P.richKind(q[i])==='match') return i;
    return -1;
  },SUB);
  assert(midx>=0,'found a match question');
  await p.evaluate(([sub,i])=>window.__pulse.startDrill(null,0,'drill',[sub+'#'+i]),[SUB,midx]);
  await p.waitForTimeout(350);
  const shape=await p.evaluate(([sub,i])=>{
    const q=window.__pulse.SUBJECTS.find(s=>s.id===sub).d.q[i];
    return {n:window.__pulse.qMeta(q).left.length, key:window.__pulse.matchKey(q)};
  },[SUB,midx]);
  assert.equal(await p.locator('[data-mslot]').count(),shape.n,'one slot per left item');
  assert.equal(await p.locator('[data-mchip]').count(),shape.n,'one chip per right item');
  assert(await p.locator('#matchCheck').isDisabled(),'check disabled before completion');
  assert((await p.textContent('.chip.fmt')).includes('Match'),'format chip says Match');

  // deliberately wrong: reverse the key
  const wrongKey=shape.key.map((_,i)=>shape.key[shape.key.length-1-i]);
  for(let i=0;i<shape.n;i++){
    await p.click('[data-mslot="'+i+'"]');
    await p.click('[data-mchip="'+wrongKey[i]+'"]');
    await p.waitForTimeout(60);
  }
  assert(!(await p.locator('#matchCheck').isDisabled()),'check enabled once every item is matched');
  await p.click('#matchCheck');
  await p.waitForTimeout(250);
  let ms=await p.evaluate(()=>{const r=window.__pulse.run;return {ok:r.log[0].ok,chosen:r.log[0].chosen};});
  assert.equal(ms.ok,false,'reversed mapping marked incorrect');
  assert(Array.isArray(ms.chosen)&&ms.chosen.length===shape.n,'mapping stored');
  assert(await p.isVisible('.mslot.wrong'),'wrong slots highlighted');
  console.log('PASS match wrong mapping');

  // correct mapping
  await p.evaluate(([sub,i])=>window.__pulse.startDrill(null,0,'drill',[sub+'#'+i]),[SUB,midx]);
  await p.waitForTimeout(350);
  for(let i=0;i<shape.n;i++){
    await p.click('[data-mslot="'+i+'"]');
    await p.click('[data-mchip="'+shape.key[i]+'"]');
    await p.waitForTimeout(60);
  }
  await p.click('#matchCheck');
  await p.waitForTimeout(250);
  ms=await p.evaluate(()=>{const r=window.__pulse.run;return {ok:r.log[0].ok,correct:r.correct};});
  assert.equal(ms.ok,true,'correct mapping accepted');
  assert.equal(ms.correct,1,'score counted');
  assert.equal(await p.locator('.mslot.right').count(),shape.n,'every slot shown correct');
  console.log('PASS match correct mapping');

  // ---- 5. every rich question renders answer controls --------------------
  const renderCheck=await p.evaluate((sub)=>{
    const P=window.__pulse, q=P.SUBJECTS.find(s=>s.id===sub).d.q;
    const idxs=[]; q.forEach((r,i)=>{ if(P.richKind(r)) idxs.push(i); });
    // sample across the whole range plus the first/last of each kind
    const sample=idxs.filter((_,n)=>n%37===0).concat([idxs[0],idxs[idxs.length-1]]);
    const seen=[...new Set(sample)];
    const bad=[];
    for(const i of seen){
      P.startDrill(null,0,'drill',[sub+'#'+i]);
      const row=q[i], kind=P.richKind(row), box=document.getElementById('opts');
      if(kind==='fill'){
        if(!box.querySelector('#fillBox')) bad.push([i,'no fill input']);
        else if(!box.querySelector('#fillCheck')) bad.push([i,'no check button']);
      } else if(kind==='match'){
        const want=P.qMeta(row).left.length;
        const slots=box.querySelectorAll('[data-mslot]').length;
        const chips=box.querySelectorAll('[data-mchip]').length;
        if(slots!==want||chips!==want) bad.push([i,'slots '+slots+'/'+chips+' want '+want]);
      } else bad.push([i,'not rich']);
    }
    return {checked:seen.length,bad};
  },SUB);
  console.log('renderCheck',JSON.stringify(renderCheck));
  assert.equal(renderCheck.bad.length,0,'every sampled rich question has answer controls');
  console.log('PASS answer controls on '+renderCheck.checked+' sampled rich questions');

  // ---- 6. results + flashcards show real text ----------------------------
  await p.evaluate(([sub,i])=>window.__pulse.startDrill(null,0,'drill',[sub+'#'+i]),[SUB,midx]);
  await p.waitForTimeout(300);
  for(let i=0;i<shape.n;i++){
    await p.click('[data-mslot="'+i+'"]');
    await p.click('[data-mchip="'+shape.key[i]+'"]');
    await p.waitForTimeout(50);
  }
  await p.click('#matchCheck');
  await p.waitForTimeout(200);
  await p.click('#nextQ');
  await p.waitForTimeout(400);
  const resText=await p.textContent('#app');
  assert(/Your answer:/.test(resText),'results shows your answer');
  assert(!/undefined/.test(resText),'results never prints undefined');
  console.log('PASS results text');

  const cardAns=await p.evaluate(([sub,i])=>{
    const P=window.__pulse, q=P.SUBJECTS.find(s=>s.id===sub).d.q[i];
    return {text:P.correctAnswerText(q), kind:P.richKind(q)};
  },[SUB,midx]);
  assert(cardAns.kind==='match'&&cardAns.text.includes('\u2192'),'flashcard answer text is a mapping');
  console.log('PASS flashcard answer text');

  // ---- 7. MCQ untouched --------------------------------------------------
  const mcaqIdx=await p.evaluate((sub)=>{
    const P=window.__pulse, q=P.SUBJECTS.find(s=>s.id===sub).d.q;
    for(let i=0;i<q.length;i++) if(!P.richKind(q[i])&&q[i][1].length>=2) return i;
    return -1;
  },SUB);
  await p.evaluate(([sub,i])=>window.__pulse.startDrill(null,0,'drill',[sub+'#'+i]),[SUB,mcaqIdx]);
  await p.waitForTimeout(300);
  const n=await p.locator('[data-opt]').count();
  assert(n>=2,'MCQ options still render');
  await p.click('[data-opt="0"]');
  await p.waitForTimeout(200);
  assert.equal(await p.evaluate(()=>window.__pulse.run.answered),1,'MCQ answer still works');
  console.log('PASS MCQ unchanged');

  // ---- 8. mock-test locking: no answer leaks before the test ends ---------
  await p.evaluate(([sub,i])=>window.__pulse.startDrill(null,0,'drill',[sub+'#'+i]),[SUB,idx]);
  await p.waitForTimeout(300);
  await p.evaluate(()=>{window.__pulse.run.mode='test'; window.__pulse.run.revealed=false; window.__pulse.render();});
  await p.waitForTimeout(150);
  await p.fill('#fillBox','osteoblast');
  await p.click('#fillCheck');
  await p.waitForTimeout(200);
  assert((await p.textContent('.fillfb')).toLowerCase().includes('locked'),'fill answer locked during a test');
  assert.equal(await p.locator('.exp').count(),0,'explanation hidden during a test');
  await p.evaluate(()=>{window.__pulse.run.revealed=true; window.__pulse.render();});
  await p.waitForTimeout(150);
  assert(await p.isVisible('.fillfb.ok'),'correct revealed after the test');
  assert.equal(await p.locator('.exp').count(),1,'explanation revealed after the test');
  console.log('PASS mock-test locking');

  // ---- 9. editor handles a rich question without MCQ controls ------------
  await p.evaluate(([sub,i])=>window.__pulse.startDrill(null,0,'drill',[sub+'#'+i]),[SUB,idx]);
  await p.waitForTimeout(300);
  await p.click('[data-edit-question]');
  await p.waitForTimeout(300);
  assert(await p.isVisible('#questionEditor'),'editor opens on a fill question');
  assert.equal(await p.locator('[data-edit-option]').count(),0,'no option editors for a fill question');
  assert.equal(await p.locator('input[name=editCorrect]').count(),0,'no correct-answer radios for a fill question');
  assert((await p.textContent('.editor-note')).includes('osteoblast'),'editor shows the accepted answer');
  await p.evaluate(()=>{const t=document.getElementById('editStem');t.value=t.value+' [edited]';t.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.click('[data-edit-save]');
  await p.waitForTimeout(350);
  assert.equal(await p.locator('#questionEditor').count(),0,'editor closed after save');
  assert.equal(await p.evaluate(()=>Object.keys(window.__pulse.S.edits||{}).length),1,'correction saved');
  assert((await p.textContent('.qtext')).includes('[edited]'),'edited stem is what renders');
  await p.evaluate(()=>{const P=window.__pulse;P.S.edits={};P.render();});
  console.log('PASS editor on a fill question');

  // ---- 10. a rich question survives exit + relaunch ----------------------
  await p.evaluate(([sub,i])=>window.__pulse.startDrill(null,0,'drill',[sub+'#'+i]),[SUB,midx]);
  await p.waitForTimeout(300);
  await p.click('[data-mslot="0"]');
  await p.click('[data-mchip="0"]');
  await p.waitForTimeout(150);
  await p.reload();
  await p.waitForTimeout(900);
  const resumed=await p.evaluate(()=>({
    view:window.__pulse.nav[window.__pulse.nav.length-1].v,
    slots:document.querySelectorAll('[data-mslot]').length,
    chips:document.querySelectorAll('[data-mchip]').length
  }));
  assert.equal(resumed.view,'quiz','relaunch resumes the quiz');
  assert.equal(resumed.slots,shape.n,'matching slots restored');
  assert.equal(resumed.chips,shape.n,'matching chips restored');
  console.log('PASS rich question resumes after relaunch');

  assert.deepEqual(errors,[],'no page errors: '+errors.join(' | '));
  console.log('ALL PASS');
  await b.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
