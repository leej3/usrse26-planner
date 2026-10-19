(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PlannerCalendar=api;})(typeof window==='undefined'?null:window,function(){
  'use strict';
  // Every text property is escaped, including lone carriage returns from imports.
  const text=value=>String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  function fold(line){let result='',part='';for(const char of line){if(new TextEncoder().encode(part+char).length>73){result+=part+'\r\n';part=' ';}part+=char;}return result+part;}
  function build(items,notes={},talkNotes={},now=new Date()){
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//USRSE26 Fieldnotes//Planner//EN','CALSCALE:GREGORIAN'];
    for(const item of items){const isTalk=item.kind==='talk';const description=(isTalk?'Exact talk time unpublished. This event holds the full session window for '+item.slotTitle+'.\n':'')+(isTalk?talkNotes[item.id]||'':notes[item.id]||'')+'\nhttps://us-rse.org/usrse26/program/';
      lines.push('BEGIN:VEVENT','UID:'+encodeURIComponent(item.id)+'@usrse26-fieldnotes','DTSTAMP:'+stamp(now),'DTSTART:'+stamp(item.start),'DTEND:'+stamp(item.end),'SUMMARY:'+text((isTalk?'[Session window] ':'')+item.title),'LOCATION:'+text(item.room),'DESCRIPTION:'+text(description),'END:VEVENT');
    }
    return [...lines,'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
  }
  return {build};
});
