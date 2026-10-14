const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const d=require('../miniprogram/utils/domain');
function harness(call,options={}){
 const confirmations=[];let definition;const timers=new Map();let timerId=0;let confirms=true;let recordingStarts=0,released=false,authorizeSuccess,recordingHandlers,navigation='';const app={globalData:{demo:!!options.demo,profile:options.demo?{name:'演示医师'}:null}};
 const recording={start(owner,config,handlers){recordingStarts++;recordingHandlers=handlers;return {stop(){},release(){released=true;}};}};
 const ui={async run(p,fn){if(p.data.busy||p._unloaded)return;p.setData({busy:true});try{return await fn();}catch(e){ui.showError(p,e);}finally{if(!p._unloaded)p.setData({busy:false});}},showError(p,e){if(!p._unloaded)p.setData({error:e.message});},async confirm(title,content){confirmations.push({title,content});return confirms;},toast(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/record/index.js'),'utf8'),{require(name){return name.endsWith('/api')?{call}:name.endsWith('/ui')?ui:name.endsWith('/recorder')?recording:name.endsWith('/ai-fill')?require('../miniprogram/utils/ai-fill'):d;},Page(p){definition=p;},setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},setInterval(fn){timers.set(++timerId,fn);return timerId;},clearInterval(id){timers.delete(id);},wx:{switchTab({url}){navigation=url;},authorize({success}){authorizeSuccess=success;if(!options.pendingPermission)success();}},getApp(){return app;}});
 const p=Object.assign({},definition,{data:JSON.parse(JSON.stringify(definition.data)),writes:0,setData(values){this.writes++;for(const [key,value]of Object.entries(values)){const parts=key.split('.');let target=this.data;for(const part of parts.slice(0,-1))target=target[part];target[parts.at(-1)]=value;}}});
 p.data.taskId='task1';p.pollAttempts=0;
 return {p,timers,app,confirmations,get navigation(){return navigation;},setConfirm(value){confirms=value;},get recordingStarts(){return recordingStarts;},get released(){return released;},recordingStarted(){recordingHandlers.start();},grantPermission(){authorizeSuccess();}};
}
test('更换居民或性别必须重新审核；转写完成不能覆盖已有原文',async()=>{
 const {p}=harness(async()=>({status:'completed',text:'核对后的语音内容'}));p.data.residents=[{name:'居民乙'}];p.data.reviewConfirmed=true;p.pickPatient({detail:{value:0}});assert.equal(p.data.reviewConfirmed,false);
 p.data.reviewConfirmed=true;p.pickSex({detail:{value:1}});assert.equal(p.data.reviewConfirmed,false);
 p.data.reviewConfirmed=true;p.data.form.rawText='医师手动内容';await p.pollAsr();assert.equal(p.data.form.rawText,'医师手动内容');assert.equal(p.data.transcript,'核对后的语音内容');assert.equal(p.data.taskId,'');
 await p.useTranscript();assert.equal(p.data.form.rawText,'核对后的语音内容');assert.equal(p.data.form.source,'voice');assert.equal(p.data.reviewConfirmed,false);
});
test('取消替换保留原文，查询失败任务可重试，识别失败可重新录音',async()=>{
 const h=harness(async()=>({status:'failed',message:'质量不足'}));h.p.data.form.rawText='原文';h.p.data.transcript='转写';h.setConfirm(false);await h.p.useTranscript();assert.equal(h.p.data.form.rawText,'原文');await h.p.pollAsr();assert.equal(h.p.data.taskId,'');assert.match(h.p.data.error,/质量不足/);
 const retry=harness(async()=>{throw new Error('网络中断');});await retry.p.pollAsr();assert.equal(retry.p.data.taskId,'task1');assert.match(retry.p.data.asrStatus,/继续查询/);
});
test('连续点击查询只发一个请求，退出页面后不再写状态或创建轮询',async()=>{
 let resolve,calls=0;const h=harness(()=>{calls++;return new Promise(r=>{resolve=r;});});const pending=h.p.pollAsr();await h.p.resumeAsr();assert.equal(calls,1);h.p.onUnload();const writes=h.p.writes;resolve({status:'processing'});await pending;assert.equal(h.p.writes,writes);assert.equal(h.timers.size,0);
});
test('启动回调到达前也防止重复录音，退出时释放录音与计时器',async()=>{
 const h=harness(async()=>{});h.p.data.taskId='';h.p.data.consent=true;await h.p.startRecord();assert.equal(h.p.data.recording,true);await h.p.startRecord();assert.equal(h.recordingStarts,1);
 h.recordingStarted();assert.equal(h.timers.size,1);h.p.onUnload();assert.equal(h.released,true);assert.equal(h.timers.size,0);
});
test('等待麦克风授权时退出页面，授权返回后不会再启动录音',async()=>{
 const h=harness(async()=>{},{pendingPermission:true});h.p.data.taskId='';h.p.data.consent=true;const pending=h.p.startRecord();h.p.onUnload();const writes=h.p.writes;h.grantPermission();await pending;assert.equal(h.recordingStarts,0);assert.equal(h.p.writes,writes);
});
test('模型等待期间原文改变或页面退出，不把旧草稿写入当前病历',async()=>{
 for(const unload of [false,true]){let resolve;const h=harness(()=>new Promise(r=>{resolve=r;}));h.p.data.form.rawText='旧原文';const pending=h.p.generate();await new Promise(setImmediate);if(unload)h.p.onUnload();else h.p.setData({'form.rawText':'新原文'});const writes=h.p.writes;resolve({fields:{diagnosis:'旧原文对应内容'},engine:'DeepSeek'});await pending;assert.equal(h.p.data.form.diagnosis,undefined);if(unload)assert.equal(h.p.writes,writes);else assert.match(h.p.data.error,/原文已修改/);}
});
test('演示转云端清除演示身份并返回登录，取消时保留未保存原文',async()=>{
 const h=harness(async()=>{throw new Error('演示不应调用云端');},{demo:true});await h.p.startRecord();assert.equal(h.recordingStarts,0);assert.match(h.p.data.error,/演示/);
 h.p.data.form.rawText='未保存的演示原文';h.setConfirm(false);await h.p.cloudLogin();assert.equal(h.app.globalData.demo,true);assert.equal(h.app.globalData.profile.name,'演示医师');assert.equal(h.navigation,'');assert.equal(h.p.data.form.rawText,'未保存的演示原文');
 h.setConfirm(true);await h.p.cloudLogin();assert.equal(h.app.globalData.demo,false);assert.equal(h.app.globalData.profile,null);assert.equal(h.navigation,'/pages/index/index');
});

test('每次AI填写前提醒并可取消，生成候选不会覆盖手动内容或审核状态',async()=>{
 let calls=0;const h=harness(async()=>{calls++;return {fields:{chiefComplaint:'咳嗽三天',allergies:'青霉素过敏'},engine:'DeepSeek'};});
 h.p.data.form.rawText='患者说咳嗽三天，对青霉素过敏';h.p.data.form.allergies='无过敏史';h.p.data.reviewConfirmed=true;
 h.setConfirm(false);await h.p.generate();assert.equal(calls,0);assert.equal(h.p.data.aiCandidates.length,0);
 h.setConfirm(true);await h.p.generate();assert.equal(calls,1);assert.match(h.confirmations.at(-1).content,/AI可能遗漏、误写/);
 assert.equal(h.p.data.form.allergies,'无过敏史');assert.equal(h.p.data.form.chiefComplaint,undefined);assert.equal(h.p.data.reviewConfirmed,true);assert.equal(h.p.data.engine,'');
 const allergy=h.p.data.aiCandidates.find(f=>f.key==='allergies');assert.equal(allergy.different,true);assert.equal(allergy.text,'青霉素过敏');assert.equal(h.p.data.aiCandidates.length,d.FIELDS.length);
 await h.p.generate();assert.equal(h.confirmations.length,3);
});
test('逐项采用只更新所选字段，手动修改立即重算差异，缺失项不清空手动内容',async()=>{
 const h=harness(async()=>({fields:{allergies:'青霉素过敏',chiefComplaint:'咳嗽三天'},engine:'DeepSeek'}));h.p.data.form.rawText='原文';h.p.data.form.allergies='无过敏史';h.p.data.form.pastHistory='高血压';await h.p.generate();
 h.p.data.reviewConfirmed=true;h.p.adoptAi({currentTarget:{dataset:{key:'allergies'}}});assert.equal(h.p.data.form.allergies,'青霉素过敏');assert.equal(h.p.data.form.chiefComplaint,undefined);assert.equal(h.p.data.reviewConfirmed,false);assert.equal(h.p.data.engine,'DeepSeek');assert.equal(h.p.data.aiCandidates.find(f=>f.key==='allergies').same,true);
 h.p.input({currentTarget:{dataset:{key:'allergies'}},detail:{value:'未核实'}});assert.equal(h.p.data.aiCandidates.find(f=>f.key==='allergies').different,true);
 h.p.adoptAi({currentTarget:{dataset:{key:'pastHistory'}}});assert.equal(h.p.data.form.pastHistory,'高血压');
 h.p.input({currentTarget:{dataset:{key:'chiefComplaint'}},detail:{value:'咳嗽三天'}});assert.equal(h.p.data.aiCandidates.find(f=>f.key==='chiefComplaint').same,true);
});
test('AI等待期间手动填写保留，候选与最新手填内容比较；换居民使请求失效',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>{resolve=r;}));h.p.data.form.rawText='原文';const pending=h.p.generate();await new Promise(setImmediate);
 h.p.input({currentTarget:{dataset:{key:'allergies'}},detail:{value:'青霉素过敏'}});resolve({fields:{allergies:'无过敏史'},engine:'DeepSeek'});await pending;assert.equal(h.p.data.form.allergies,'青霉素过敏');assert.equal(h.p.data.aiCandidates.find(f=>f.key==='allergies').different,true);
 const waiting=h.p.generate();await new Promise(setImmediate);h.p.data.residents=[{name:'居民乙'}];h.p.pickPatient({detail:{value:0}});resolve({fields:{allergies:'无过敏史'},engine:'DeepSeek'});await waiting;assert.equal(h.p.data.aiValues,null);assert.match(h.p.data.error,/居民信息或沟通原文已修改/);
});
test('更改原文清除旧候选，单纯手写不需要原文或AI调用',()=>{
 let calls=0;const h=harness(()=>{calls++;});h.p.input({currentTarget:{dataset:{key:'chiefComplaint'}},detail:{value:'手动主诉'}});assert.equal(h.p.data.form.chiefComplaint,'手动主诉');assert.equal(calls,0);
 h.p.data.aiValues={chiefComplaint:'旧候选'};h.p.refreshAi();h.p.input({currentTarget:{dataset:{key:'rawText'}},detail:{value:'新原文'}});assert.equal(h.p.data.aiValues,null);assert.equal(h.p.data.aiCandidates.length,0);assert.equal(h.p.data.form.chiefComplaint,'手动主诉');
});

test('保存只提交当前填写及已采用项目，未采用候选不会混入病历',async()=>{
 let submitted;const h=harness(async(action,data)=>{if(action==='generate')return {fields:{diagnosis:'AI诊断候选',allergies:'青霉素过敏'},engine:'DeepSeek'};if(action==='saveRecord'){submitted=data;return {_id:'draft1',version:1};}});
 Object.assign(h.p.data.patient,{code:'TEST001',name:'虚构居民',village:'测试村',birthDate:'1950-01-01'});h.p.data.form.rawText='测试原文';h.p.data.form.diagnosis='医生手填诊断';await h.p.generate();h.p.adoptAi({currentTarget:{dataset:{key:'allergies'}}});h.p.saveDraft();await new Promise(setImmediate);
 assert.equal(submitted.record.diagnosis,'医生手填诊断');assert.equal(submitted.record.allergies,'青霉素过敏');assert.equal(submitted.record.aiValues,undefined);assert.equal(submitted.record.aiCandidates,undefined);assert.equal(submitted.archive,false);
});
