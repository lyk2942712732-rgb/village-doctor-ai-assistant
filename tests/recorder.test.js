const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function harness(){
 const events={};let starts=0,stops=0,bindings=0,failStart=false;
 const manager={onStart(fn){events.start=fn;bindings++;},onStop(fn){events.stop=fn;bindings++;},onError(fn){events.error=fn;bindings++;},start(){starts++;if(failStart)throw new Error('设备故障');},stop(){stops++;}};
 const context={module:{exports:{}},wx:{getRecorderManager:()=>manager}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/utils/recorder'),'utf8'),context);
 const calls=[];const handlers={start:()=>calls.push('start'),stop:r=>calls.push(r.tempFilePath),error:()=>calls.push('error')};
 return {recorder:context.module.exports,events,calls,handlers,get starts(){return starts;},get stops(){return stops;},get bindings(){return bindings;},failStart(v){failStart=v;}};
}
test('反复录音只注册一组全局回调，停止后可以开始下一段',()=>{
 const h=harness();for(let i=0;i<5;i++){const capture=h.recorder.start({}, {},h.handlers);h.events.start();capture.stop();h.events.stop({tempFilePath:'clip'+i});}
 assert.equal(h.bindings,3);assert.equal(h.starts,5);assert.equal(h.stops,5);assert.equal(h.calls.filter(x=>x==='start').length,5);assert.equal(h.calls.at(-1),'clip4');
});
test('退出页面释放回调，旧录音结束前不能把事件发给下一位居民',()=>{
 const h=harness();const owner={};const capture=h.recorder.start(owner,{},h.handlers);owner._unloaded=true;capture.release();
 assert.throws(()=>h.recorder.start({}, {},h.handlers),/正在结束/);
 h.events.start();h.events.stop({tempFilePath:'old-recording'});assert.deepEqual(h.calls,[]);assert.equal(h.stops,2);
 h.recorder.start({}, {},h.handlers);h.events.start();h.events.error();assert.deepEqual(h.calls,['start','error']);
});
test('同步启动失败与异步录音错误均允许再次启动',()=>{
 const h=harness();h.failStart(true);assert.throws(()=>h.recorder.start({}, {},h.handlers),/设备故障/);h.failStart(false);h.recorder.start({}, {},h.handlers);h.events.error();h.recorder.start({}, {},h.handlers);assert.equal(h.starts,3);
});
