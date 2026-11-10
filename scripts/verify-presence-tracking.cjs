const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const load=(file,modules,extras={})=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>modules[n],Date,Number,Math,Promise,Map,Set,...extras});return exports;};
const gps=load('deviceLocation.js',{});
let position={coords:{latitude:37,longitude:28,accuracy:10},timestamp:Date.now()},stateChange,tick,callback,removed=0,permission='granted',fail=false;
let allCalls=[];let rows=[{venue_id:'cafe',last_seen_at:new Date(Date.now()-6*60000).toISOString()}],calls=[];
const venue={id:'cafe',latitude:37,longitude:28};
const supabase={from:table=>{let op='select',filters={};const query={select:()=>query,delete:()=>{op='delete';return query;},update:value=>{op='update';return query;},eq:(key,value)=>{filters[key]=value;return query;},gte:()=>query,in:()=>query,then:resolve=>{calls.push({table,op,filters});allCalls.push({table,op,filters});if(op==='delete'&&!fail)rows=[];return Promise.resolve(resolve({error:fail&&op==='delete'?{}:null,data:table==='venues'?[venue]:rows.map(r=>({...r}))}));}};return query;}};
const AppState={currentState:'active',addEventListener:(_,fn)=>{stateChange=fn;return{remove(){}};}};
const Location={Accuracy:{High:4},getForegroundPermissionsAsync:async()=>({status:permission}),watchPositionAsync:async(_,fn)=>{callback=fn;return{remove:()=>removed++};}};
const service=load('presenceTracking.js',{'expo-location':Location,'react-native':{AppState},'./supabase':{supabase},'./deviceLocation':{...gps,getFreshLocation:async()=>position}},{setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{}});
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
(async()=>{
 assert.equal(service.presenceAction(position,venue),'refresh');
 assert.equal(service.presenceAction({...position,coords:{...position.coords,latitude:37.003}},venue),'leave');
 assert.equal(service.presenceAction({...position,coords:{...position.coords,latitude:37.0011}},venue),null);
 assert.equal(service.presenceAction({...position,timestamp:0},venue),null);
 assert.equal(service.presenceAction(position,{latitude:null,longitude:28}),null);
 const stop=service.startPresenceTracking('me');await flush();
 assert.ok(calls.some(c=>c.op==='update'&&c.filters.user_id==='me'));
 calls=[];AppState.currentState='background';stateChange('background');await callback({...position,coords:{...position.coords,latitude:38}});await flush();assert.equal(calls.length,0);assert.ok(removed>0);
 position={...position,coords:{...position.coords,latitude:38}};AppState.currentState='active';stateChange('active');await flush();assert.ok(calls.some(c=>c.op==='delete'&&c.filters.user_id==='me'&&c.filters.venue_id==='cafe'));assert.equal(rows.length,0);
 rows=[{venue_id:'cafe',last_seen_at:new Date().toISOString()}];calls=[];fail=true;service.refreshPresenceTracking();await flush();assert.equal(rows.length,1);fail=false;service.refreshPresenceTracking();await flush();assert.equal(rows.length,0);
 calls=[];stop();await tick();service.refreshPresenceTracking();await flush();assert.equal(calls.length,0);
 assert.ok(allCalls.every(c=>c.table==='venue_presence'||c.table==='venues'));
 console.log('PASS: GPS hysteresis, stale samples, own-row heartbeat/delete, background pause, resume outside venue, retry, account cleanup; tracker writes only presence');
})().catch(e=>{console.error(e);process.exitCode=1;});

