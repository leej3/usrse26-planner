/* Private, browser-local persistence. No requests or telemetry.
 * create(storage, normalize): storage is a localStorage-compatible adapter;
 * normalize must validate and migrate a parsed snapshot or throw.
 * Canonical v3 storage is separate from the readonly legacy v1 fallback;
 * older clients can never overwrite this version’s saved plan.
 * load never writes. save returns {ok,error?}; load returns
 * {snapshot,blocked,error?,raw?}. Errors are user-facing, never raw data.
 * checkpoints() returns valid recoverable snapshots, newest first.
 * recoveryEntries() includes unsupported originals as raw text for local download;
 * callers must never render raw text as HTML or send it to a server.
 * restore(id)/undo() explicitly authorize replacing blocked data, first saving
 * its exact raw bytes. Undo is single-step until a new successful ordinary save
 * (explicit recovery checkpoints remain selectable). exportRaw() returns the primary bytes for local download.
 * Call load before editing. On concurrency failure reload and merge snapshots;
 * a failed save does not imply the caller's in-memory edits were persisted.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PlannerStorage=api;})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const KEY='usrse26-fieldnotes-v3', LEGACY='usrse26-fieldnotes-v1', HISTORY=KEY+'-recovery', MAX=5;
  const EMPTY={schema:'usrse26-planner',version:3,selected:[],interested:[],suggested:[],notes:{},talkNotes:{},tasks:[]};
  const warning='This plan changed in another tab. Download your current edits, then reload and merge them before saving.';
  function create(storage,normalize){
    let loaded=false,blocked=false,expected=null,firstSave=true,undoUsed=false,source=KEY;
    function history(){const raw=storage.getItem(HISTORY);if(!raw)return [];const list=JSON.parse(raw);if(!Array.isArray(list)||list.some(x=>!x||typeof x.id!=='string'||typeof x.raw!=='string'||typeof x.at!=='string'||typeof x.label!=='string'))throw Error('Invalid recovery history');return list;}
    function backup(raw,label){
      const list=history();
      const entry={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),at:new Date().toISOString(),label:String(label||'Before change').slice(0,200),raw};
      // A single setItem is atomic. Never remove history to make quota space.
      storage.setItem(HISTORY,JSON.stringify([entry,...list].slice(0,MAX)));
    }
    function load(){
      try{const canonical=storage.getItem(KEY);source=canonical===null?LEGACY:KEY;expected=canonical===null?storage.getItem(LEGACY):canonical;loaded=true;firstSave=true;
        const snapshot=expected===null?null:normalize(JSON.parse(expected));blocked=false;return {snapshot,blocked:false};
      }catch(error){blocked=true;loaded=true;return {snapshot:null,blocked:true,raw:expected,error:'Saved data could not be safely read. Download the original data or explicitly restore a recovery checkpoint before saving.'};}
    }
    function write(snapshot,options={},explicit=false){
      if(!loaded)load();
      if(blocked&&!explicit)return {ok:false,error:'Saving is paused to protect unreadable or newer saved data. Download the original data or explicitly restore a recovery checkpoint.'};
      try{
        const current=storage.getItem(source);
        const changed=()=>storage.getItem(source)!==expected||(source!==KEY&&storage.getItem(KEY)!==null);
        if(changed()){blocked=true;return {ok:false,error:warning};}
        const clean=normalize(snapshot),raw=JSON.stringify(clean);
        // Validate before touching either primary data or recovery history.
        let migrating=source!==KEY&&current!==null;
        if(current!==null){try{const old=JSON.parse(current);migrating=migrating||old.version!==clean.version;}catch{migrating=true;}}
        if(migrating||(firstSave&&current!==raw)||(current!==raw&&(options.checkpoint||explicit)))backup(current===null?JSON.stringify(normalize(EMPTY)):current,options.label||(migrating?'Before data migration':'Before first save'));
        // Check again after checkpoint write in case a cooperating tab changed it.
        if(changed()){blocked=true;return {ok:false,error:warning};}
        storage.setItem(KEY,raw);source=KEY;expected=raw;blocked=false;firstSave=current===raw&&firstSave;undoUsed=explicit;
        return {ok:true,snapshot:clean};
      }catch(error){return {ok:false,error:'Could not safely save this change. Browser storage may be full or unavailable, or the data may be invalid. Your previous saved plan is retained; download your current edits.'};}
    }
    function recoveryEntries(){try{return history().map(entry=>{let supported=false;try{normalize(JSON.parse(entry.raw));supported=true;}catch{}return {...entry,supported};});}catch{return [];}}
    function checkpoints(){try{return history().flatMap(entry=>{try{return [{id:entry.id,at:entry.at,label:entry.label,snapshot:normalize(JSON.parse(entry.raw))}];}catch{return [];}});}catch{return [];}}
    function restore(id){const entry=checkpoints().find(item=>item.id===id);if(!entry)return {ok:false,error:'This recovery checkpoint is unavailable or unsupported.'};return write(entry.snapshot,{checkpoint:true,label:'Before recovery restore'},true);}
    function undo(){if(undoUsed)return {ok:false,error:'Undo has already restored a checkpoint. Make a new edit before using Undo again, or choose a recovery checkpoint explicitly.'};const latest=checkpoints()[0];return latest?restore(latest.id):{ok:false,error:'No recovery checkpoint is available.'};}
    function exportRaw(){try{return storage.getItem(KEY)??storage.getItem(LEGACY);}catch{return null;}}
    return {load,save:(snapshot,options)=>write(snapshot,options),checkpoints,recoveryEntries,restore,undo,exportRaw};
  }
  return {create};
});
