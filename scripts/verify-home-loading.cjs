const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('HomeScreen.js','utf8');
let venues=[],error=false,loading=false,pending=[];
const context={venuesRequestRef:{current:0},setLoading:v=>loading=v,setVenues:v=>venues=v,setLoadError:v=>error=v,supabase:{from:()=>({select:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))})}};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  const fetchVenues ='),source.indexOf('  const fetchRatings =')).replace('const fetchVenues =','globalThis.fetchVenues ='),context);
(async()=>{
 let request=context.fetchVenues();pending.shift().resolve({error:{message:'offline'}});await request;assert.equal(error,true);assert.equal(venues.length,0);assert.equal(loading,false);
 request=context.fetchVenues();pending.shift().resolve({data:[{id:'original'}]});await request;assert.equal(error,false);assert.equal(venues[0].id,'original');
 request=context.fetchVenues();pending.shift().reject(Error('offline'));await request;assert.equal(error,true);assert.equal(venues[0].id,'original');
 const older=context.fetchVenues(),newer=context.fetchVenues();const first=pending.shift(),second=pending.shift();second.resolve({data:[{id:'new'}]});await newer;first.resolve({data:[{id:'old'}]});await older;assert.equal(venues[0].id,'new');assert.equal(error,false);
 request=context.fetchVenues();pending.shift().resolve({data:[]});await request;assert.equal(venues.length,0);assert.equal(error,false);
 console.log('PASS: initial offline, retry, preserve last venues, network rejection, out-of-order requests, successful empty result');
})().catch(e=>{console.error(e);process.exitCode=1;});
