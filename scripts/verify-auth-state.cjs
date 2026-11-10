const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
let slots=[],hook=0,pending=[],authCallback,appCallback,profileCalls=0,active={user:{id:'traveler'}},fail=false;
const react={createContext:()=>({Provider:'Provider'}),useContext:()=>null,
 useState:initial=>{const i=hook++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},
 useRef:v=>{const i=hook++;return slots[i]??={current:v};},
 useCallback:fn=>{hook++;return fn;},
 useEffect:(fn,deps)=>{const i=hook++,old=slots[i];if(!old||deps.some((x,k)=>x!==old.deps[k])){pending.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}},
 createElement:(type,props,...children)=>({type,props,children})};react.default=react;
const supabase={auth:{onAuthStateChange:cb=>{authCallback=cb;return{data:{subscription:{unsubscribe:()=>{}}}};},getSession:async()=>({data:{session:active}}),getUser:async()=>({data:{user:active?.user}}),startAutoRefresh:()=>{},stopAutoRefresh:()=>{}},rpc:async()=>{profileCalls++;return fail?{error:{}}:{data:[{id:active.user.id,is_venue:active.user.id==='owner'}]};}};
const exports_={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../AuthProvider.js'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exports_,require:id=>({react,'react-native':{Platform:{OS:'ios'},AppState:{currentState:'active',addEventListener:(event,cb)=>{appCallback=cb;return{remove:()=>{}};}}},'./supabase':{supabase},'./pushNotifications':{registerForPushNotificationsAsync:async()=>null}}[id])});
async function flush(){let value;for(let i=0;i<5;i++){hook=0;value=exports_.AuthProvider({children:null}).props.value;const effects=pending;pending=[];effects.forEach(f=>f());await new Promise(resolve=>setImmediate(resolve));}return value;}
(async()=>{
 let state=await flush();assert.equal(state.session.user.id,'traveler');assert.equal(state.profile.is_venue,false);assert.equal(state.loading,false);
 const before=profileCalls;active={user:{id:'traveler'},access_token:'refreshed'};authCallback('TOKEN_REFRESHED',active);state=await flush();assert.equal(state.loading,false);assert.ok(state.profile);assert.equal(profileCalls,before);
 active={user:{id:'owner'}};authCallback('SIGNED_IN',active);state=await flush();assert.equal(state.profile.id,'owner');assert.equal(state.profile.is_venue,true);
 fail=true;state.retry();state=await flush();assert.equal(state.loading,false);assert.ok(state.error);fail=false;state.retry();state=await flush();assert.equal(state.profile.id,'owner');assert.equal(state.error,'');
 active=null;authCallback('SIGNED_OUT',null);state=await flush();assert.equal(state.session,null);assert.equal(state.profile,null);assert.equal(state.loading,false);
 appCallback('background');appCallback('active');
 console.log('PASS: saved session restore; token refresh does not freeze/reset profile; account role switches correctly; failed profile load retries; sign-out clears navigation state');
})().catch(e=>{console.error(e);process.exitCode=1;});
