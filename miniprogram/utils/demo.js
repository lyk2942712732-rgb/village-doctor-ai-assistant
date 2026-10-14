const d=require('./domain');
const KEY='village-doctor-demo-v1';
function seed(){return {residents:[],records:[],rosters:[],services:[],exports:[]};}
function load(){return wx.getStorageSync(KEY)||seed();}
function save(s){wx.setStorageSync(KEY,s);}
const id=()=> 'demo_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
async function call(action,data={}){
 const s=load();
 if(action==='login')return {name:'演示村医',clinicName:'黑龙江 · 乡村卫生室',clinicId:'demo',role:'doctor',demo:true};
 if(action==='dashboard')return d.dashboard(s);
 if(action==='residents')return s.residents.filter(p=>!data.query||p.name.includes(data.query)||p.code.toLowerCase().includes(data.query.toLowerCase())).map(p=>Object.assign({},p,{age:d.age(p.birthDate),count:s.records.filter(r=>r.patientId===p._id&&r.status==='archived').length}));
 if(action==='history')return {patient:s.residents.find(p=>p._id===data.patientId),records:s.records.filter(r=>r.patientId===data.patientId&&r.status==='archived').sort((a,b)=>b.visitDate.localeCompare(a.visitDate)),services:s.services.filter(v=>v.patientId===data.patientId)};
 if(action==='draft')return s.records.find(r=>r._id===data.id);
 if(action==='generate')return {fields:d.template(data.rawText),engine:'模板整理 · 未接入 AI',generatedAt:Date.now()};
 if(action==='saveRecord'){
  const p=d.patient(data.patient);let resident=s.residents.find(v=>v.code===p.code);
  if(resident&&resident.name!==p.name)throw new Error('编号已被其他居民使用，请核对档案');
  if(!resident){resident=Object.assign(p,{_id:id()});s.residents.push(resident);}
  const old=s.records.find(v=>v._id===data.id);
  if(old&&old.status==='archived')throw new Error('正式病历不可覆盖，请新增就诊记录');
  const rec=Object.assign(d.record(data.record,data.archive),{_id:old?old._id:id(),patientId:resident._id,status:data.archive?'archived':'draft',version:old?old.version+1:1,updatedAt:Date.now(),doctorName:'演示村医',engine:data.record.engine||'村医录入'});
  if(old)s.records[s.records.indexOf(old)]=rec;else s.records.push(rec);save(s);return rec;
 }
 if(action==='priority')return d.priority(s.residents,s.records,data);
 if(action==='saveRoster'){if(!data.patientIds.length)throw new Error('请勾选接诊居民');const candidates=d.priority(s.residents,s.records,data.filters||{});const reasons={},recordIdsByPatient={};data.patientIds.forEach(pid=>{const found=candidates.find(p=>p._id===pid);if(!found)throw new Error('居民不再符合筛选条件，请重新筛选');if(!data.recordIdsByPatient||data.recordIdsByPatient[pid]!==found.latestRecordId)throw new Error('档案已更新，请重新筛选并核对本次名单');reasons[pid]=found.reasons;recordIdsByPatient[pid]=found.latestRecordId;});const roster={_id:id(),title:data.title||'本次下乡接诊',serviceDate:data.serviceDate,patientIds:data.patientIds,filters:data.filters,reasons,recordIdsByPatient,createdAt:Date.now()};s.rosters.push(roster);save(s);return roster;}
 if(action==='rosters')return s.rosters.slice().reverse().map(r=>Object.assign({},r,{patients:r.patientIds.map(pid=>Object.assign({},s.residents.find(p=>p._id===pid),{done:s.services.some(v=>v.rosterId===r._id&&v.patientId===pid)}))}));
 if(action==='saveService'){if(!data.expertName||!data.opinion)throw new Error('请填写专家姓名和诊疗意见');if(s.services.some(v=>v.rosterId===data.rosterId&&v.patientId===data.patientId))throw new Error('该居民本次诊疗已归档');const v=Object.assign({},data,{_id:id(),createdAt:Date.now()});s.services.push(v);save(s);return v;}
 if(action==='stats')return d.statistics(s.residents,s.records,s.services,s.exports,data);
 if(action==='export')throw new Error('演示模式不上传个人资料；请连接云开发后生成 PDF / Excel');
 if(action==='resetDemo'){save(seed());return true;}
 throw new Error('演示模式不支持此操作，请使用手动录入或连接云服务');
}
module.exports={call};
