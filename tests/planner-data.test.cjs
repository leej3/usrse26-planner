'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {normalizeSnapshot, mergeSnapshots, comparePrograms, planningItems, conflicts, nowNext} = require('../docs/planner-data.js');
const base = () => ({schema:'usrse26-planner',version:1,selected:['a'],notes:{a:'Local note'}});
test('legacy snapshots migrate and attendance takes priority over interest', () => {
  const old = normalizeSnapshot(base());
  assert.equal(old.version,3);
  assert.deepEqual(old.tasks,[]);
  assert.deepEqual(normalizeSnapshot({...old,interested:['a','b','b']}).interested,['b']);
});
test('rejects prototype keys, malformed types, overlarge collections and notes', () => {
  for (const value of [JSON.parse('{"__proto__": "oops"}'), {constructor:'bad'}]) assert.throws(() => normalizeSnapshot({...base(),notes:value}));
  assert.throws(() => normalizeSnapshot({...base(),selected:['__proto__']}));
  assert.throws(() => normalizeSnapshot({...base(),notes:{a:'x'.repeat(200001)}}));
  assert.throws(() => normalizeSnapshot({...base(),interested:Array(10001).fill('a')}));
  assert.throws(() => normalizeSnapshot({...base(),tasks:[{id:'a',text:'a',done:'false'}]}));
  assert.throws(() => normalizeSnapshot({...base(),version:4}));
});
test('merges divergent notes without destroying either and is repeatable', () => {
  const incoming = {...base(), selected:['b'], interested:['a','c'], notes:{a:'Remote note'},talkNotes:{talk:'Question'}};
  const merged = mergeSnapshots(base(),incoming);
  assert.deepEqual(merged.selected,['a','b']);
  assert.deepEqual(merged.interested,['c']);
  assert.match(merged.notes.a,/Local note[\s\S]*Remote note/);
  assert.equal(mergeSnapshots(merged,incoming).notes.a,merged.notes.a);
  assert.equal(merged.talkNotes.talk,'Question');
});
test('preserves conflicting task versions and incomplete status', () => {
  const current = {...base(),tasks:[{id:'t',text:'Ask Alice',done:true}]};
  const incoming = {...base(),tasks:[{id:'t',text:'Ask Bob',done:false}]};
  const merged = mergeSnapshots(current,incoming);
  assert.equal(merged.tasks.length,2);
  assert.equal(mergeSnapshots(merged,incoming).tasks.length,2);
  assert.equal(mergeSnapshots(current,{...base(),tasks:[{id:'t',text:'Ask Alice',done:false}]}).tasks[0].done,false);
});
test('detects program additions, removals, and changed time, title, room', () => {
  const before = [{id:'a',title:'Old',start:'one',end:'two',room:'A'}, {id:'removed'}];
  const after = [{id:'a',title:'New',start:'three',end:'four',room:'B'},{id:'added'}];
  const changes = comparePrograms(before,after);
  assert.deepEqual(changes.changed[0].fields,['start','end','room','title']);
  assert.equal(changes.added[0].id,'added');
  assert.equal(changes.removed[0].id,'removed');
  assert.equal(comparePrograms(after,after).changed.length,0);
});
test('now/next handles offsets, exact boundaries, overlapping alternatives and conference end', () => {
  const sessions = [
    {id:'a',start:'2026-10-19T08:30:00-07:00',end:'2026-10-19T10:00:00-07:00'},
    {id:'b',start:'2026-10-19T10:00:00-07:00',end:'2026-10-19T11:00:00-07:00'},
    {id:'c',start:'2026-10-19T17:00:00Z',end:'2026-10-19T18:00:00Z'},
    {id:'unselected',start:'2026-10-19T09:00:00-07:00',end:'2026-10-19T11:00:00-07:00'}];
  const selected = ['a','b','c'];
  const morning = nowNext(sessions,selected,'2026-10-19T16:00:00Z');
  assert.deepEqual(morning.current.map(s=>s.id),['a']);
  assert.deepEqual(morning.next.map(s=>s.id),['b','c']);
  assert.deepEqual(nowNext(sessions,selected,'2026-10-19T17:00:00Z').current.map(s=>s.id),['b','c']);
  assert.deepEqual(nowNext(sessions,selected,'2026-10-22T00:00:00Z'),{current:[],next:[]});
});

test('suggestions default empty for older snapshots and remain independent of attendance', () => {
  assert.deepEqual(normalizeSnapshot(base()).suggested, []);
  assert.deepEqual(normalizeSnapshot({...base(),version:2}).suggested, []);
  const current = {...base(),suggested:['a','c','a']};
  assert.deepEqual(normalizeSnapshot(current).suggested,['a','c']);
  const merged = mergeSnapshots(current,{...base(),selected:['c'],interested:['d'],suggested:['d','a']});
  assert.deepEqual(merged.suggested,['a','c','d']);
  assert.deepEqual(merged.selected,['a','c']);
  assert.deepEqual(merged.interested,['d']);
  assert.throws(() => normalizeSnapshot({...base(),suggested:['__proto__']}));
  assert.throws(() => normalizeSnapshot({...base(),suggested:'a'}));
});

