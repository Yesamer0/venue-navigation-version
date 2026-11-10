const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),path=require('node:path');
let slots=[],hook=0,effect,dialog,calls=[];
const react={useRef:v=>{const i=hook++;return slots[i]??={current:v};},useState:v=>{const i=hook++;if(!(i in slots))slots[i]=v;return[slots[i],x=>slots[i]=typeof x==='function'?x(slots[i]):x];},useCallback:f=>f,createElement:(type,props,...children)=>({type,props,children})};react.default=react;
const native={ActivityIndicator:'Spinner',Image:'Image',Text:'Text',TouchableOpacity:'Button',View:'View',StyleSheet:{create:x=>x},Alert:{alert:(title,body,options)=>dialog=options}};
const post={id:'post',user_id:'visitor',username:'gezgin',created_at:new Date().toISOString(),storage_path:'path.jpg',venue_name:'deneme',is_mine:true,like_count:1};
const Comments=()=>null;
const supabase={storage:{from:()=>({remove:async()=>({error:null})})},rpc:async(name,args)=>{calls.push({name,args});return {data:name==='list_venue_moments'?[post]:null};}};
const exports_={};
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../MomentFeed.js'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{exports:exports_,require:id=>({react,'react-native':native,'@react-navigation/native':{useFocusEffect:f=>effect=f},'./supabase':{supabase},'./momentApi':{friendlyError:e=>e.message,PAGE_SIZE:20,photoUrl:p=>p},'./MomentComments':{default:Comments}}[id]),Date,Set,Math,setInterval:()=>1,clearInterval:()=>{}});
const Feed=exports_.default,all=t=>!t||typeof t!=='object'?[]:[t,...t.children.flat(Infinity).flatMap(all)];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 for(const profile of [true,false]){
  slots=[];calls=[];const render=()=>{hook=0;return Feed({userId:profile?'visitor':null,venueId:profile?null:'venue',navigation:{navigate:()=>{}}});};
  render();effect();await tick();let tree=render();assert.ok(all(tree).some(n=>n.props?.momentId==='post'));
  const remove=all(tree).find(n=>n.type==='Button'&&all(n).some(c=>c.children.includes('Fotoğrafımı sil')));assert.ok(remove);
  remove.props.onPress();await dialog.find(x=>x.text==='Sil').onPress();
  assert.equal(calls.at(-1).name,'delete_venue_moment');assert.ok(!calls.some(c=>c.name==='hide_photo_from_profile'));
  assert.equal(all(render()).filter(n=>n.type==='Image').length,0);
 }
 post.is_mine=false;slots=[];hook=0;Feed({venueId:'venue',navigation:{}});effect();await tick();hook=0;
 const ownerView=Feed({venueId:'venue',navigation:{}});assert.ok(!all(ownerView).some(n=>n.children.includes('Fotoğrafımı sil')));
 console.log('PASS: cafe/profile share comment thread; author deletion uses the same API in both views; foreign photo has no delete control');
})().catch(e=>{console.error(e);process.exitCode=1;});
