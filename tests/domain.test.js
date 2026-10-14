const test=require('node:test');const assert=require('node:assert/strict');const d=require('../miniprogram/utils/domain');
const valid={visitDate:'2026-01-01',chiefComplaint:'头晕2天',presentIllness:'原文记载',allergies:'未核实',diagnosis:'由医师填写',plan:'由医师填写',reviewConfirmed:true,chronicCount:2};
test('正式归档必须经过医师审核，不能漏写过敏史',()=>{assert.throws(()=>d.record({...valid,reviewConfirmed:false},true),/核对/);assert.throws(()=>d.record({...valid,allergies:''},true),/过敏史/);assert.equal(d.record(valid,true).diagnosis,'由医师填写');});
test('草稿可缺诊断；模板不编造病史、过敏史、诊断和处方',()=>{assert.equal(d.record({visitDate:'2026-01-01'},false).diagnosis,'');const r=d.template('患者说昨晚头晕。');assert.equal(r.presentIllness,'患者说昨晚头晕。');for(const k of ['diagnosis','plan','allergies','pastHistory'])assert.equal(r[k],'');});
test('模板保留否定和单位及多行字段',()=>{const r=d.template('主诉：头晕\n体格检查：血压 145/85 mmHg\n无胸痛\n过敏史：不详');assert.equal(r.examination,'血压 145/85 mmHg\n无胸痛');assert.equal(r.allergies,'不详');});
test('拒绝不存在的日期、未来就诊以及身份缺失',()=>{assert.equal(d.validDate('2026-02-30'),false);assert.throws(()=>d.record({...valid,visitDate:'2999-01-01'},true),/日期/);assert.throws(()=>d.patient({code:'HLJ001',name:'张某',sex:'未知',birthDate:'',village:'幸福村'}),/出生/);});
const people=[{_id:'a',name:'甲',birthDate:'1950-01-01',village:'幸福村'},{_id:'b',name:'乙',birthDate:'1950-01-01',village:'永兴村'}];
test('筛选只取已归档最新记录；草稿异常不会进入结果',()=>{const r=[{_id:'r1',patientId:'a',status:'archived',visitDate:'2026-10-01',chronicCount:1,abnormal:false,urgency:'常规'},{_id:'r2',patientId:'a',status:'draft',visitDate:'2026-10-10',chronicCount:3,abnormal:true,urgency:'紧急'},{_id:'r3',patientId:'b',status:'archived',visitDate:'2026-06-01',chronicCount:2,abnormal:false,urgency:'优先'}];const rows=d.priority(people,r,{complex:true,abnormal:true,overdue:true,days:90,minChronic:2},Date.parse('2026-10-11'));assert.deepEqual(rows.map(r=>r._id),['b']);assert.equal(rows[0].reasons.length,2);});
test('统计按日期排除草稿，转诊按包计数，重点人数跨区间',()=>{const r=[{patientId:'a',status:'archived',visitDate:'2026-10-01',chronicCount:2,urgency:'常规'},{patientId:'a',status:'draft',visitDate:'2026-10-02'},{patientId:'b',status:'archived',visitDate:'2026-01-01',chronicCount:2,urgency:'常规'}];const s=d.statistics(people,r,[{patientId:'a',serviceDate:'2026-10-03',type:'随访'}],[{kind:'referral',status:'ready',patientId:'a',createdAt:Date.parse('2026-10-04'),recordIds:['r1']}],{start:'2026-10-01',end:'2026-10-11',capacity:1});assert.equal(s.total.visits,1);assert.equal(s.total.referrals,1);assert.equal(s.total.followups,1);assert.equal(s.candidates,2);assert.equal(s.rows[1].suggestedExperts,1);});
test('首页待筛选人数按已确认病历快照计算，新就诊重新进入待办',()=>{
 const now=Date.parse('2026-10-11');const records=[{_id:'r1',patientId:'a',status:'archived',visitDate:'2026-10-01',chronicCount:2,urgency:'常规'}];
 const s={residents:people,records,services:[],exports:[],rosters:[]};
 assert.equal(d.dashboard(s,now).screening,1);
 s.rosters.push({_id:'list1',patientIds:['a','b'],recordIdsByPatient:{a:'r1'}});
 assert.equal(d.dashboard(s,now).screening,0);assert.equal(d.dashboard(s,now).rosters,1);
 s.services.push({rosterId:'list1',patientId:'a'});assert.equal(d.dashboard(s,now).rosters,1);
 records.push({...records[0],_id:'r2',visitDate:'2026-10-10'});assert.equal(d.dashboard(s,now).screening,1);
 s.services.push({rosterId:'list1',patientId:'b'});assert.equal(d.dashboard(s,now).rosters,0);
});