test('talk planning items preserve identities and distinguish uncertain same-slot timing', () => {
  const slots = [{id:'slot-a',title:'Slot A',start:'2026-10-19T10:30:00-07:00',end:'2026-10-19T12:00:00-07:00',room:'A',talks:[
    {title:'First talk',url:'https://example.org/talk/first'},
    {title:'Second talk'},
    {title:'Duplicate',url:'https://example.org/talk/first'}
  ]},{id:'slot-b',title:'Slot B',start:'2026-10-19T17:30:00Z',end:'2026-10-19T19:00:00Z',talks:[{title:'Parallel',url:'https://example.org/talk/parallel'}]}];
  const items = planningItems(slots);
  assert.equal(items.length,5);
  assert.equal(new Set(items.map(item=>item.id)).size,5);
  const first = items.find(item=>item.id==='talk:https://example.org/talk/first');
  const second = items.find(item=>item.id==='talk:slot-a:Second%20talk');
  const parallel = items.find(item=>item.id==='talk:https://example.org/talk/parallel');
  assert.equal(first.parentId,'slot-a');
  assert.equal(first.slotTitle,'Slot A');
  assert.equal(first.timingUnknown,true);
  assert.equal(first.talks.length,1);
  assert.equal(first.room,'A');
  assert.equal(items[0].kind,'session');
  assert.equal(items[0].parentId,undefined);
  assert.equal(conflicts(first,second),false);
  assert.equal(conflicts(items[0],first),false);
  assert.equal(conflicts(first,parallel),true);
  assert.equal(conflicts(first,{...parallel,start:first.end,end:'2026-10-19T20:00:00Z'}),false);
  assert.equal(slots[0].kind,undefined);
});

test('versioned fixtures migrate idempotently without losing text or extensions', () => {
  for (const version of [1,2,3]) {
    const source = require('./fixtures/v'+version+'.json');
    const normalized = normalizeSnapshot(source);
    assert.equal(normalized.version,3);
    assert.deepEqual(normalized.notes,source.notes);
    assert.deepEqual(normalized.custom,source.custom);
    assert.deepEqual(normalizeSnapshot(normalized),normalized);
    if(version>=2) assert.equal(normalized.tasks[0].priority,'high');
    if(version===3) assert.deepEqual(normalized.quickNotes[0].tags,['idea']);
  }
  const long = 'x'.repeat(200000);
  assert.equal(normalizeSnapshot({...base(),notes:{a:long}}).notes.a,long);
});
test('future versions reject clearly and nested dangerous extension keys reject', () => {
  assert.throws(()=>normalizeSnapshot({...base(),version:4}),/newer version.*Update the planner/);
  assert.throws(()=>normalizeSnapshot({...base(),custom:JSON.parse('{"nested":{"__proto__":true}}')}),/Unsafe snapshot key/);
  assert.throws(()=>normalizeSnapshot({...base(),tasks:[{id:'t',text:'a',done:false,extra:JSON.parse('{"constructor":true}')}]}),/Unsafe snapshot key/);
});
test('merge preserves conflicting root and task extension values', () => {
  const a = {...base(),custom:{theme:'blue'},tasks:[{id:'t',text:'Ask',done:false,priority:'high'}]};
  const b = {...base(),custom:{theme:'red'},newFeature:42,tasks:[{id:'t',text:'Ask',done:true,priority:'low'}]};
  const merged = mergeSnapshots(a,b);
  assert.deepEqual(merged.custom,{theme:'blue'});
  assert.equal(merged.newFeature,42);
  assert.deepEqual(merged._mergeConflicts,[{field:'custom',value:{theme:'red'}}]);
  assert.deepEqual(merged.tasks[0]._mergeConflicts,[{field:'priority',value:'low'}]);
  assert.deepEqual(mergeSnapshots(merged,b)._mergeConflicts,merged._mergeConflicts);
});
test('quick note merge preserves divergent text, metadata, and stable links', () => {
  const note = {id:'q',text:'Local idea',createdAt:'2026-10-19T17:00:00Z',targetId:'talk:https://example.org/talk',color:'blue'};
  const a = {...base(),quickNotes:[note]};
  const b = {...base(),quickNotes:[{...note,text:'Remote idea',color:'red'}]};
  const merged = mergeSnapshots(a,b);
  assert.deepEqual(merged.quickNotes.map(n=>n.text),['Local idea','Remote idea']);
  assert.equal(mergeSnapshots(merged,b).quickNotes.length,2);
  const metadata = mergeSnapshots(a,{...base(),quickNotes:[{...note,color:'red'}]});
  assert.deepEqual(metadata.quickNotes[0]._mergeConflicts,[{field:'color',value:'red'}]);
  assert.throws(()=>normalizeSnapshot({...base(),quickNotes:[{...note,createdAt:'bad'}]}));
  assert.throws(()=>normalizeSnapshot({...base(),quickNotes:[{...note,targetId:'__proto__'}]}));
});

test('ordinary names shared with Object.prototype remain valid note keys', () => {
  const merged = mergeSnapshots({...base(),notes:{toString:'Local'}},{...base(),notes:{toString:'Imported',valueOf:'Question'}});
  assert.equal(merged.notes.valueOf,'Question');
  assert.match(merged.notes.toString,/Local[\s\S]*Imported/);
  assert.equal(Object.getPrototypeOf(merged.notes),Object.prototype);
  assert.equal(typeof Object.prototype.toString,'function');
});
