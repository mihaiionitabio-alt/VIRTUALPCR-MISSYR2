/* Component command dispatcher: browser implementation of explicit command/event/telemetry interfaces. */
(/* @r2fn R2-C0034-F00001 */function(R2){
  'use strict';
  const descriptors=window.R2_SYSTEM_COMPONENTS,handlers=new Map(),state=new Map(),events=[];
  for(const port of descriptors.ports)state.set(port.code,{status:'IDLE',commandCount:0,failureCount:0,lastDurationMs:0});
  /* @r2fn R2-C0034-F00002 */function descriptor(name){const port=descriptors.ports.find(/* @r2fn R2-C0034-F00003 */p=>p.name===name);if(!port)throw new Error('Unknown system port: '+name);return port;}
  /* @r2fn R2-C0034-F00004 */function emit(port,status,duration=0){const channel=state.get(port.code);channel.status=status;channel.lastDurationMs=duration;if(status==='RUNNING')channel.commandCount++;if(status==='FAILED')channel.failureCount++;
    const event=Object.freeze({code:port.component+'-EVT-'+({RUNNING:'001',COMPLETE:'002',FAILED:'003'}[status]||'000'),port:port.code,status,at:new Date().toISOString(),durationMs:duration});events.push(event);if(events.length>64)events.shift();document.dispatchEvent(new CustomEvent('r2-system-event',{detail:event}));}
  /* @r2fn R2-C0034-F00005 */function bind(name,handler){descriptor(name);if(typeof handler!=='function')throw new TypeError('Port handler must be a function');if(handlers.has(name))throw new Error('Port already bound: '+name);handlers.set(name,handler);}
  /* @r2fn R2-C0034-F00006 */function invoke(name,...args){const port=descriptor(name),handler=handlers.get(name);if(!handler)throw new Error('Unbound system port: '+name);const started=performance.now();emit(port,'RUNNING');
    try{const result=handler(...args);if(result&&typeof result.then==='function')return result.then(/* @r2fn R2-C0034-F00007 */value=>{emit(port,'COMPLETE',performance.now()-started);return value},/* @r2fn R2-C0034-F00008 */error=>{emit(port,'FAILED',performance.now()-started);throw error});emit(port,'COMPLETE',performance.now()-started);return result;}
    catch(error){emit(port,'FAILED',performance.now()-started);throw error;}}
  /* @r2fn R2-C0034-F00009 */function snapshot(){return {schema:'missy-r2-system-status/1',ports:descriptors.ports.map(/* @r2fn R2-C0034-F00010 */port=>({code:port.code,name:port.name,component:port.component,...state.get(port.code)})),telemetry:descriptors.ports.flatMap(/* @r2fn R2-C0034-F00013 */port=>['commandCount','failureCount','lastDurationMs'].map(/* @r2fn R2-C0034-F00014 */(name,i)=>({code:port.code+'-TLM'+String(i+1).padStart(3,'0'),name,value:state.get(port.code)[name]}))),events:events.map(/* @r2fn R2-C0034-F00011 */event=>({...event}))};}
  R2.system=Object.freeze({bind,invoke,snapshot,describe:/* @r2fn R2-C0034-F00012 */()=>descriptors});
})(window.R2=window.R2||{});
