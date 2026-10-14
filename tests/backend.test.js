const test=require('node:test');const assert=require('node:assert/strict');const Module=require('module');const store={};
const clone=x=>JSON.parse(JSON.stringify(x));
function collection(name){store[name] ||= {};return {doc(id){return {async get(){return {data:store[name][id]?{_id:id,...clone(store[name][id])}:null};},async set({data}){store[name][id]=clone(data);},async update({data}){if(!store[name][id])throw new Error('not exist');Object.assign(store[name][id],clone(data));}};},where(filter){let offset=0,limit=100;return {orderBy(){return this;},skip(n){offset=n;return this;},limit(n){limit=n;return this;},async get(){return {data:Object.entries(store[name]).map(([id,x])=>({_id:id,...clone(x)})).filter(x=>Object.entries(filter).every(([k,v])=>x[k]===v)).sort((a,b)=>a._id.localeCompare(b._id)).slice(offset,offset+limit)};}};}};}
const db={collection,async runTransaction(fn){const snapshot=clone(store);try{return await fn(db);}catch(e){for(const k of Object.keys(store))delete store[k];Object.assign(store,snapshot);throw e;}}};
let ctx={OPENID:'doctorA',APPID:'wx-test'};const cloud={init(){},DYNAMIC_CURRENT_ENV:'test',database:()=>db,getWXContext:()=>ctx};
const load=Module._load;Module._load=function(name,...args){if(name==='wx-server-sdk')return cloud;return load.call(this,name,...args);};const api=require('../cloudfunctions/medicalApi');Module._load=load;
const profile={clinicId:'clinic-a',clinicName:'幸福卫生室',name:'村医甲',enabled:true};
store.doctors={doctorA:profile};store.clinics={'clinic-a':{name:'幸福卫生室',ownerId:'doctorA',enabled:true,version:1},'clinic-b':{name:'其他卫生室',ownerId:'foreign',enabled:true,version:1}};
const patient={code:'HLJ001',name:'张某',sex:'女',birthDate:'1950-01-01',village:'幸福村',phone:''};
const record={visitDate:'2026-01-01',chiefComplaint:'症状原文',presentIllness:'事实记录',allergies:'未核实',diagnosis:'医师诊断',plan:'医师意见',chronicCount:2,reviewConfirmed:true};
test('云函数拒绝未加入卫生室的微信身份',async()=>{ctx={OPENID:'stranger',APPID:'wx-test'};const r=await api.main({action:'residents'});assert.equal(r.ok,false);ctx={OPENID:'doctorA',APPID:'wx-test'};});
test('卫生室隔离阻止跨租户档案读取和导出',async()=>{store.residents={foreign:{clinicId:'clinic-b',name:'其他村'}};await assert.rejects(()=>api._test.owned('residents','foreign',profile),/无权/);const r=await api.main({action:'export',data:{kind:'referral',patientId:'foreign',recordIds:['x']}});assert.equal(r.ok,false);});
test('保存具有幂等性，草稿版本检查和正式归档不可覆盖',async()=>{const first=await api._test.saveRecord(profile,'doctorA',{requestId:'request_123456',patient,record,archive:false});const retry=await api._test.saveRecord(profile,'doctorA',{requestId:'request_123456',patient,record,archive:false});assert.equal(first._id,retry._id);await assert.rejects(()=>api._test.saveRecord(profile,'doctorA',{id:first._id,version:0,patient,record,archive:false}),/已由其他/);const final=await api._test.saveRecord(profile,'doctorA',{id:first._id,version:1,patient,record,archive:true});assert.equal(final.status,'archived');await assert.rejects(()=>api._test.saveRecord(profile,'doctorA',{id:first._id,version:2,patient,record,archive:false}),/不可覆盖/);assert.equal(Object.keys(store.records).length,1);});
test('同一编号不得覆盖另一个居民身份',async()=>{await assert.rejects(()=>api._test.saveRecord(profile,'doctorA',{requestId:'request_999999',patient:{...patient,name:'其他姓名'},record,archive:false}),/不一致/);});
test('专家意见只能归档到已确认名单的居民，且禁止重复提交',async()=>{const pid=Object.keys(store.residents).find(k=>store.residents[k].name==='张某');store.rosters={roster1:{clinicId:'clinic-a',patientIds:[pid]}};const data={rosterId:'roster1',patientId:pid,expertName:'专家甲',serviceDate:'2026-01-02',type:'专家诊疗',opinion:'专家原意'};await api._test.handle('saveService',data,profile,'doctorA');await assert.rejects(()=>api._test.handle('saveService',data,profile,'doctorA'),/已经归档/);});
test('分页读取覆盖超过100条居民记录',async()=>{for(let i=0;i<230;i++)store.residents['page'+i]={...patient,clinicId:'clinic-a',code:'PAGE'+i};const r=await api._test.handle('residents',{},profile,'doctorA');assert.equal(r.length,231);});
test('统计和筛选参数拒绝负值及非整数',()=>{assert.throws(()=>api._test.validateFilters({complex:true,days:-1,minChronic:2}),/天数/);assert.throws(()=>api._test.validateRange({start:'2026-01-01',end:'2026-10-01',capacity:0.5}),/整数/);});
test('确认名单核对筛选时的病历版本，并关联首页待筛选状态',async()=>{
 const pid=Object.keys(store.residents).find(k=>store.residents[k].name==='张某');const rec=Object.keys(store.records)[0];
 const data={patientIds:[pid],recordIdsByPatient:{[pid]:'outdated'},serviceDate:'2026-10-12',filters:{complex:true,abnormal:true,overdue:true,days:90,minChronic:2}};
 await assert.rejects(()=>api._test.handle('saveRoster',data,profile,'doctorA'),/档案已更新/);
 data.recordIdsByPatient[pid]=rec;const roster=await api._test.handle('saveRoster',data,profile,'doctorA');assert.equal(roster.recordIdsByPatient[pid],rec);
 const summary=await api._test.handle('dashboard',{},profile,'doctorA');assert.equal(summary.screening,0);assert.equal(summary.rosters,1);
});
test('历次档案跨分页完整返回，排除草稿及其他居民和卫生室，按日期倒序',async()=>{
 const snapshot=clone(store);
 try{
  store.residents={elder:{...patient,clinicId:'clinic-a'}};store.records={};store.services={};
  const expected=[];
  for(let i=0;i<205;i++){
   const visitDate=new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10);const id='visit_'+String(i).padStart(3,'0');
   store.records[id]={clinicId:'clinic-a',patientId:'elder',status:'archived',visitDate};expected.unshift(id);
  }
  store.records.draft={clinicId:'clinic-a',patientId:'elder',status:'draft',visitDate:'2026-10-01'};
  store.records.other={clinicId:'clinic-a',patientId:'other',status:'archived',visitDate:'2026-10-02'};
  store.records.foreign={clinicId:'clinic-b',patientId:'elder',status:'archived',visitDate:'2026-10-03'};
  store.services.first={clinicId:'clinic-a',patientId:'elder',serviceDate:'2025-03-01'};
  store.services.second={clinicId:'clinic-a',patientId:'elder',serviceDate:'2025-04-01'};
  store.services.other={clinicId:'clinic-a',patientId:'other',serviceDate:'2025-05-01'};
  store.services.foreign={clinicId:'clinic-b',patientId:'elder',serviceDate:'2025-06-01'};
  const h=await api._test.handle('history',{patientId:'elder'},profile,'doctorA');
  assert.deepEqual(h.records.map(r=>r._id),expected);assert.deepEqual(h.services.map(s=>s._id),['second','first']);
 }finally{for(const k of Object.keys(store))delete store[k];Object.assign(store,snapshot);}
});
test('转诊选择仅包含本居民正式病历，去重并按时间排序，同时附全部专家记录',async()=>{
 const snapshot=clone(store);const documents=require('../cloudfunctions/medicalApi/exports');const original=documents.referral;let captured;
 try{
  store.residents={elder:{...patient,clinicId:'clinic-a'}};
  store.records={early:{clinicId:'clinic-a',patientId:'elder',status:'archived',visitDate:'2025-01-01'},late:{clinicId:'clinic-a',patientId:'elder',status:'archived',visitDate:'2025-06-01'},draft:{clinicId:'clinic-a',patientId:'elder',status:'draft',visitDate:'2025-07-01'},other:{clinicId:'clinic-a',patientId:'other',status:'archived',visitDate:'2025-08-01'}};
  store.services={first:{clinicId:'clinic-a',patientId:'elder',serviceDate:'2025-02-01'},second:{clinicId:'clinic-a',patientId:'elder',serviceDate:'2025-07-01'},other:{clinicId:'clinic-a',patientId:'other',serviceDate:'2025-08-01'}};
  documents.referral=async(p,records,services)=>{captured={p,records,services};return Buffer.from('verified payload');};
  cloud.uploadFile=async()=>({fileID:'cloud://test/export.pdf'});cloud.getTempFileURL=async()=>({fileList:[{tempFileURL:'https://example.test/export.pdf'}]});
  for(const recordIds of [['draft'],['early','other']])await assert.rejects(()=>api._test.handle('export',{kind:'referral',patientId:'elder',recordIds},profile,'doctorA'),/只能包含/);
  assert.equal(captured,undefined);
  const out=await api._test.handle('export',{kind:'referral',patientId:'elder',recordIds:['late','early','late']},profile,'doctorA');
  assert.deepEqual(captured.records.map(r=>r._id),['early','late']);assert.deepEqual(captured.services.map(s=>s._id),['first','second']);assert.equal(out.fileType,'pdf');
  assert.deepEqual(store.exports[out.id].recordIds,['late','early']);assert.equal(store.audits['export_'+out.id].targetId,out.id);
 }finally{documents.referral=original;delete cloud.uploadFile;delete cloud.getTempFileURL;for(const k of Object.keys(store))delete store[k];Object.assign(store,snapshot);}
});
