const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const program=require('../docs/program.json');const primary='usrse26-fieldnotes-v3',legacy='usrse26-fieldnotes-v1';
async function app(seed={}){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../docs/index.html'),'utf8'),{url:'https://example.test/usrse26-planner/',runScripts:'outside-only'});const w=dom.window;
 w.fetch=async()=>({ok:true,json:async()=>structuredClone(program)});w.TextEncoder=TextEncoder;w.setInterval=()=>0;w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const [key,value] of Object.entries(seed))w.localStorage.setItem(key,value);
 for(const file of ['planner-data.js','planner-storage.js','calendar.js','program-update.js','notes.js','app.js'])w.eval(fs.readFileSync(path.join(__dirname,'../docs',file),'utf8'));
 await new Promise(resolve=>setImmediate(resolve));return {dom,w,$:s=>w.document.querySelector(s)};
}
test('quick capture autosaves v3, preserves v1 bytes, and supports undo',async t=>{
 const raw=JSON.stringify({schema:'usrse26-planner',version:1,selected:[],notes:{old:'Keep forever'},customMetadata:{value:'future extension'}});
 const {dom,w,$}=await app({[legacy]:raw});t.after(()=>dom.window.close());
 $('#quick-capture').click();$('#quick-text').value='Idea <img src=x onerror=alert(1)>';$('#quick-text').dispatchEvent(new w.Event('input'));
 let saved=JSON.parse(w.localStorage.getItem(primary));assert.equal(saved.version,3);assert.equal(saved.quickNotes[0].text,'Idea <img src=x onerror=alert(1)>');assert.equal(saved.notes.old,'Keep forever');assert.equal(saved.customMetadata.value,'future extension');assert.equal(w.localStorage.getItem(legacy),raw);
 $('#quick-close').click();$('#followups').click();assert.equal($('#quick-list img'),null);
 $('#undo').click();saved=JSON.parse(w.localStorage.getItem(primary));assert.equal(saved.quickNotes.length,0);assert.equal(saved.notes.old,'Keep forever');
});
test('future-version data cannot be overwritten by an older app',async t=>{
 const raw=JSON.stringify({schema:'usrse26-planner',version:999,notes:{valuable:'Never discard'}});
 const {dom,w,$}=await app({[primary]:raw});t.after(()=>dom.window.close());
 assert.equal($('#storage-status').hidden,false);$('#quick-capture').click();$('#quick-text').value='Unsaved memory note';$('#quick-text').dispatchEvent(new w.Event('input'));
 assert.equal(w.localStorage.getItem(primary),raw);assert.match($('#quick-status').textContent,/Not saved/);
});
test('editing and deleting a legacy follow-up can be undone',async t=>{
 const raw=JSON.stringify({schema:'usrse26-planner',version:2,selected:[],notes:{},tasks:[{id:'task1',text:'Call speaker',done:false,extra:'retain'}]});
 const {dom,w,$}=await app({[legacy]:raw});t.after(()=>dom.window.close());
 $('#followups').click();$('#task-list button[aria-label="Delete follow-up: Call speaker"]').click();assert.equal(JSON.parse(w.localStorage.getItem(primary)).tasks.length,0);
 $('#undo').click();const saved=JSON.parse(w.localStorage.getItem(primary));assert.equal(saved.tasks[0].text,'Call speaker');assert.equal(saved.tasks[0].extra,'retain');
});
