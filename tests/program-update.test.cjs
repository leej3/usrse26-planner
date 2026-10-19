const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('../docs/program-update.js');
const current=require('../docs/program.json').sessions;
function text(sessions){return sessions.map(s=>`### x — ${s.title}\n- Time: ${s.start} to ${s.end}\n- Room: ${s.room}\n- Type: ${s.type}\n${s.talks.map(t=>`#### ${t.title}\n- Abstract page: ${t.url}\nAbstract:\n> ${t.abstract}`).join('\n')}`).join('\n');}
test('parses whole program and preserves existing identities',()=>{const parsed=parse(text(current),current);assert.equal(parsed.length,51);assert.equal(parsed.reduce((n,s)=>n+s.talks.length,0),83);assert.deepEqual(parsed.map(s=>s.id),current.map(s=>s.id));});
test('title and time changes preserve identity through a talk URL',()=>{const changed=structuredClone(current);const s=changed.find(s=>s.talks.length);const old=s.id;s.title='Updated session title';s.start=s.start.replace('08:30','08:45');const result=parse(text(changed),current);assert.equal(result.find(x=>x.title===s.title).id,old);});
test('rejects incomplete response',()=>assert.throws(()=>parse('server error',current)));
test('cached program validation rejects unsafe shapes before rendering',()=>{
 const {validateSessions}=require('../docs/program-update.js');
 const bad=structuredClone(current);bad[0].start=123;
 assert.throws(()=>validateSessions(bad));
 const missingTalk=structuredClone(current);missingTalk[1].talks=[null];assert.throws(()=>validateSessions(missingTalk));
});
test('cached program rejects duplicate and prototype-name identities',()=>{
 const {validateSessions}=require('../docs/program-update.js');
 for(const id of ['','toString','__proto__']){const bad=structuredClone(current);bad[0].id=id;assert.throws(()=>validateSessions(bad));}
 const duplicate=structuredClone(current);duplicate[0].id=duplicate[1].id;assert.throws(()=>validateSessions(duplicate));
 const badType=structuredClone(current);badType[0].type={};assert.throws(()=>validateSessions(badType));
});
