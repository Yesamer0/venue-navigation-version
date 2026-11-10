const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),path=require('node:path');
let handle,role=true,mode='ok',fetches=0,calls=[],reserved=-1;
const ctx=vm.createContext({Response,Uint8Array,TextDecoder,AbortSignal,Error,console,Set,crypto:require('node:crypto').webcrypto,atob,
 Deno:{env:{get:k=>k==='GEMINI_API_KEY'?'test-key':k==='GEMINI_MENU_MODEL'?undefined:'https://example.invalid'},serve:fn=>{handle=fn;}},
 createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}}})},
 from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{is_venue:role}})};return q;},
 rpc:async(name,args)=>{calls.push({name,args});return {data:name.startsWith('reserve')?reserved:3};}}),
 fetch:async(url,options)=>{if(url.includes('/models?'))return Response.json({models:[{name:'models/gemini-3.5-flash-lite',supportedGenerationMethods:['generateContent']}]});fetches++;const b=JSON.parse(options.body);assert.equal(b.contents[0].parts[1].inlineData.mimeType,'image/jpeg');
  if(mode==='busy'&&fetches===1)return Response.json({}, {status:503});
  if(mode==='timeout'){const e=new Error('test timeout');e.name='TimeoutError';throw e;}
  if(mode==='quota')return Response.json({}, {status:429});
  if(url.includes('gemini-2.5-flash'))assert.equal(b.generationConfig.thinkingConfig.thinkingBudget,0);
  return Response.json({candidates:[{finishReason:mode==='truncated'?'MAX_TOKENS':'STOP',content:{parts:[{text:JSON.stringify({items:[{name:'Latte',category:'Kahve',price:120,menu_group:'icecek'}]})}]}}]});},
});
const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/import-menu/index.ts'),'utf8').replace(/^import .*;\r?\n/,'');
vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,ctx);
const payload={venueId:'42',image:Buffer.from([255,216,255,1]).toString('base64'),mimeType:'image/jpeg'};
const request=()=>handle(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(payload)}));
function reset(next='ok'){role=true;mode=next;fetches=0;calls=[];reserved=-1;}
(async()=>{
 reset();role=false;assert.equal((await request()).status,403);assert.equal(fetches,0);assert.equal(calls.length,0);
 reset();assert.equal((await request()).status,200);assert.equal(calls.filter(c=>c.name==='commit_venue_menu_import').length,1);assert.equal(calls.length,2);
 reset('busy');assert.equal((await request()).status,200);assert.equal(fetches,2);assert.equal(calls.filter(c=>c.name==='commit_venue_menu_import').length,1);
 reset('timeout');const timeout=await request();assert.equal(timeout.status,504);assert.equal((await timeout.json()).code,'AI_TIMEOUT');assert.equal(calls.at(-1).name,'release_failed_menu_import');
 reset('quota');assert.equal((await request()).status,429);assert.equal(fetches,1);assert.equal(calls.at(-1).name,'release_failed_menu_import');
 reset('truncated');assert.equal((await request()).status,422);assert.equal(calls.at(-1).name,'release_failed_menu_import');
 reset();reserved=3;assert.equal((await request()).status,200);assert.equal(fetches,0);assert.equal(calls.length,1);
 console.log('PASS: traveler blocked before AI; successful owner commit; 503 fallback; timeout/quota/truncation release retry; cached import');
})().catch(e=>{console.error(e);process.exitCode=1;});
