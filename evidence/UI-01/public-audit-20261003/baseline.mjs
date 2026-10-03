import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const require = createRequire('D:/PBL4-517/website/frontend/package.json');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const out = process.argv[2];
const base = 'https://47.129.214.70';
const browser = await chromium.launch({headless:true});
const result = {date:'2026-10-03',base,browser:browser.version(),pages:[],errors:[],httpErrors:[],products:[]};
await fs.mkdir(out,{recursive:true});
result.products = (await (await fetch(base+'/api/products')).json()).data;
console.log('PRODUCTS',JSON.stringify(result.products.map(({id,name,category,price,stock,imageKey})=>({id,name,category,price,stock,imageKey}))));
const available = result.products.find(p=>p.stock>0);
result.detailId=available.id;
for (const width of [1440,390]) {
 const context=await browser.newContext({viewport:{width,height:width===1440?900:844},isMobile:width===390,hasTouch:width===390});
 const page=await context.newPage();
 page.on('pageerror',err=>result.errors.push({width,error:err.message}));
 page.on('response',r=>{if(r.status()>=400)result.httpErrors.push({width,status:r.status(),url:r.url()});});
 await page.addInitScript(()=>{
   window.auditMetrics={lcp:0,cls:0};
   new PerformanceObserver(list=>{for(const e of list.getEntries())window.auditMetrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
   new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.auditMetrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
 });
 for(const [label,route] of [['home','/'],['catalog','/products'],['detail','/products/'+available.id],['login','/login'],['register','/register'],['404','/audit-page-does-not-exist']]){
  const response=await page.goto(base+route,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(out,label+'-'+width+'.png'),fullPage:true});
  const data=await page.evaluate(()=>{
    const visible=el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(el).visibility!=='hidden';};
    const short=el=>(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,110);
    return {title:document.title,url:location.href,h1:[...document.querySelectorAll('h1')].map(e=>e.innerText),text:document.querySelector('main')?.innerText,
      viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      overflow:[...document.querySelectorAll('body *')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right>innerWidth+1;}).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,text:short(e)})),
      smallControls:[...document.querySelectorAll('button,input,select,textarea,a')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.width<44||r.height<44;}).map(e=>{const r=e.getBoundingClientRect();return {text:short(e),tag:e.tagName,width:r.width,height:r.height,cls:e.className};}),
      brokenImages:[...document.images].filter(e=>!e.complete||!e.naturalWidth).map(e=>e.src),
      metrics:window.auditMetrics,navigation:performance.getEntriesByType('navigation').map(e=>({ttfb:e.responseStart-e.requestStart,dom:e.domContentLoadedEventEnd,duration:e.duration})),
      resources:performance.getEntriesByType('resource').map(e=>({name:e.name,transfer:e.transferSize,duration:e.duration})),
      links:[...document.querySelectorAll('main a')].map(e=>({text:short(e),href:e.getAttribute('href')})),
      form:[...document.querySelectorAll('input,textarea')].map(e=>({id:e.id,type:e.type,autocomplete:e.autocomplete,name:e.name,required:e.required}))
    };
  });
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  data.violations=axe.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
  data.incomplete=axe.incomplete.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length}));
  result.pages.push({label,width,http:response.status(),...data});
  console.log('PAGE',label,width,'overflow',data.scrollWidth,'axe',JSON.stringify(data.violations),'small',data.smallControls.length);
 }
 await page.goto(base+'/products',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Thêm '+available.name+' vào giỏ hàng',exact:true}).click();
 await page.goto(base+'/cart',{waitUntil:'networkidle'});
 await page.screenshot({path:path.join(out,'cart-'+width+'.png'),fullPage:true});
 const cartData=await page.evaluate(()=>({text:document.querySelector('main').innerText,scrollWidth:document.documentElement.scrollWidth,forms:[...document.querySelectorAll('input,textarea')].map(e=>({id:e.id,name:e.name,type:e.type,autocomplete:e.autocomplete,required:e.required})),controls:[...document.querySelectorAll('main button')].map(e=>{const r=e.getBoundingClientRect();return {text:e.getAttribute('aria-label')||e.innerText,width:r.width,height:r.height,disabled:e.disabled};})}));
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
 result.pages.push({label:'cart',width,...cartData,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
 console.log('CART',width,JSON.stringify(result.pages.at(-1)));
 await context.close();
}
await fs.writeFile(path.join(out,'baseline.json'),JSON.stringify(result,null,2));
await browser.close();
console.log('ARTIFACTS',out);
