/* Ophthalmology import and reading-first quiz/flashcard regression. */
const {PW_PATH, HTML, launchOptions} = require('./test-env');
const {chromium} = require(PW_PATH);
const assert = require('assert');
(async()=>{
  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({viewport:{width:393,height:851},isMobile:true,hasTouch:true});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(HTML); await page.waitForTimeout(500);
  const data = await page.evaluate(()=>{
    const oph=window.__pulse.BANK.oph;
    return {chapters:oph.c.map((_,i)=>oph.u.filter(u=>u[0]===i).reduce((n,u)=>n+u[6],0)), units:oph.u.length, questions:oph.q.length};
  });
  assert.equal(data.units,259); assert.equal(data.questions,1918);
  assert(data.chapters.every(n=>n>0),'all 50 chapters have questions');
  await page.click('[data-sub="oph"]');
  assert(!(await page.textContent('[data-ch="42"]')).includes('0 questions'));
  await page.click('[data-ch="42"]');
  assert(await page.locator('[data-unit]').count()>0,'chapter 43 has units');

  // A legacy MCQ match stem is split into labelled lists in both views.
  const key=await page.evaluate(()=>{
    const q=window.__pulse.BANK.aneesh.q;
    const i=q.findIndex(x=>x[0].startsWith('Match the six sign entries of the MR list'));
    return 'aneesh#'+i;
  });
  assert(!key.endsWith('#-1'));
  await page.evaluate(k=>window.startCards([k], 'MR Signs', false),key);
  assert.equal(await page.locator('.fcard .pairgroup').count(),2);
  assert.equal(await page.locator('.fcard .pairitem').count(),12);
  assert(await page.locator('.fcard .pairtitle').first().textContent() === 'Items');
  await page.click('#cardFlip');
  assert(await page.isVisible('.ans p')); assert(await page.isVisible('.ansx-label'));
  assert(await page.isVisible('[data-card-rate="good"]'));
  await page.click('[data-card-rate="good"]');
  assert(await page.evaluate(k=>!!window.__pulse.S.srs[k],key),'rating schedules review');
  await page.evaluate(k=>window.__pulse.startDrill(window.__pulse.SUBJECTS.find(s=>s.id==='aneesh'),1,'drill',[k]),key);
  assert.equal(await page.locator('.qcard .pairgroup').count(),2);
  assert.equal(await page.locator('.qcard .pairitem').count(),12);
  await page.click('[data-opt="0"]');
  assert(await page.isVisible('.exp'));
  assert.deepEqual(errors,[]);
  await browser.close(); console.log('PASS ophthalmology and reading layout');
})().catch(e=>{console.error(e);process.exit(1);});
