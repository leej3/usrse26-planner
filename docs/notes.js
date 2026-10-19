'use strict';
// Browser-only note and follow-up controls. Callbacks receive complete new values.
window.FieldnotesNotes = (() => {
  let sequence = 0;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key) ? object[key] : '';
  function talkId(session, talk) {
    // Official anchors survive title corrections and changes to session placement.
    if (typeof talk.url === 'string' && /^https:\/\//.test(talk.url)) return 'talk:' + talk.url;
    return 'talk:' + session.id + ':' + encodeURIComponent(talk.title || 'Untitled talk');
  }
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function mountTalkNotes(container, session, talkNotes, onChange) {
    container.replaceChildren();
    let current = {...talkNotes};
    for (const talk of session.talks || []) {
      const id = talkId(session, talk);
      const section = element('section', undefined, 'talk-note');
      const inputId = 'talk-note-' + (++sequence);
      const label = element('label', 'Notes: ' + talk.title);
      label.htmlFor = inputId;
      const input = element('textarea');
      input.id = inputId;
      input.rows = 3;
      input.maxLength = 200000;
      input.placeholder = 'Questions, ideas, people to contact…';
      input.value = own(current, id) || '';
      const savedStatus = element('small', 'Private to this browser · included in snapshots');
      savedStatus.setAttribute('role', 'status');
      input.addEventListener('input', () => {
        current = {...current};
        if (input.value) current[id] = input.value;
        else delete current[id];
        savedStatus.textContent = onChange({...current}) === false ? 'Not saved — download a snapshot before leaving' : 'Saved in this browser';
      });
      section.append(label, input, savedStatus);
      container.append(section);
    }
  }
  function mountTasks(container, tasks, onChange) {
    container.replaceChildren();
    let current = tasks.map(task => ({...task}));
    const form = element('form', undefined, 'followup-form');
    const inputId = 'followup-' + (++sequence);
    const label = element('label', 'New follow-up');
    label.htmlFor = inputId;
    const input = element('input');
    input.id = inputId;
    input.type = 'text';
    input.maxLength = 2000;
    input.placeholder = 'Contact a speaker, try a tool…';
    const add = element('button', 'Add follow-up');
    add.type = 'submit';
    form.append(label, input, add);
    const list = element('ul', undefined, 'followup-list');
    const status = element('p', undefined, 'followup-status');
    status.setAttribute('role', 'status');
    let saveFailed = false;
    const save = () => { saveFailed = onChange(current.map(task => ({...task}))) === false; };
    const updateStatus = () => { status.textContent = saveFailed ? 'Not saved — download a snapshot before leaving' : current.length ? current.filter(task => !task.done).length + ' remaining · ' + current.length + ' total' : 'No follow-ups yet.'; };
    const commit = () => { save(); draw(); };
    function draw() {
      list.replaceChildren();
      updateStatus();
      for (const task of current) {
        const item = element('li', undefined, 'followup-item');
        const checkbox = element('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(task.done);
        checkbox.setAttribute('aria-label', 'Mark complete: ' + task.text);
        checkbox.addEventListener('change', () => {
          current = current.map(value => value.id === task.id ? {...value, done: checkbox.checked} : value);
          save();
          item.classList.toggle('completed', checkbox.checked);
          updateStatus();
        });
        const text = element('input');
        text.type = 'text';
        text.value = task.text;
        text.maxLength = 2000;
        text.setAttribute('aria-label', 'Edit follow-up');
        text.addEventListener('change', () => {
          const value = text.value.trim();
          if (!value) { text.value = task.text; return; }
          current = current.map(entry => entry.id === task.id ? {...entry, text: value} : entry);
          save();
          updateStatus();
          checkbox.setAttribute('aria-label', 'Mark complete: ' + value);
        });
        const remove = element('button', 'Delete');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Delete follow-up: ' + task.text);
        remove.addEventListener('click', () => {
          current = current.filter(value => value.id !== task.id);
          commit();
          input.focus();
        });
        item.classList.toggle('completed', Boolean(task.done));
        item.append(checkbox, text, remove);
        list.append(item);
      }
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now() + '-' + (++sequence);
      current.push({id, text, done: false});
      input.value = '';
      commit();
      input.focus();
    });
    container.append(form, status, list);
    draw();
  }
  // Metadata is escaped for Markdown; personal note text remains editable Markdown.
  const md = value => String(value || '').replace(/[\\`*_{}\[\]<>#|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
  function markdownExport(sessions, sessionNotes, talkNotes, tasks) {
    const lines = ['# USRSE’26 fieldnotes', '', '## Follow-ups', ''];
    for (const task of tasks) lines.push('- [' + (task.done ? 'x' : ' ') + '] ' + md(task.text));
    if (!tasks.length) lines.push('No follow-ups.');
    const seenSessions = new Set(), seenTalks = new Set();
    for (const session of sessions) {
      const related = (session.talks || []).filter(talk => own(talkNotes, talkId(session, talk)));
      const note = own(sessionNotes, session.id);
      if (!note && !related.length) continue;
      seenSessions.add(session.id);
      lines.push('', '## ' + md(session.title), '', md(session.start) + ' · ' + md(session.room), '');
      if (note) lines.push(note, '');
      for (const talk of related) {
        const id = talkId(session, talk);
        seenTalks.add(id);
        lines.push('### ' + md(talk.title), '', own(talkNotes, id), '');
      }
    }
    const older = [...Object.entries(sessionNotes).filter(([id]) => !seenSessions.has(id)), ...Object.entries(talkNotes).filter(([id]) => !seenTalks.has(id))];
    if (older.length) {
      lines.push('', '## Notes outside the current program', '');
      for (const [id, note] of older) if (note) lines.push('### ' + md(id), '', note, '');
    }
    return lines.join('\n').trimEnd() + '\n';
  }
  return {talkId, mountTalkNotes, mountTasks, markdownExport};
})();
