/* Regression: Medicine volumes on the dashboard + Med-V1 / Gyne / Aneesh subjects. */
const {PW_PATH,HTML,launchOptions}=require('./test-env');
const {chromium}=require(PW_PATH);
const assert=require('assert');
(async()=>{
  const b=await chromium.launch(launchOptions());const errors=[];
  const p=await b.newPage({viewport:{width:393,height:851},isMobile:true,hasTouch:true});
  p.on('pageerror',e=>errors.push(e.message));
  p.on('dialog',d=>d.accept());
  await p.goto(HTML);await p.waitForTimeout(600);

  const stats=await p.evaluate(()=>({subs:window.__pulse.SUBJECTS.length,
    q:window.__pulse.SUBJECTS.reduce((a,s)=>a+s.d.q.length,0),
    u:window.__pulse.SUBJECTS.reduce((a,s)=>a+s.d.u.length,0),
    per:window.__pulse.SUBJECTS.map(s=>({id:s.id,c:s.d.c.length,u:s.d.u.length,q:s.d.q.length}))}));
  assert.equal(stats.subs,12);assert.equal(stats.q,50656);assert.equal(stats.u,4923);
  console.log('PASS bank stats',JSON.stringify(stats.per.filter(x=>['medv1','gyne','aneesh'].includes(x.id))));

  // home: Medicine family card, no loose volume cards
  assert(await p.isVisible('[data-fam="Medicine"]'));
  const famText=await p.textContent('[data-fam="Medicine"]');
  assert(famText.includes('3 volumes'),'family card: '+famText);
  assert.equal(await p.locator('[data-sub="medv1"]').count(),0,'vol1 not on home');
  assert.equal(await p.locator('[data-sub="medv2"]').count(),0,'vol2 not on home');
  assert(await p.isVisible('[data-sub="gyne"]'));
  assert(await p.isVisible('[data-sub="aneesh"]'));
  const foot=await p.textContent('#footMeta');assert(foot.includes('50,656'),'foot: '+foot);
  console.log('PASS home dashboard grouping');

  // Medicine -> volumes -> Volume 1 -> chapters -> unit quiz
  await p.click('[data-fam="Medicine"]');await p.waitForTimeout(250);
  assert((await p.textContent('#top')).includes('Medicine'),'vols header');
  for(const v of ['Volume 1','Volume 2','Volume 3']) assert(await p.isVisible(`text=${v}`),v+' card');
  const vol1=await p.textContent('[data-sub="medv1"]');assert(vol1.includes('61 chapters'),'vol1 card: '+vol1);
  await p.click('[data-sub="medv1"]');await p.waitForTimeout(250);
  assert.equal(await p.locator('.chrow').count(),61,'61 chapter rows');
  await p.click('.chrow');await p.waitForTimeout(200);
  await p.click('[data-unit]');await p.waitForTimeout(200);
  await p.click('[data-start]');await p.waitForTimeout(300);
  assert.equal(await p.evaluate(()=>window.__pulse.run.mode),'unit');
  assert(await p.isVisible('[data-edit-question]'),'edit button on new subject');
  await p.click('[data-opt="0"]');await p.waitForTimeout(200);
  assert.equal(await p.evaluate(()=>window.__pulse.run.answered),1);
  console.log('PASS Medicine volumes -> Volume 1 quiz');

  // Gyne chapters + quiz
  await p.evaluate(()=>window.__pulse.setTab('subjects'));await p.waitForTimeout(250);
  await p.click('[data-sub="gyne"]');await p.waitForTimeout(250);
  assert.equal(await p.locator('.chrow').count(),49,'49 gyne chapters');
  await p.click('.chrow');await p.waitForTimeout(200);
  await p.click('[data-unit]');await p.waitForTimeout(200);
  await p.click('[data-start]');await p.waitForTimeout(300);
  const gq=await p.textContent('.qtext');assert(gq.length>20,'gyne question renders');
  console.log('PASS Gyne chapters + quiz');

  // Aneesh chapters
  await p.evaluate(()=>window.__pulse.setTab('subjects'));await p.waitForTimeout(250);
  await p.click('[data-sub="aneesh"]');await p.waitForTimeout(250);
  assert.equal(await p.locator('.chrow').count(),15,'15 aneesh chapters');
  console.log('PASS Aneesh chapters');

  // search hits a gyne question
  await p.evaluate(()=>window.__pulse.setTab('search'));await p.waitForTimeout(200);
  await p.fill('#sq','Barr bodies');
  await p.waitForFunction(()=>document.getElementById('app').textContent.includes('Barr bodies'),null,{timeout:4000});
  assert((await p.textContent('#app')).includes('Gyne'),'search result attributed to Gyne');
  console.log('PASS search');

  assert.deepEqual(errors,[]);
  console.log('ALL PASS');await b.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
