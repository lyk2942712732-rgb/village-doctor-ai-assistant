const cloud=require('wx-server-sdk');const crypto=require('crypto');const d=require('./domain');const ai=require('./ai');const documents=require('./exports');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV,timeout:60000});const db=cloud.database();
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const uuid=()=>crypto.randomBytes(16).toString('hex');
function assert(ok,message){if(!ok)throw new Error(message);}
function publicProfile(p){return {name:p.name,clinicId:p.clinicId,clinicName:p.clinicName,role:p.role};}
async function one(name,id,store=db){try{const r=await store.collection(name).doc(id).get();return r.data||null;}catch(e){if(/not exist|does not exist|not found|不存在/i.test(e.message||e.errMsg||''))return null;throw e;}}
async function all(name,clinicId){
 const rows=[];for(let offset=0;offset<=10000;offset+=100){const r=await db.collection(name).where({clinicId}).orderBy('_id','asc').skip(offset).limit(100).get();rows.push(...r.data);if(r.data.length<100)return rows;}
 throw new Error('档案超过单次汇总上限，请按卫生室拆分或配置后台分批统计');
}
async function owned(name,id,p,store=db){assert(typeof id==='string'&&id.length<=128,'资料编号无效');const item=await one(name,id,store);assert(item&&item.clinicId===p.clinicId,'资料不存在或无权访问');return item;}
const clinics=require('./clinics')({db,one,all,hash,uuid,d});
async function saveRecord(p,openid,data){
 const patient=d.patient(data.patient||{});const rec=d.record(data.record||{},!!data.archive);if(data.archive)assert(p.name&&p.name!=='微信用户','请先在卫生室页面完善医师姓名，再归档病历');
 const patientId=hash(p.clinicId+'|'+patient.code.toUpperCase());const recordId=data.id||hash(p.clinicId+'|'+openid+'|'+d.text(data.requestId,100));
 assert(data.id||/^[a-zA-Z0-9_-]{8,100}$/.test(data.requestId||''),'缺少保存请求编号，请重新打开录入页面');
 return db.runTransaction(async tx=>{
  await clinics.authorize(p,openid,tx);
  const existing=await one('residents',patientId,tx);
  if(existing){assert(existing.clinicId===p.clinicId,'无权访问居民资料');assert(existing.name===patient.name&&existing.birthDate===patient.birthDate&&existing.sex===patient.sex&&existing.village===patient.village,'居民编号对应的身份或所属村不一致，请选择已有档案并核对');}
  const old=await one('records',recordId,tx);
  if(old){
   assert(old.clinicId===p.clinicId&&old.patientId===patientId,'无权修改这份病历');
   if(!data.id&&old.requestId===data.requestId)return old;
   assert(old.status==='draft','正式病历不可覆盖，请新增就诊记录');
   assert(old.version===data.version,'草稿已由其他操作更新，请重新打开后核对');
  }
  const now=Date.now();const result=Object.assign({},rec,{clinicId:p.clinicId,patientId,doctorName:p.name,doctorId:openid,status:data.archive?'archived':'draft',version:old?old.version+1:1,createdAt:old?old.createdAt:now,updatedAt:now,archivedAt:data.archive?now:0,engine:d.text(data.record.engine,80)||'村医手动录入',requestId:data.requestId||old&&old.requestId||'',_id:recordId});
  if(!existing)await tx.collection('residents').doc(patientId).set({data:Object.assign({},patient,{code:patient.code.toUpperCase(),clinicId:p.clinicId,createdAt:now})});
  const {_id,...recordData}=result;await tx.collection('records').doc(recordId).set({data:recordData});
  const auditId=recordId+'_'+result.version;await tx.collection('audits').doc(auditId).set({data:{clinicId:p.clinicId,actor:openid,actorName:p.name,action:data.archive?'archiveRecord':'saveDraft',targetId:recordId,version:result.version,createdAt:now}});
  return result;
 });
}
function validateFilters(v){const days=Number(v.days),minChronic=Number(v.minChronic);assert(Number.isInteger(days)&&days>=1&&days<=3650,'未复诊天数应为 1–3650 的整数');assert(Number.isInteger(minChronic)&&minChronic>=1&&minChronic<=20,'疾病数量应为 1–20 的整数');assert(v.complex||v.abnormal||v.overdue,'至少选择一个筛选条件');return {days,minChronic,complex:!!v.complex,abnormal:!!v.abnormal,overdue:!!v.overdue};}
function validateRange(v={}){const range={start:d.text(v.start,10),end:d.text(v.end,10),capacity:Number(v.capacity||12)};assert(d.validDate(range.start)&&d.validDate(range.end)&&range.start<=range.end,'统计日期范围无效');assert(Number.isInteger(range.capacity)&&range.capacity>=1&&range.capacity<=100,'计划接诊人数应为 1–100 的整数');return range;}
async function datasets(p){const [residents,records,services,exports]=await Promise.all(['residents','records','services','exports'].map(n=>all(n,p.clinicId)));return {residents,records,services,exports};}
async function exportDocument(p,openid,data){
 const kind=data.kind;const id=uuid();let bytes,fileType,patientId='',recordIds=[],title;
 if(kind==='referral'){
  const patient=await owned('residents',data.patientId,p);patientId=patient._id;
  assert(Array.isArray(data.recordIds)&&data.recordIds.length&&data.recordIds.length<=500,'请选择 1–500 份病历');recordIds=[...new Set(data.recordIds)];
  const records=await Promise.all(recordIds.map(id=>owned('records',id,p)));assert(records.every(r=>r.patientId===patientId&&r.status==='archived'),'转诊包只能包含该居民已归档的病历');
  records.sort((a,b)=>a.visitDate.localeCompare(b.visitDate));const services=(await all('services',p.clinicId)).filter(s=>s.patientId===patientId).sort((a,b)=>a.serviceDate.localeCompare(b.serviceDate));
  bytes=await documents.referral(patient,records,services,p.isTest);fileType='pdf';title=patient.name+'转诊资料包';
 }else if(kind==='roster'){
  const roster=await owned('rosters',data.rosterId,p);const people=await Promise.all(roster.patientIds.map(pid=>owned('residents',pid,p)));
  bytes=await documents.roster(roster,people,p.isTest);fileType='pdf';title=roster.title;
 }else if(kind==='stats'){
  const range=validateRange(data.range);const s=await datasets(p);const stats=d.statistics(s.residents,s.records,s.services,s.exports,range);bytes=await documents.workbook(stats,s.records,s.services,s.residents,range,s.exports,p.isTest);fileType='xlsx';title='各村服务统计';
 }else throw new Error('导出类型无效');
 const path='exports/'+hash(p.clinicId).slice(0,16)+'/'+hash(openid).slice(0,16)+'/'+id+'.'+fileType;
 await clinics.authorize(p,openid);
 const upload=await cloud.uploadFile({cloudPath:path,fileContent:bytes});
 const now=Date.now();await db.collection('exports').doc(id).set({data:{clinicId:p.clinicId,ownerId:openid,kind,title,patientId,recordIds,rosterId:data.rosterId||'',fileID:upload.fileID,fileType,status:'ready',createdAt:now}});
 await db.collection('audits').doc('export_'+id).set({data:{clinicId:p.clinicId,actor:openid,actorName:p.name,action:'export_'+kind,targetId:id,createdAt:now}});
 // 服务端上传文件通过服务端授权临时地址下载，存储规则保持默认私有。
 const url=await cloud.getTempFileURL({fileList:[{fileID:upload.fileID,maxAge:300}]});
 assert(url.fileList[0].tempFileURL,'资料生成成功但下载地址获取失败，请联系管理员');
 return {id,fileID:upload.fileID,url:url.fileList[0].tempFileURL,fileType,title};
}
function asrClient(){
 assert(process.env.ASR_SECRET_ID&&process.env.ASR_SECRET_KEY,'尚未配置腾讯云语音识别，请使用手动输入或联系管理员');
 const Client=require('tencentcloud-sdk-nodejs-asr').asr.v20190614.Client;
 return new Client({credential:{secretId:process.env.ASR_SECRET_ID,secretKey:process.env.ASR_SECRET_KEY},region:process.env.ASR_REGION||'ap-beijing',profile:{httpProfile:{endpoint:'asr.tencentcloudapi.com'}}});
}
async function handle(action,data,p,openid){
 if(clinics.actions.includes(action))return clinics.handle(action,data,p,openid);
 if(action==='saveRecord')return saveRecord(p,openid,data);
 if(action==='generate')return ai.generate(data.rawText);
 if(action==='residents'){
  const [people,records]=await Promise.all([all('residents',p.clinicId),all('records',p.clinicId)]);const query=d.text(data.query,60);
  return people.filter(v=>!query||v.name.includes(query)||v.code.toLowerCase().includes(query.toLowerCase())).map(v=>Object.assign({},v,{age:d.age(v.birthDate),count:records.filter(r=>r.patientId===v._id&&r.status==='archived').length}));
 }
 if(action==='history'){const patient=await owned('residents',data.patientId,p);const [records,services]=await Promise.all([all('records',p.clinicId),all('services',p.clinicId)]);return {patient,records:records.filter(r=>r.patientId===patient._id&&r.status==='archived').sort((a,b)=>b.visitDate.localeCompare(a.visitDate)),services:services.filter(s=>s.patientId===patient._id).sort((a,b)=>b.serviceDate.localeCompare(a.serviceDate))};}
 if(action==='draft'){const record=await owned('records',data.id,p);assert(record.status==='draft','该病历已正式归档');return record;}
 if(action==='dashboard'){
  const s=await datasets(p);s.rosters=await all('rosters',p.clinicId);return d.dashboard(s);
 }
 if(action==='priority'){const f=validateFilters(data);const [residents,records]=await Promise.all([all('residents',p.clinicId),all('records',p.clinicId)]);return d.priority(residents,records,f);}
 if(action==='saveRoster'){
  assert(Array.isArray(data.patientIds)&&data.patientIds.length&&data.patientIds.length<=500,'请确认 1–500 位接诊居民');assert(d.validDate(data.serviceDate),'计划接诊日期无效');const f=validateFilters(data.filters||{});const patientIds=[...new Set(data.patientIds)];
  await Promise.all(patientIds.map(id=>owned('residents',id,p)));
  const [residents,records]=await Promise.all([all('residents',p.clinicId),all('records',p.clinicId)]);const candidates=d.priority(residents,records,f);const reasons={},recordIdsByPatient={};patientIds.forEach(id=>{const found=candidates.find(v=>v._id===id);assert(found,'档案已更新，居民不再符合筛选条件，请重新筛选');assert(data.recordIdsByPatient&&data.recordIdsByPatient[id]===found.latestRecordId,'档案已更新，请重新筛选并核对本次名单');reasons[id]=found.reasons;recordIdsByPatient[id]=found.latestRecordId;});
  const id=uuid();const roster={clinicId:p.clinicId,title:d.text(data.title,80)||'本次专家下乡接诊',serviceDate:data.serviceDate,patientIds,filters:f,reasons,recordIdsByPatient,doctorName:p.name,createdAt:Date.now()};await db.collection('rosters').doc(id).set({data:roster});return Object.assign({_id:id},roster);
 }
 if(action==='rosters'){
  const [rosters,residents,services]=await Promise.all([all('rosters',p.clinicId),all('residents',p.clinicId),all('services',p.clinicId)]);
  return rosters.sort((a,b)=>b.createdAt-a.createdAt).map(r=>Object.assign({},r,{patients:r.patientIds.map(id=>{const resident=residents.find(p=>p._id===id);return Object.assign({},resident,{done:services.some(s=>s.rosterId===r._id&&s.patientId===id)});})}));
 }
 if(action==='saveService'){
  const roster=await owned('rosters',data.rosterId,p);await owned('residents',data.patientId,p);assert(roster.patientIds.includes(data.patientId),'该居民不在本次已确认名单内');assert(d.validDate(data.serviceDate)&&data.serviceDate<=d.dateOnly(),'服务日期无效或晚于今天');assert(['专家诊疗','随访'].includes(data.type),'服务类型无效');
  const service={clinicId:p.clinicId,rosterId:roster._id,patientId:data.patientId,expertName:d.text(data.expertName,40),specialty:d.text(data.specialty,60),serviceDate:data.serviceDate,type:data.type,opinion:d.text(data.opinion,6000),followup:d.text(data.followup),doctorName:p.name,doctorId:openid,createdAt:Date.now()};assert(service.expertName&&service.opinion,'请填写专家姓名及诊疗意见');const id=hash(roster._id+'|'+data.patientId);
  return db.runTransaction(async tx=>{await clinics.authorize(p,openid,tx);assert(!(await one('services',id,tx)),'该居民本次诊疗已经归档');await tx.collection('services').doc(id).set({data:service});await tx.collection('audits').doc('service_'+id).set({data:{clinicId:p.clinicId,actor:openid,actorName:p.name,action:'archiveService',targetId:id,createdAt:Date.now()}});return Object.assign({_id:id},service);});
 }
 if(action==='stats'){const range=validateRange(data);const s=await datasets(p);return d.statistics(s.residents,s.records,s.services,s.exports,range);}
 if(action==='export')return exportDocument(p,openid,data);
 if(action==='reserveAudio'){
  asrClient();const id=uuid();const path='audio/'+hash(openid).slice(0,20)+'/'+id+'.mp3';await db.collection('audioTasks').doc(id).set({data:{clinicId:p.clinicId,ownerId:openid,path,status:'reserved',createdAt:Date.now()}});return {id,path};
 }
 if(action==='transcribe'){
  const a=await owned('audioTasks',data.audioId,p);assert(a.ownerId===openid&&a.status==='reserved'&&a.createdAt>Date.now()-3600000,'录音预约失效，请重新提交');assert(typeof data.fileID==='string'&&data.fileID.startsWith('cloud://')&&data.fileID.endsWith('/'+a.path),'音频文件来源无效');
  const url=await cloud.getTempFileURL({fileList:[{fileID:data.fileID,maxAge:3600}]});assert(url.fileList[0].tempFileURL,'录音文件无法读取');
  const result=await asrClient().CreateRecTask({EngineModelType:process.env.ASR_ENGINE||'16k_zh',ChannelNum:1,ResTextFormat:0,SourceType:0,Url:url.fileList[0].tempFileURL,SpeakerDiarization:1,SpeakerNumber:0});
  await db.collection('audioTasks').doc(a._id).update({data:{fileID:data.fileID,taskId:result.Data.TaskId,status:'processing'}});return {id:a._id};
 }
 if(action==='transcription'){
  const a=await owned('audioTasks',data.id,p);assert(a.ownerId===openid,'无权读取录音');if(a.status==='completed'||a.status==='failed')return {status:a.status,text:a.text||'',message:a.message||''};assert(a.taskId,'识别任务尚未提交');
  const r=await asrClient().DescribeTaskStatus({TaskId:a.taskId});const result=r.Data;
  if(result.Status===2||result.Status===3){const status=result.Status===2?'completed':'failed';const values={status,text:result.Status===2?d.text(result.Result,12000):'',message:result.Status===3?'语音识别失败，请检查录音质量并重新录制':'',updatedAt:Date.now()};await db.collection('audioTasks').doc(a._id).update({data:values});if(a.fileID)await cloud.deleteFile({fileList:[a.fileID]}).catch(()=>{});return values;}return {status:'processing'};
 }
 throw new Error('操作类型无效');
}
exports.main=async event=>{
 try{
  const ctx=cloud.getWXContext();assert(ctx.OPENID&&ctx.APPID,'请在已登录的微信小程序中使用');
  const data=event.data&&typeof event.data==='object'?event.data:{};
  if(event.action==='serverTime')return {ok:true,data:{epoch:Date.now()}};
  if(event.action==='regionOptions'){assert(await one('doctors',ctx.OPENID),'请先登录');return {ok:true,data:{options:require('./regions').options(data.parent||''),version:require('./regions').version}};}
  if(event.action==='login')return {ok:true,data:await clinics.login(ctx.OPENID,data)};
  if(event.action==='createClinic')return {ok:true,data:await clinics.create(ctx.OPENID,data)};
  if(clinics.accountActions.includes(event.action))return {ok:true,data:await clinics.accountHandle(event.action,data,ctx.OPENID)};
  const profile=await clinics.resolve(ctx.OPENID,data.clinicId);
  return {ok:true,data:await handle(event.action,data,profile,ctx.OPENID)};
 }catch(e){
  // 不记录原始医患文本、请求参数或第三方响应，避免敏感资料进入日志。
  const message=e.message||'操作失败，请重试';
  const internal=/database|collection|wx-server|timeout|ECONN|permission|credential|not found|index/i.test(message);
  return {ok:false,message:internal?'云服务暂不可用，请管理员检查数据库集合、权限与云函数日志':message.slice(0,180)};
 }
};
exports._test={handle,owned,saveRecord,validateFilters,validateRange,clinics};
