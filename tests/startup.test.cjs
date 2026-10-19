const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const data=require('../docs/program.json');
test('corrupt program cache does not hide or replace a valid personal plan',async()=>{
  const nodes=new Map();
  const node=key=>{if(!nodes.has(key))nodes.set(key,{value:'',textContent:'',innerHTML:'',append(){},classList:{toggle(){}}});return nodes.get(key);};
  const personal={schema:'usrse26-planner',version:1,selected:[data.sessions[0].id],notes:{[data.sessions[0].id]:'Keep this note'}};
  const context=vm.createContext({ProgramUpdate:require('../docs/program-update.js'),PlannerStorage:require('../docs/planner-storage.js'),window:{PlannerData:require('../docs/planner-data.js'),FieldnotesNotes:{}},document:{querySelector:node,querySelectorAll:()=>[],createElement:()=>node('option')},localStorage:{getItem:key=>key==='usrse26-program-cache'?'{broken':key==='usrse26-fieldnotes-v1'?JSON.stringify(personal):null,setItem(){throw Error('Unexpected write during startup');}},fetch:async()=>({ok:true,json:async()=>data}),Intl,Date,Set,Map,setInterval(){},console});
  vm.runInContext(fs.readFileSync(require.resolve('../docs/app.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(node('#count').textContent,1);
  assert.equal(vm.runInContext('notes[sessions[0].id]',context),'Keep this note');
});
