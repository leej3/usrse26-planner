'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {normalizeSnapshot, mergeSnapshots, comparePrograms, nowNext} = require('../docs/planner-data.js');
const base = () => ({schema:'usrse26-planner',version:1,selected:['a'],notes:{a:'Local note'}});
test('legacy snapshots migrate and attendance takes priority over interest', () => {
  const old = normalizeSnapshot(base());
  assert.equal(old.version,2);
  assert.deepEqual(old.tasks,[]);
  assert.deepEqual(normalizeSnapshot({...old,interested:['a','b','b']}).interested,['b']);
});
test('rejects prototype keys, malformed types, overlarge collections and notes', () => {
  for (const value of [JSON.parse('{"__proto__": "oops"}'), {constructor:'bad'}]) assert.throws(() => normalizeSnapshot({...base(),notes:value}));
  assert.throws(() => normalizeSnapshot({...base(),selected:['__proto__']}));
  assert.throws(() => normalizeSnapshot({...base(),notes:{a:'x'.repeat(200001)}}));
  assert.throws(() => normalizeSnapshot({...base(),interested:Array(10001).fill('a')}));
  assert.throws(() => normalizeSnapshot({...base(),tasks:[{id:'a',text:'a',done:'false'}]}));
  assert.throws(() => normalizeSnapshot({...base(),version:3}));
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
