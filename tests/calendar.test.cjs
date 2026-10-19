const {test}=require('node:test');const assert=require('node:assert/strict');const {build}=require('../docs/calendar.js');
test('calendar text and IDs cannot inject properties through CR or LF',()=>{
 const item={id:'talk:evil\r\nEND:VEVENT',title:'a\rb\nc\r\nd',room:'Room\rATTENDEE:bad',start:'2026-10-19T10:30:00-07:00',end:'2026-10-19T12:00:00-07:00',kind:'talk',slotTitle:'Demo'};
 const output=build([item],{}, {[item.id]:'Note\rBEGIN:VEVENT'}).replace(/\r\n /g,'');
 assert.equal(output.split('\r\n').filter(l=>l==='BEGIN:VEVENT').length,1);
 assert.equal(output.split('\r\n').filter(l=>l==='END:VEVENT').length,1);
 assert.ok(output.includes('UID:talk%3Aevil%0D%0AEND%3AVEVENT'));
 assert.ok(output.includes('SUMMARY:[Session window] a\\nb\\nc\\nd'));
 assert.ok(output.includes('DTSTART:20261019T173000Z'));
});
