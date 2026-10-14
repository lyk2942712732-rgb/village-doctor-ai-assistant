const FIELDS = [
 ['chiefComplaint','主诉'],['presentIllness','现病史'],['pastHistory','既往史'],
 ['allergies','过敏史'],['examination','体格检查'],['tests','辅助检查'],
 ['diagnosis','诊断（由医师核对）'],['plan','处理意见'],['followup','随访计划']
].map(([key,label])=>({key,label}));
function fail(message){throw new Error(message);}
function text(value,max=2000){return String(value == null ? '' : value).trim().slice(0,max);}
function dateOnly(now=Date.now()){return new Date(now+8*3600000).toISOString().slice(0,10);}
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
function patient(input){
 const p={code:text(input.code,24),name:text(input.name,40),sex:text(input.sex,4),birthDate:text(input.birthDate,10),village:text(input.village,60),phone:text(input.phone,20)};
 if(!/^[A-Za-z0-9_-]{2,24}$/.test(p.code))fail('居民编号须为 2–24 位字母、数字、横线或下划线');
 if(!p.name||!p.village)fail('请填写居民姓名和所属村');
 if(!['男','女','未知'].includes(p.sex))fail('请选择性别');
 if(!validDate(p.birthDate)||p.birthDate>dateOnly())fail('请填写有效的出生日期');
 if(p.phone&&!/^1\d{10}$/.test(p.phone))fail('联系电话须为 11 位手机号，也可留空');
 return p;
}
function record(input,archive=false){
 const out={};FIELDS.forEach(f=>out[f.key]=text(input[f.key]));
 out.visitDate=text(input.visitDate,10);
 if(!validDate(out.visitDate)||out.visitDate>dateOnly())fail('就诊日期无效或晚于今天');
 out.rawText=text(input.rawText,12000);out.source=input.source==='voice'?'voice':'manual';
 out.abnormal=!!input.abnormal;out.abnormalNote=text(input.abnormalNote,600);
 out.chronicCount=Number(input.chronicCount||0);
 if(!Number.isInteger(out.chronicCount)||out.chronicCount<0||out.chronicCount>20)fail('疾病数量须为 0–20 的整数');
 out.urgency=['常规','优先','紧急'].includes(input.urgency)?input.urgency:'常规';
 out.referralNeeded=!!input.referralNeeded;
 out.followupDate=text(input.followupDate,10);
 if(out.followupDate&&(!validDate(out.followupDate)||out.followupDate<out.visitDate))fail('复诊日期应不早于就诊日期');
 if(archive){
  if(!out.chiefComplaint||!out.presentIllness||!out.diagnosis||!out.plan)fail('归档前请补齐主诉、现病史、诊断和处理意见');
  if(!out.allergies)fail('归档前请核实过敏史；不详请明确记录“未核实”');
  if(out.abnormal&&!out.abnormalNote)fail('请说明异常指标或体征');
  if(input.reviewConfirmed!==true)fail('请确认已核对病历内容');
 }
 return out;
}
function template(raw){
 const out={};FIELDS.forEach(f=>out[f.key]='');
 const labels={主诉:'chiefComplaint',现病史:'presentIllness',既往史:'pastHistory',过敏史:'allergies',体格检查:'examination',辅助检查:'tests',诊断:'diagnosis',处理意见:'plan',随访计划:'followup'};
 const lines=String(raw).split(/\n/);let key='';
 lines.forEach(line=>{const m=line.match(/^\s*([^：:]+)[：:](.*)$/);if(m&&labels[m[1]]){key=labels[m[1]];out[key]=m[2].trim();}else if(key){out[key]+='\n'+line;}});
 if(!out.presentIllness)out.presentIllness=text(raw,2000);
 return out;
}
function age(birth,now=dateOnly()){let n=Number(now.slice(0,4))-Number(birth.slice(0,4));if(now.slice(5)<birth.slice(5))n--;return n;}
function priority(residents,records,filters,now=Date.now()){
 const rows=[]; const days=Math.max(1,Number(filters.days)||90);const min=Math.max(1,Number(filters.minChronic)||2);
 residents.forEach(p=>{
  const visits=records.filter(r=>r.patientId===p._id&&r.status==='archived').sort((a,b)=>b.visitDate.localeCompare(a.visitDate)||b.updatedAt-a.updatedAt);
  if(!visits.length)return;
  const latest=visits[0];const elapsed=Math.max(0,Math.floor((Date.parse(dateOnly(now))-Date.parse(latest.visitDate))/86400000));
  const reasons=[];
  if(filters.complex&&latest.chronicCount>=min)reasons.push('已记录 '+latest.chronicCount+' 种疾病');
  if(filters.abnormal&&latest.abnormal)reasons.push(latest.abnormalNote||'医师标记异常');
  if(filters.overdue&&elapsed>=days)reasons.push(elapsed+' 天未复诊');
  if(!reasons.length)return;
  rows.push(Object.assign({},p,{age:age(p.birthDate),reasons,lastVisit:latest.visitDate,days:elapsed,urgency:latest.urgency,latestRecordId:latest._id}));
 });
 const rank={紧急:3,优先:2,常规:1};
 return rows.sort((a,b)=>rank[b.urgency]-rank[a.urgency]||b.reasons.length-a.reasons.length||b.days-a.days);
}
function statistics(residents,records,services,exports,range={}){
 const within=s=>(!range.start||s>=range.start)&&(!range.end||s<=range.end);
 const map={}; residents.forEach(p=>{if(!map[p.village])map[p.village]={village:p.village,residents:0,visits:0,referrals:0,followups:0,experts:0,priority:0};map[p.village].residents++;});
 const pmap={};residents.forEach(p=>pmap[p._id]=p);
 const rr=records.filter(r=>r.status==='archived'&&within(r.visitDate));
 rr.forEach(r=>{const p=pmap[r.patientId];if(p)map[p.village].visits++;});
 exports.filter(e=>e.kind==='referral'&&e.status==='ready'&&within(dateOnly(e.createdAt))).forEach(e=>{const p=pmap[e.patientId];if(p)map[p.village].referrals++;});
 const ss=services.filter(s=>within(s.serviceDate));
 ss.forEach(s=>{const p=pmap[s.patientId];if(p){map[p.village].experts++;if(s.type==='随访')map[p.village].followups++;}});
 const candidates=priority(residents,records,{complex:true,abnormal:true,overdue:true,days:90,minChronic:2});
 candidates.forEach(p=>map[p.village].priority++);
 const rows=Object.values(map).map(r=>Object.assign(r,{suggestedExperts:Math.ceil(r.priority/Math.max(1,Number(range.capacity)||12))}));
 const max=Math.max(1,...rows.map(r=>r.visits));rows.forEach(r=>r.percent=Math.round(r.visits/max*100));
 return {rows,total:{residents:residents.length,visits:rr.length,referrals:rows.reduce((n,r)=>n+r.referrals,0),experts:ss.length,followups:rows.reduce((n,r)=>n+r.followups,0)},candidates:candidates.length};
}
function dashboard(s,now=Date.now()){
 const rosters=s.rosters||[];const services=s.services||[];const exports=s.exports||[];
 const candidates=priority(s.residents,s.records,{complex:true,abnormal:true,overdue:true,days:90,minChronic:2},now);
 const screening=candidates.filter(p=>!rosters.some(r=>r.recordIdsByPatient&&r.recordIdsByPatient[p._id]===p.latestRecordId)).length;
 return {residents:s.residents.length,archived:s.records.filter(r=>r.status==='archived').length,
  drafts:s.records.filter(r=>r.status==='draft').map(r=>Object.assign({},r,{patient:s.residents.find(p=>p._id===r.patientId)})),
  referrals:s.records.filter(r=>r.status==='archived'&&r.referralNeeded&&!exports.some(e=>e.status==='ready'&&Array.isArray(e.recordIds)&&e.recordIds.includes(r._id))).length,
  screening,rosters:rosters.filter(r=>r.patientIds.some(id=>!services.some(v=>v.rosterId===r._id&&v.patientId===id))).length};
}
module.exports={FIELDS,text,dateOnly,validDate,patient,record,template,priority,statistics,dashboard,age};
