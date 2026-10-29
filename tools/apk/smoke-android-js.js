const {chromium} = require('/tmp/node_modules/playwright');
(async()=>{
  let b=await chromium.launch();
  let ctx=await b.newContext({viewport:{width:390,height:844}, isMobile:true,hasTouch:true,offline:true});
  let p=await ctx.newPage();let errors=[], bridgeCalls=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
    window.PulseAndroid={
      exportProgress:(s,n)=>window.__nativeExport={json:s,name:n},
      pickProgressFile:()=>window.__nativePick=true,
      setTheme:t=>window.__nativeTheme=t,
      vibrate:()=>window.__nativeHaptic=true
    };
  });
  // build.sh stages ../../index.html into assets/ at build time; test the same source file.
  await p.goto('file:///home/user/index.html');
  await p.waitForTimeout(500);
  console.log('initial bank',await p.evaluate(()=>({subs:window.__pulse.SUBJECTS.length,unit:window.__pulse.SUBJECTS.reduce((a,s)=>a+s.d.u.length,0),q:window.__pulse.SUBJECTS.reduce((a,s)=>a+s.d.q.length,0),theme:window.__nativeTheme})))
  await p.click('[data-gear]');
  console.log('old modules button hidden', (await p.locator('[data-import]').count())===0);
  await p.click('[data-set-theme="dark"]');
  console.log('theme bridge',await p.evaluate(()=>window.__nativeTheme));
  await p.click('[data-export]');
  console.log('export bridge',await p.evaluate(()=>({name:window.__nativeExport.name, json:JSON.parse(window.__nativeExport.json).xp})));
  await p.click('[data-import-file]');console.log('native file picker',await p.evaluate(()=>window.__nativePick));
  await p.evaluate(()=>{window.PulseNativeImport(JSON.stringify({xp:2333,done:{},wrong:{},srs:{},prefs:{theme:'dark',accent:'orange'},notes:{}}));});
  console.log('import bridge',await p.evaluate(()=>({xp:window.__pulse.S.xp,theme:document.documentElement.dataset.theme,accent:document.documentElement.dataset.accent,nav:window.__pulse.nav.map(x=>x.v)})));
  await p.click('[data-fam="Medicine"]');await p.click('[data-sub="medv2"]');await p.click('[data-ch]');await p.click('[data-unit]');await p.click('[data-start]');
  console.log('quiz open',await p.evaluate(()=>({mode:window.__pulse.run.mode, screen:window.__pulse.nav.at(-1).v, answerButtons:document.querySelectorAll('[data-opt]').length})));
  await p.click('[data-opt="0"]');
  console.log('answer tracked',await p.evaluate(()=>({answered:window.__pulse.run.answered,day:Object.values(window.__pulse.S.log).reduce((a,b)=>a+b.a,0)})));
  console.log('native back',await p.evaluate(()=>({used:window.PulseNativeBack(),current:window.__pulse.nav.at(-1).v})));
  console.log('errors',errors);
  await b.close();
})();
