const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let mode='valid',cleared=0;
const good=()=>({coords:{latitude:37,longitude:28,accuracy:10},timestamp:Date.now()});
const location={Accuracy:{High:4},requestForegroundPermissionsAsync:async()=>({status:mode==='denied'?'denied':'granted'}),hasServicesEnabledAsync:async()=>mode!=='disabled',getCurrentPositionAsync:async()=>{if(mode==='timeout')return new Promise(()=>{});if(mode==='reject')throw Error('native failure');const p=good();if(mode==='stale')p.timestamp-=61000;return p;}};
const result={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('deviceLocation.js','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:result,require:()=>location,Date,Number,Math,Promise,Error,setTimeout:(fn,ms)=>{assert.equal(ms,20000);return setTimeout(fn,mode==='timeout'?1:1000);},clearTimeout:id=>{cleared++;clearTimeout(id);}});
(async()=>{
 assert.equal(result.isFreshAccurateLocation(good()),true);
 for(const p of [null,{}, {...good(),timestamp:Date.now()-61000},{...good(),timestamp:Date.now()+61000},...[-1,51,NaN,null].map(accuracy=>({...good(),coords:{...good().coords,accuracy}})),{...good(),coords:{latitude:91,longitude:28,accuracy:1}},{...good(),coords:{latitude:37,longitude:Infinity,accuracy:1}}])assert.equal(result.isFreshAccurateLocation(p),false);
 await result.getFreshLocation();
 for(const [m,message] of [['denied',/izni/],['disabled',/hizmetlerini/],['stale',/net değil/],['reject',/native failure/],['timeout',/uzun sürdü/]]){mode=m;await assert.rejects(result.getFreshLocation,message);}
 assert.equal(cleared,4);
 for(const file of ['HomeScreen.js','DetailsScreen.js']){const parsed=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);assert.equal(parsed.parseDiagnostics.length,0,file);}
 console.log('PASS: fresh GPS; invalid, stale and future samples rejected; permissions/services; native error; timeout; timer cleanup; JSX parsing');
})().catch(e=>{console.error(e);process.exitCode=1;});
