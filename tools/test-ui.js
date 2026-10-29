/* PULSE UI regression: resume-after-exit, results "Next unit", question editor, footer link. */
const {chromium}=require(process.env.PW_PATH||'/tmp/node_modules/playwright');
const assert=require('assert');
const FILE='file:///home/user/index.html';
(async()=>{
  const b=await chromium.launch();
  const errors=[];
  // page 1: Android bridge present (footer APK link must stay hidden)
  const p=await b.newPage({viewport:{width:393,height:851},isMobile:true,hasTouch:true});
  p.on('pageerror',e=>errors.push('p1:'+e.message));
  p.on('dialog',d=>d.accept());
  await p.goto(FILE);
  await p.addInitScript(()=>{window.PulseAndroid={vibrate(){},exportText(s){window.__lastExport=s;},pickFile(){}};});
  await p.reload(); await p.waitForTimeout(400);
  assert(await p.isHidden('#apkLink'),'footer APK link hidden inside app');
  console.log('PASS footer link hidden in-app');

  // unlock everything so sequential locking does not interfere
  await p.evaluate(()=>{const S=window.__pulse.S;S.unlockAll=true;localStorage.setItem('pulse_mbbs_state_v2',JSON.stringify(S));});
  // drill the first two questions of peds unit index 10
  const keys=await p.evaluate(()=>{
    const s=window.__pulse.SUBJECTS.find(x=>x.id==='peds'),u=s.d.u[10];
    return {keys:[u[5],u[5]+1].map(q=>s.id+'#'+q),title:u[2],nxtTitle:s.d.u[11][2],nxtCode:s.d.u[11][1]};
  });
  await p.evaluate(k=>window.__pulse.startDrill(window.__pulse.SUBJECTS.find(s=>s.id==='peds'),0,'drill',k),keys.keys);
  await p.waitForTimeout(300);
  assert((await p.textContent('.qmeta')).includes('Question 1 of 2'));
  await p.click('[data-opt="0"]'); await p.waitForTimeout(150);
  await p.click('#nextQ'); await p.waitForTimeout(250);
  assert((await p.textContent('.qmeta')).includes('Question 2 of 2'),'moved to Q2');
  // exit mid-quiz to home
  await p.evaluate(()=>window.__pulse.setTab('subjects')); await p.waitForTimeout(250);
  const card=await p.textContent('[data-resume-quiz]');
  assert(card.includes('question 2 of 2'),'home resume card shows position: '+card);
  console.log('PASS home resume card');
  await p.click('[data-resume-quiz]'); await p.waitForTimeout(250);
  assert((await p.textContent('.qmeta')).includes('Question 2 of 2'),'resume returns to Q2');
  // cold restart mid-quiz
  await p.reload(); await p.waitForTimeout(500);
  assert((await p.textContent('.qmeta')).includes('Question 2 of 2'),'auto-resume after reload');
  assert(await p.isVisible('.toast'),'resume toast shown');
  assert(await p.isVisible('#skipQ'),'Q2 still unanswered after resume');
  console.log('PASS auto-resume after reload');
  // finish
  await p.click('[data-opt="0"]'); await p.waitForTimeout(150);
  await p.click('#nextQ'); await p.waitForTimeout(350);
  assert((await p.textContent('#app')).includes('Review'),'results shown');
  // Next unit must point at unit 10+1, NOT the first-undone unit (old bug -> unit 0)
  await p.evaluate(()=>{const S=window.__pulse.S;S.unlockAll=false;});
  await p.click('[data-unit]'); await p.waitForTimeout(250);
  await p.waitForFunction(()=>[...document.querySelectorAll('.toast')].some(t=>t.textContent.includes('Locked')),null,{timeout:2000});
  assert.equal(await p.evaluate(()=>window.__pulse.nav[window.__pulse.nav.length-1].v),'results','no navigation when locked');
  await p.evaluate(()=>{window.__pulse.S.unlockAll=true;});
  await p.click('[data-unit]'); await p.waitForTimeout(300);
  const top=await p.evaluate(()=>window.__pulse.nav[window.__pulse.nav.length-1]);
  assert.equal(top.v,'guide'); assert.equal(top.i,11,'next unit = unit after last answered (11)');
  assert((await p.textContent('.banner')).includes(keys.nxtTitle),'guide shows unit 12 title: '+keys.nxtTitle);
  console.log('PASS results Next unit goes to correct unit');

  // editor regression
  await p.evaluate(()=>window.__pulse.startDrill(window.__pulse.SUBJECTS.find(s=>s.id==='peds'),1,'drill',['peds#4107']));
  await p.waitForTimeout(300);
  await p.click('[data-edit-question]'); await p.fill('#editStem','RESUME-EDIT check'); await p.click('[data-edit-save]');
  await p.waitForTimeout(250);
  assert((await p.textContent('.qtext')).includes('RESUME-EDIT'));
  await p.click('[data-edit-question]'); await p.click('[data-edit-original]'); await p.waitForTimeout(250);
  assert((await p.textContent('.qtext')).includes('20-month-old'),'restore original works');
  console.log('PASS editor regression');

  // page 2: no bridge -> footer APK link visible
  const p2=await b.newPage();
  p2.on('pageerror',e=>errors.push('p2:'+e.message));
  await p2.goto(FILE); await p2.waitForTimeout(400);
  assert(await p2.isVisible('#apkLink'),'footer APK link visible on web');
  assert.equal(await p2.getAttribute('#apkLink','href'),'PULSE-MBBS-offline.apk');
  console.log('PASS footer link visible on web');

  assert.deepEqual(errors,[]);
  console.log('ALL PASS'); await b.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
