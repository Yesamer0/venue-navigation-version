const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),path=require('node:path');
let handler,fail=false,living=['live.jpg'],removed=[],ack=[];
const client={rpc:async()=>({error:null}),from:table=>({
 select:()=>({order:()=>({limit:async()=>({data:[{storage_path:'live.jpg'},{storage_path:'deleted.jpg'}]})}),in:async()=>({data:living.map(storage_path=>({storage_path}))})}),
 delete:()=>({in:async(field,paths)=>{ack.push(...paths);return {error:null};}}),
}),storage:{from:()=>({remove:async paths=>{removed.push(...paths);return {error:fail?new Error('offline'):null};}})}};
const code=fs.readFileSync(path.join(__dirname,'../supabase/functions/cleanup-visitor-photos/index.ts'),'utf8').replace(/^import .*;\r?\n/,'');
vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{Response,Set,Deno:{env:{get:n=>n==='PHOTO_CLEANUP_TOKEN'?'test':'unused'},serve:fn=>handler=fn},createClient:()=>client});
const request=token=>handler(new Request('https://example.invalid',{method:'POST',headers:{'X-Cleanup-Token':token}}));
(async()=>{
 assert.equal((await request('wrong')).status,401);assert.equal(removed.length,0);
 assert.equal((await request('test')).status,200);assert.deepEqual(removed,['deleted.jpg']);assert.ok(ack.includes('live.jpg'));
 removed=[];ack=[];fail=true;assert.equal((await request('test')).status,500);assert.deepEqual(removed,['deleted.jpg']);assert.ok(!ack.includes('deleted.jpg'));
 console.log('PASS: cleanup authentication; surviving photos protected; only deleted file removed; failed deletion remains queued');
})().catch(e=>{console.error(e);process.exitCode=1;});
