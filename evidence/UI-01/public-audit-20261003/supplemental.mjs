import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const require=createRequire('D:/PBL4-517/website/frontend/package.json');
const {chromium}=require('playwright');
const out=process.argv[2],base='https://47.129.214.70';
const result={assets:[],navigation:[],cart:[],visual:[]};
for(const url of ['/assets/index-LQ7uQqz9.js','/assets/index-oAVxOHgT.css','/fonts/be-vietnam-pro-400-latin.woff2','/images/hero/hero-workspace.webp']){
 const r=await fetch(base+url,{headers:{'Accept-Encoding':'gzip, br'}}),bytes=Buffer.from(await r.arrayBuffer());
 const localPath=url.startsWith('/assets')?'D:/PBL4-517/website/frontend/dist'+url:'D:/PBL4-517/website/frontend/public'+url;
 const local=await fs.readFile(localPath);
 result.assets.push({url,status:r.status,headers:Object.fromEntries(r.headers),decodedBytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),matchesLocalBuild:local.equals(bytes)});
}
const browser=await chromium.launch({headless:true});
const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await c.newPage();
const catalog=(await (await fetch(base+'/api/products')).json()).data;
for(const name of ['Hub USB-C 5 trong 1','Giá đỡ laptop nhôm','Thảm bàn Desk Mat Da PU','Chuột công thái học Ergo Master','Loa để bàn SoundBar Desk']){
 const p=catalog.find(p=>p.name===name);
 await page.goto(base+'/products/'+p.id,{waitUntil:'networkidle'});
 const idx=result.visual.length+1;
 await page.screenshot({path:path.join(out,'product-mismatch-'+idx+'-390.png')});
 result.visual.push({name:p.name,image:p.imageKey,file:'product-mismatch-'+idx+'-390.png'});
}
await page.goto(base+'/products',{waitUntil:'networkidle'});
await page.locator('.product-card').nth(4).locator('h3 a').scrollIntoViewIfNeeded();
await page.waitForLoadState('networkidle');
const before=await page.evaluate(()=>scrollY);
const target=catalog.find(p=>p.name==='Hub USB-C 5 trong 1');
await page.locator('.product-card').nth(4).locator('h3 a').click();
await page.getByRole('heading',{name:target.name,exact:true}).waitFor({state:'visible'});
await page.waitForTimeout(250);
result.navigation.push({name:'catalog-to-detail',before,after:await page.evaluate(()=>scrollY),heading:await page.getByRole('heading',{name:target.name,exact:true}).boundingBox()});
await page.getByRole('link',{name:'Đăng nhập',exact:true}).click();
await page.locator('#email').waitFor();
result.navigation.push({name:'review-login-return',url:page.url(),historyState:await page.evaluate(()=>history.state)});
const p=catalog.find(p=>p.stock>0);
for(const width of [320,390,768,1024,1440]){
 await page.setViewportSize({width,height:844});
 await page.goto(base+'/products',{waitUntil:'networkidle'});
 await page.evaluate(product=>localStorage.setItem('pbl517_cart_guest',JSON.stringify([{productId:product.id,quantity:1,product}])),p);
 await page.goto(base+'/cart',{waitUntil:'networkidle'});
 const r=await page.evaluate(expected=>({expected,innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>expected+1||r.left < -1);}).slice(0,14).map(e=>({cls:e.className,text:e.innerText?.slice(0,50),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}),width);
 result.cart.push(r);
 if(width===320||width===390)await page.screenshot({path:path.join(out,'cart-verified-'+width+'.png'),fullPage:true});
}
await c.close();
await browser.close();
await fs.writeFile(path.join(out,'supplemental.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
