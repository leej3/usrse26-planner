(function (root) {
  'use strict';
  function validateSessions(sessions) {
    const string=(x,max=200000)=>typeof x==='string'&&x.length<=max;
    const safeId=id=>string(id,500)&&id.length>0&&!Object.prototype.hasOwnProperty.call(Object.prototype,id)&&!['__proto__','prototype'].includes(id)&&!/[\x00-\x1f]/.test(id);
    if(!Array.isArray(sessions)||!sessions.length||sessions.length>500||sessions.some(s=>!s||!safeId(s.id)||!string(s.title,2000)||!string(s.room,2000)||(s.type!==undefined&&!string(s.type,2000))||(s.chair!==undefined&&!string(s.chair,2000))||(s.notes!==undefined&&!string(s.notes))||!string(s.start,100)||!string(s.end,100)||!Number.isFinite(Date.parse(s.start))||!Number.isFinite(Date.parse(s.end))||Date.parse(s.end)<=Date.parse(s.start)||!Array.isArray(s.talks)||s.talks.length>500||s.talks.some(t=>!t||!string(t.title,2000)||(t.abstract!==undefined&&!string(t.abstract))||(t.url!==undefined&&!string(t.url,2000))||(t.presenters!==undefined&&!string(t.presenters,10000)))))throw Error('Invalid cached program');
    if(new Set(sessions.map(s=>s.id)).size!==sessions.length)throw Error('Duplicate program identities');
    return sessions;
  }
  function parse(text, previous = []) {
    if(typeof text!=='string'||text.length>5000000)throw Error('Program response too large');
    const field = (body, name) => (body.match(new RegExp('^- '+name+': (.+)$', 'm')) || [,''])[1];
    const sessions = text.split(/^### /m).slice(1).map(block => {
      block = block.split(/^## /m)[0];
      const split = block.indexOf('\n'), heading = block.slice(0, split), body = block.slice(split + 1);
      const timing = body.match(/^- Time: (\S+) to (\S+)/m);
      if (!timing || !heading.includes(' — ')) throw new Error('Unrecognized program format');
      const title = heading.split(' — ').slice(1).join(' — ');
      const [intro, ...parts] = body.split(/^#### /m);
      const talks = parts.map(part => {
        const i = part.indexOf('\n'), rest = part.slice(i + 1);
        return {title:part.slice(0,i), presenters:field(rest,'Presenters'),url:field(rest,'Abstract page'),abstract:(rest.split('Abstract:')[1] || '').trim().replace(/^> ?/gm,'')};
      });
      return {id:timing[1].slice(0,10)+'-'+title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),title,start:timing[1],end:timing[2],room:field(body,'Room'),type:field(body,'Type'),chair:field(body,'Chair'),talks,notes:(intro.split('About this session:')[1]||'').trim()};
    });
    if (sessions.length < 10 || sessions.length > 500 || sessions.some(s=>!Number.isFinite(Date.parse(s.start)) || !Number.isFinite(Date.parse(s.end)) || Date.parse(s.end)<=Date.parse(s.start))) throw new Error('Program could not be safely read; keeping your existing schedule.');
    // Preserve local identities when a session changes day or title.
    const claimed = new Set();
    for (const session of sessions) {
      let matches = previous.filter(p => !claimed.has(p.id) && p.id === session.id);
      if (!matches.length) matches = previous.filter(p => !claimed.has(p.id) && p.title === session.title);
      if (!matches.length && session.talks.length) matches = previous.filter(p=>!claimed.has(p.id) && (p.talks||[]).some(t=>t.url && session.talks.some(n=>n.url===t.url)));
      if (matches.length === 1) { session.id = matches[0].id; claimed.add(session.id); }
    }
    if (new Set(sessions.map(s=>s.id)).size !== sessions.length) throw new Error('Ambiguous session identities; keeping your existing schedule.');
    return validateSessions(sessions);
  }
  const api = {parse,validateSessions};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ProgramUpdate = api;
})(typeof window !== 'undefined' ? window : globalThis);
