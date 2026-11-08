import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
const p=await b.newPage(); await p.setViewport({width:1356,height:900});
const errors=[]; p.on('pageerror',e=>errors.push(e.message));
await p.goto('https://www.hazir.live/',{waitUntil:'networkidle0',timeout:60000}); await new Promise(r=>setTimeout(r,2500));
for (const id of ['how','occasions']) {
  await p.evaluate(()=>scrollTo(0,0)); await new Promise(r=>setTimeout(r,600));
  await p.evaluate(id=>{document.querySelector(`a[href="#${id}"]`).click()},id);
  await new Promise(r=>setTimeout(r,2600));
  const d=await p.evaluate(()=>{
    const nav=document.querySelector('.nav').getBoundingClientRect();
    const eyebrow=document.querySelector('.how .eyebrow, .occ .eyebrow');
    return {scrollY:Math.round(scrollY),navBottom:Math.round(nav.bottom)};
  });
  const sect=await p.evaluate(id=>{
    const sec=document.getElementById(id)||document.querySelector(id==='how'?'.how':'.occ');
    const h2=sec.querySelector('h2'); const eb=sec.querySelector('.eyebrow');
    return {h2Top:Math.round(h2.getBoundingClientRect().top),ebTop:eb?Math.round(eb.getBoundingClientRect().top):null};
  },id);
  console.log(id,JSON.stringify({...d,...sect}));
  await p.screenshot({path:`/downloads/hazir-shots/anchor-${id}.png`});
}
console.log('ERRORS:',errors.length?errors.join('|'):'none');
await b.close();
