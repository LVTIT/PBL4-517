import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const require=createRequire('D:/PBL4-517/website/frontend/package.json');
const {chromium}=require('playwright');
const out=process.argv[2],base='https://47.129.214.70';
const result={headers:[],images:[],performance:[],authSimulation:[],checkoutSimulation:[]};
for(const url of ['/','/products','/api/products']){
 const r=await fetch(base+url),t=await r.text();
 result.headers.push({url,status:r.status,headers:Object.fromEntries([...r.headers].filter(([k])=>['content-type','cache-control','content-security-policy','strict-transport-security','x-content-type-options','x-frame-options','server'].includes(k))),assets:url==='/'?[...t.matchAll(/(?:src|href)="([^"]+)"/g)].map(x=>x[1]):undefined});
}
const pr=await (await fetch('https://api.github.com/repos/LVTIT/PBL4-517/pulls/52')).json();
result.pr={state:pr.state,sha:pr.head?.sha,base:pr.base?.ref};
const catalog=(await (await fetch(base+'/api/products')).json()).data;
for(const p of catalog.filter(p=>p.imageKey)){
 const url='/images/products/'+p.imageKey+'.webp';
 const r=await fetch(base+url),remote=Buffer.from(await r.arrayBuffer());
 const local=await fs.readFile('D:/PBL4-517/website/frontend/public'+url);
 result.images.push({name:p.name,url,bytes:remote.length,sha256:crypto.createHash('sha256').update(remote).digest('hex'),matchesCheckout:remote.equals(local)});
}
const browser=await chromium.launch({headless:true});
for(let i=0;i<3;i++){
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await c.newPage(),cdp=await c.newCDPSession(page);
 await cdp.send('Network.enable');
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750,connectionType:'cellular4g'});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{
  window.auditMetrics={lcp:0,cls:0};
  new PerformanceObserver(list=>{for(const e of list.getEntries())window.auditMetrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.auditMetrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
 });
 await page.goto(base,{waitUntil:'networkidle'});
 await page.waitForTimeout(1500);
 const r=await page.evaluate(()=>({...window.auditMetrics,ttfb:performance.getEntriesByType('navigation')[0].responseStart,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,bytes:e.transferSize,duration:e.duration})),totalTransfer:performance.getEntriesByType('resource').reduce((s,e)=>s+e.transferSize,0)}));
 result.performance.push({run:i+1,...r});console.log('SLOW-PERF',i+1,JSON.stringify(r));
 await c.close();
}
for(const role of ['CUSTOMER','ADMIN']){
 const c=await browser.newContext({viewport:{width:320,height:844},isMobile:true,hasTouch:true});
 await c.route('**/api/auth/me',route=>route.fulfill({json:{data:{user:{id:'audit-simulated-user',name:'Người dùng kiểm thử giao diện có tên dài',email:'ui-audit@example.invalid',role}}}}));
 const page=await c.newPage();
 await page.goto(base,{waitUntil:'networkidle'});
 const r=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,header:document.querySelector('header').innerText,headerWidth:document.querySelector('header').getBoundingClientRect().width}));
 result.authSimulation.push({role,requestedWidth:320,...r});
 await page.screenshot({path:path.join(out,'header-simulated-'+role.toLowerCase()+'-320.png')});
 console.log('AUTH-SIMULATION',role,JSON.stringify(r));
 await c.close();
}
const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await c.newPage(),p=catalog.find(p=>p.stock>0);
await page.goto(base+'/products',{waitUntil:'networkidle'});
await page.getByRole('button',{name:'Thêm '+p.name+' vào giỏ hàng',exact:true}).click();
await page.goto(base+'/cart',{waitUntil:'networkidle'});
await page.locator('#guest-name').fill('Khách Kiểm Thử');
await page.locator('#guest-email').fill('ui-audit@example.invalid');
await page.locator('#shipping-address').fill('Địa chỉ kiểm thử không giao hàng');
const fields=await page.locator('form').innerText();
let payload;
await c.route('**/api/orders',route=>{
 payload=route.request().postDataJSON();
 if(route.request().method()==='POST')return route.fulfill({status:201,json:{data:{id:'audit-simulated-order',status:'PENDING',totalPrice:p.price,shippingAddress:'Địa chỉ kiểm thử không giao hàng',createdAt:'2026-10-03T00:00:00Z',items:[]}}});
 return route.abort();
});
await page.getByRole('button',{name:'Xác nhận đặt hàng',exact:true}).click();
await page.getByRole('heading',{name:/Đặt hàng thành công/}).waitFor();
result.checkoutSimulation.push({name:'guest-success',mockedResponse:true,payload,checkoutText:fields,text:await page.locator('main').innerText(),scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth)});
await page.screenshot({path:path.join(out,'guest-success-simulated-390.png'),fullPage:true});
await page.reload({waitUntil:'networkidle'});
result.checkoutSimulation.push({name:'success-refresh',mockedResponse:true,text:await page.locator('main').innerText()});
console.log('CHECKOUT-SIMULATION',JSON.stringify(result.checkoutSimulation));
await c.close();
await browser.close();
await fs.writeFile(path.join(out,'extended.json'),JSON.stringify(result,null,2));
console.log('FINISHED');
