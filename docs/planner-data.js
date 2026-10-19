/* Shared, dependency-free snapshot and schedule helpers. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlannerData = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const badKeys = new Set(['__proto__', 'constructor', 'prototype']);
  const LIMIT = 10000;
  function fail(message) { throw new Error(message || 'Not a supported USRSE’26 snapshot.'); }
  function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
    if (Object.keys(value).some(key => badKeys.has(key))) fail('Unsafe snapshot key.');
    return value;
  }
  function id(value) {
    if (typeof value !== 'string' || !value.length || value.length > 500 || badKeys.has(value)) fail('Invalid snapshot identifier.');
    return value;
  }
  function ids(value) {
    if (!Array.isArray(value) || value.length > LIMIT) fail('Too many selections or invalid selection list.');
    return [...new Set(value.map(id))];
  }
  function noteMap(value) {
    record(value);
    if (Object.keys(value).length > LIMIT) fail('Too many notes.');
    const result = {};
    for (const [key, text] of Object.entries(value)) {
      id(key);
      if (typeof text !== 'string' || text.length > 200000) fail('Invalid or oversized note.');
      result[key] = text;
    }
    return result;
  }
  function tasks(value) {
    if (!Array.isArray(value) || value.length > LIMIT) fail('Invalid or oversized follow-up list.');
    const seen = new Set();
    return value.map(task => {
      record(task);
      const key = id(task.id);
      if (seen.has(key)) fail('Duplicate follow-up identifier.');
      seen.add(key);
      if (typeof task.text !== 'string' || !task.text.trim() || task.text.length > 200000 || typeof task.done !== 'boolean') fail('Invalid follow-up.');
      const result = {...task, id:key, text:task.text, done:task.done};
      for (const field of ['sessionId', 'talkId']) if (task[field] !== undefined && task[field] !== null && task[field] !== '') result[field] = id(task[field]);
      return result;
    });
  }
  // Copy only JSON data, reject dangerous keys at every depth, and bound traversal.
  function safeCopy(value, depth = 0, budget = {count:0}) {
    if (depth > 40 || ++budget.count > 250000) fail('Snapshot structure is too large or deeply nested.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return value.map(item => safeCopy(item, depth + 1, budget));
    record(value);
    const result = {};
    for (const [key, item] of Object.entries(value)) result[key] = safeCopy(item, depth + 1, budget);
    return result;
  }
  function timestamp(value) {
    if (typeof value !== 'string' || value.length > 100 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) fail('Invalid note timestamp.');
    return value;
  }
  function quickNotes(value) {
    if (!Array.isArray(value) || value.length > LIMIT) fail('Invalid or oversized quick-note list.');
    const seen = new Set();
    return value.map(note => {
      record(note);
      const key = id(note.id);
      if (seen.has(key)) fail('Duplicate quick-note identifier.');
      seen.add(key);
      if (typeof note.text !== 'string' || note.text.length > 200000) fail('Invalid or oversized quick note.');
      const result = {...note, id:key, text:note.text, createdAt:timestamp(note.createdAt)};
      if (note.updatedAt !== undefined) result.updatedAt = timestamp(note.updatedAt);
      if (note.targetId !== undefined) result.targetId = id(note.targetId);
      return result;
    });
  }
  function normalizeSnapshot(input) {
    const raw = safeCopy(input);
    record(raw);
    if (raw.schema !== 'usrse26-planner') fail();
    if (Number.isInteger(raw.version) && raw.version > 3) fail('This snapshot uses a newer version (' + raw.version + '). Update the planner before restoring it.');
    if (![1, 2, 3].includes(raw.version)) fail('Unsupported snapshot version.');
    // Explicit migrations preserve all existing fields; normalization validates them next.
    if (raw.version === 1) { raw.version = 2; for (const [key,value] of Object.entries({interested:[],suggested:[],talkNotes:{},tasks:[]})) if (raw[key] === undefined) raw[key] = value; }
    if (raw.version === 2) { raw.version = 3; if (raw.quickNotes === undefined) raw.quickNotes = []; }
    const selected = ids(raw.selected);
    const result = {...raw, schema:'usrse26-planner', version:3, selected,
      interested:ids(raw.interested === undefined ? [] : raw.interested).filter(key => !selected.includes(key)),
      suggested:ids(raw.suggested === undefined ? [] : raw.suggested),
      notes:noteMap(raw.notes), talkNotes:noteMap(raw.talkNotes === undefined ? {} : raw.talkNotes),
      tasks:tasks(raw.tasks === undefined ? [] : raw.tasks), quickNotes:quickNotes(raw.quickNotes === undefined ? [] : raw.quickNotes)};
    if (raw.exportedAt !== undefined) timestamp(raw.exportedAt);
    if (new TextEncoder().encode(JSON.stringify(result)).length > 10000000) fail('Snapshot is too large (10 MB maximum).');
    return result;
  }
  function mergeExtra(a, b, known) {
    const result = {...a}, conflicts = [];
    for (const source of [a._mergeConflicts, b._mergeConflicts]) {
      if (source !== undefined) {
        if (!Array.isArray(source)) fail('Invalid preserved merge-conflict list.');
        conflicts.push(...source);
      }
    }
    for (const [key, value] of Object.entries(b)) {
      if (known.includes(key) || key === '_mergeConflicts') continue;
      if (!Object.prototype.hasOwnProperty.call(a,key)) result[key] = value;
      else if (JSON.stringify(a[key]) !== JSON.stringify(value)) conflicts.push({field:key,value});
    }
    if (conflicts.length) result._mergeConflicts = [...new Map(conflicts.map(item => [JSON.stringify(item),item])).values()];
    return result;
  }
  function mergeText(current, incoming) {
    if (!current) return incoming;
    if (!incoming || current === incoming) return current;
    // Repeated imports of the same note should not duplicate its contents.
    const separator = '\n\n--- Imported snapshot note ---\n';
    if (current.split(separator).includes(incoming)) return current;
    return current + separator + incoming;
  }
  function mergeNotes(current, incoming) {
    const result = {...current};
    for (const [key, text] of Object.entries(incoming)) result[key] = mergeText(Object.prototype.hasOwnProperty.call(result,key) ? result[key] : '', text);
    return result;
  }
  function mergeSnapshots(current, incoming) {
    const a = normalizeSnapshot(current), b = normalizeSnapshot(incoming);
    const mergedTasks = a.tasks.map(task => ({...task}));
    for (const task of b.tasks) {
      const existing = mergedTasks.find(t => t.id === task.id);
      if (!existing) { mergedTasks.push({...task}); continue; }
      if (existing.text === task.text && existing.sessionId === task.sessionId && existing.talkId === task.talkId) {
        Object.assign(existing, mergeExtra(existing,task,['id','text','done','sessionId','talkId']), {done:existing.done && task.done});
      } else {
        // Preserve both versions when a shared ID has divergent content or links.
        const stem = task.id.slice(0, 470) + '-imported';
        const equivalent = mergedTasks.find(t => t.id.startsWith(stem) && t.text === task.text && t.sessionId === task.sessionId && t.talkId === task.talkId);
        if (equivalent) { Object.assign(equivalent,mergeExtra(equivalent,task,['id','text','done','sessionId','talkId']), {done:equivalent.done && task.done}); continue; }
        let key = stem, count = 2;
        while (mergedTasks.some(t => t.id === key)) key = stem + '-' + count++;
        mergedTasks.push({...task, id:key});
      }
    }
    const mergedQuickNotes = a.quickNotes.map(note => ({...note}));
    for (const note of b.quickNotes) {
      let existing = mergedQuickNotes.find(n => n.id === note.id);
      const stem = note.id.slice(0,470) + '-imported';
      if (existing && (existing.text !== note.text || existing.targetId !== note.targetId)) {
        existing = mergedQuickNotes.find(n => n.id.startsWith(stem) && n.text === note.text && n.targetId === note.targetId);
        if (!existing) {
          let key = stem, count = 2;
          while (mergedQuickNotes.some(n => n.id === key)) key = stem + '-' + count++;
          mergedQuickNotes.push({...note,id:key});
          continue;
        }
      }
      if (!existing) mergedQuickNotes.push({...note});
      else Object.assign(existing,mergeExtra(existing,note,['id','text','targetId']));
    }
    const extras = mergeExtra(a,b,['schema','version','exportedAt','selected','interested','suggested','notes','talkNotes','tasks','quickNotes']);
    return normalizeSnapshot({...extras, schema:'usrse26-planner', version:3, exportedAt:new Date().toISOString(),
      selected:[...new Set([...a.selected, ...b.selected])], interested:[...new Set([...a.interested, ...b.interested])],
      suggested:[...new Set([...a.suggested, ...b.suggested])],
      notes:mergeNotes(a.notes,b.notes), talkNotes:mergeNotes(a.talkNotes,b.talkNotes), tasks:mergedTasks, quickNotes:mergedQuickNotes});
  }
  function comparePrograms(previousSessions, newSessions) {
    const previous = new Map(previousSessions.map(session => [session.id,session]));
    const next = new Map(newSessions.map(session => [session.id,session]));
    return {added:newSessions.filter(session => !previous.has(session.id)),
      removed:previousSessions.filter(session => !next.has(session.id)),
      changed:newSessions.flatMap(after => {
        const before = previous.get(after.id);
        const fields = before ? ['start','end','room','title'].filter(field => before[field] !== after[field]) : [];
        return fields.length ? [{id:after.id, before, after, fields}] : [];
      })};
  }
  function planningItems(sessions) {
    const result = [], seen = new Set(sessions.map(session => session.id));
    for (const session of sessions) {
      const parent = {...session, kind:'session'};
      delete parent.parentId;
      result.push(parent);
      for (const talk of session.talks || []) {
        const key = typeof talk.url === 'string' && /^https:\/\//.test(talk.url)
          ? 'talk:' + talk.url
          : 'talk:' + session.id + ':' + encodeURIComponent(talk.title || 'Untitled talk');
        // A repeated official talk link represents one selectable talk.
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({...parent, id:key, title:talk.title, talks:[talk], parentId:session.id,
          kind:'talk', slotTitle:session.title, timingUnknown:true});
      }
    }
    return result;
  }
  function conflicts(a, b) {
    return (a.parentId || a.id) !== (b.parentId || b.id)
      && Date.parse(a.start) < Date.parse(b.end)
      && Date.parse(b.start) < Date.parse(a.end);
  }
  function nowNext(sessions, selected, nowDate) {
    const now = new Date(nowDate === undefined ? Date.now() : nowDate).getTime();
    if (!Number.isFinite(now)) throw new Error('Invalid current time.');
    const chosen = new Set(selected);
    const planned = sessions.filter(session => chosen.has(session.id) && Number.isFinite(Date.parse(session.start)) && Number.isFinite(Date.parse(session.end)))
      .sort((a,b) => Date.parse(a.start) - Date.parse(b.start));
    const current = planned.filter(session => Date.parse(session.start) <= now && now < Date.parse(session.end));
    const upcoming = planned.filter(session => Date.parse(session.start) > now);
    return {current, next:upcoming.length ? upcoming.filter(session => Date.parse(session.start) === Date.parse(upcoming[0].start)) : []};
  }
  return {normalizeSnapshot, mergeSnapshots, comparePrograms, planningItems, conflicts, nowNext};
});
