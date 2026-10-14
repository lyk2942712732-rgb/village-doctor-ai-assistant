const test=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');
const store={};const clone=x=>JSON.parse(JSON.stringify(x));
function collection(name){store[name]||={};return {doc(id){return {async get(){return {data:store[name][id]?{_id:id,...clone(store[name][id])}:null};},async set({data}){store[name][id]=clone(data);},async update({data}){Object.assign(store[name][id],clone(data));}};},where(filter){let offset=0,limit=100;return {orderBy(){return this;},skip(n){offset=n;return this;},limit(n){limit=n;return this;},async get(){return {data:Object.entries(store[name]).map(([id,v])=>({_id:id,...clone(v)})).filter(v=>Object.entries(filter).every(([k,x])=>v[k]===x)).sort((a,b)=>a._id.localeCompare(b._id)).slice(offset,offset+limit)};}};}};}
const db={collection,async runTransaction(fn){const before=clone(store);try{return await fn(db);}catch(e){for(const k of Object.keys(store))delete store[k];Object.assign(store,before);throw e;}}};
let openid='owner';const cloud={init(){},database:()=>db,getWXContext:()=>({OPENID:openid,APPID:'wx-test'})};
const original=Module._load;Module._load=function(name,...args){if(name==='wx-server-sdk')return cloud;return original.call(this,name,...args);};const api=require('../cloudfunctions/medicalApi');Module._load=original;
const form={name:'卫生室甲',regionCodes:['23','2301','230102','230102001','230102001001'],address:'测试地址'};
async function call(action,data={},identity='owner'){openid=identity;return api.main({action,data:clinicId&&!['login','createClinic','myClinics','joinClinic','selectClinic'].includes(action)?{clinicId,...data}:data});}
let clinicId,invite;
test('首次创建建立卫生室实体和负责人，重复请求幂等且可创建多个卫生室',async()=>{
 await call('login',{name:'负责人甲'});const data={name:'负责人甲',clinic:form,requestId:'create_request_001'};const r=await call('createClinic',data);assert.equal(r.ok,true);clinicId=r.data.profile.clinicId;assert.equal(r.data.profile.role,'admin');assert.equal(store.clinics[clinicId].ownerId,'owner');assert.equal(store.doctors.owner.clinicId,clinicId);
 assert.equal((await call('createClinic',data)).data.profile.clinicId,clinicId);assert.equal(Object.keys(store.clinics).length,1);
 assert.equal((await call('createClinic',{...data,requestId:'different_request'})).ok,true);assert.equal(Object.keys(store.doctors.owner.memberships).length,2);assert.equal((await call('createClinic',{name:'乙',clinic:{name:'缺少地址'},requestId:'valid_request_002'},'other')).ok,false);assert.equal(store.doctors.other,undefined);
});
test('负责人生成真实限次邀请码；加入绑定本室且不能通过参数获得管理权限',async()=>{
 const r=await call('createClinicInvite',{days:7,maxUses:1});assert.equal(r.ok,true);invite=r.data;assert.equal(store.invitations[invite.id].code,undefined);assert.equal(store.invitations[invite.id].clinicId,clinicId);
 const join=await call('login',{invite:invite.code,name:'医师乙',role:'admin',clinicId:'forged'},'member');assert.equal(join.ok,true);assert.equal(join.data.clinicId,clinicId);assert.equal(join.data.role,'doctor');assert.equal(store.invitations[invite.id].used,1);
 const refused=await call('login',{invite:invite.code,name:'医师丙'},'third');assert.equal(refused.ok,true);assert.match(refused.data.joinError,/上限/);assert.equal(refused.data.clinicId,'');
});
test('普通医师可查看本室资料及成员工作量，不能编辑、邀请、停用成员或移交负责人',async()=>{
 const info=await call('clinicInfo',{},'member');assert.equal(info.ok,true);assert.equal(info.data.isAdmin,false);assert.equal(info.data.members.length,2);assert.equal(info.data.members[0].performance.records,0);assert.deepEqual(info.data.invites,[]);assert.equal(info.data.memberCount,2);
 for(const action of ['updateClinic','createClinicInvite','setClinicMember','transferClinic','revokeClinicInvite'])assert.equal((await call(action,{},'member')).ok,false);
});
test('资料版本检查和卫生室名称使用实体值，不被过期邀请码名称覆盖',async()=>{
 const r=await call('updateClinic',{clinic:{...form,name:'新卫生室名称',ownerId:'forged'},version:1});assert.equal(r.ok,true);assert.equal(store.clinics[clinicId].ownerId,'owner');
 assert.equal((await call('updateClinic',{clinic:form,version:1})).ok,false);assert.equal((await call('login',{},'member')).data.clinicName,'新卫生室名称');
 const code=await call('createClinicInvite',{days:7,maxUses:2});store.invitations[code.data.id].clinicName='旧名称';const joined=await call('login',{invite:code.data.code,name:'医师丙'},'third');assert.equal(joined.data.clinicName,'新卫生室名称');
});
test('邀请码到期、停用及未建档卫生室不能加入，但可独立登录',async()=>{
 for(const kind of ['expired','revoked','missing']){
  const r=await call('createClinicInvite',{days:7,maxUses:2});if(kind==='expired')store.invitations[r.data.id].expiresAt=Date.now()-1;
  if(kind==='revoked')assert.equal((await call('revokeClinicInvite',{id:r.data.id})).ok,true);
  if(kind==='missing')store.invitations[r.data.id].clinicId='not-created';
  const logged=await call('login',{invite:r.data.code,name:'独立账号'},kind);assert.equal(logged.ok,true);assert.equal(logged.data.clinicId,'');assert.ok(logged.data.joinError);assert.equal(Object.keys(store.doctors[kind].memberships).length,0);
 }
});
test('不能操作其他卫生室成员、邀请码或当前负责人，移除后保留登录能力，旧卫生室会话无档案访问权',async()=>{
 store.doctors.foreign={clinicId:'foreign-clinic',enabled:true,role:'doctor'};store.invitations.foreign={clinicId:'foreign-clinic',enabled:true};
 assert.equal((await call('setClinicMember',{memberId:'foreign',enabled:false})).ok,false);assert.equal((await call('revokeClinicInvite',{id:'foreign'})).ok,false);assert.equal((await call('setClinicMember',{memberId:'owner',enabled:false})).ok,false);
 assert.equal((await call('setClinicMember',{memberId:'member',enabled:false})).ok,true);assert.equal((await call('residents',{},'member')).ok,false);assert.equal((await call('login',{},'member')).ok,true);assert.equal((await call('login',{},'member')).data.clinicId,'');
 assert.equal((await call('setClinicMember',{memberId:'member',enabled:true})).ok,true);
});
test('负责人移交原子更新权限，原负责人旧页面不能继续管理',async()=>{
 const r=await call('transferClinic',{memberId:'member'});assert.equal(r.ok,true);assert.equal(store.clinics[clinicId].ownerId,'member');assert.equal(store.doctors.member.memberships[clinicId].role,'admin');assert.equal(store.doctors.owner.memberships[clinicId].role,'doctor');
 assert.equal((await call('createClinicInvite',{days:7,maxUses:1},'owner')).ok,false);assert.equal((await call('createClinicInvite',{days:7,maxUses:1},'member')).ok,true);
});


test('未加入也可独立登录，但所有诊疗接口拒绝未加入账号',async()=>{
 const r=await call('login',{},'solo');assert.equal(r.ok,true);assert.equal(r.data.clinicId,'');assert.deepEqual(r.data.clinics,[]);
 for(const action of ['residents','dashboard','generate','saveRecord','reserveAudio','stats'])assert.equal((await call(action,{},'solo')).ok,false);
});

test('同一账号加入多个卫生室，角色按卫生室隔离，重复加入不耗邀请码次数',async()=>{
 const second=Object.keys(store.doctors.owner.memberships).find(id=>id!==clinicId);
 const created=await call('createClinicInvite',{clinicId:second,days:7,maxUses:3});assert.equal(created.ok,true);
 const joined=await call('joinClinic',{invite:created.data.code},'third');assert.equal(joined.ok,true);assert.equal(joined.data.clinics.length,2);
 const used=store.invitations[created.data.id].used;await call('joinClinic',{invite:created.data.code},'third');assert.equal(store.invitations[created.data.id].used,used);
 assert.equal((await call('createClinicInvite',{clinicId:second,days:7,maxUses:1},'third')).ok,false);
 store.residents||={};store.residents.room1={clinicId,code:'ROOM1',name:'虚构居民甲',birthDate:'1950-01-01',sex:'女',village:'测试村'};store.residents.room2={clinicId:second,code:'ROOM2',name:'虚构居民乙',birthDate:'1950-01-01',sex:'男',village:'测试村'};
 assert.deepEqual((await call('residents',{clinicId:second},'third')).data.map(p=>p.code),['ROOM2']);assert.equal((await call('history',{clinicId:second,patientId:'room1'},'third')).ok,false);
 assert.equal((await call('selectClinic',{clinicId},'third')).data.clinicId,clinicId);
});

test('成员主动退出一个卫生室，保留其他卫生室及正常登录；负责人必须移交或解散',async()=>{
 const second=Object.keys(store.doctors.owner.memberships).find(id=>id!==clinicId);
 assert.equal((await call('leaveClinic',{clinicId},'member')).ok,false);
 const left=await call('leaveClinic',{clinicId},'third');assert.equal(left.ok,true);assert.equal(left.data.clinics.length,1);assert.equal(left.data.clinicId,second);
 assert.equal((await call('residents',{clinicId},'third')).ok,false);assert.equal((await call('residents',{clinicId:second},'third')).ok,true);assert.equal((await call('login',{},'third')).ok,true);
});

test('负责人移除本室成员，不影响其其他卫生室；旧请求及事务写入被拒绝',async()=>{
 const second=Object.keys(store.doctors.owner.memberships).find(id=>id!==clinicId);
 const invite=await call('createClinicInvite',{clinicId,days:7,maxUses:3},'member');await call('joinClinic',{invite:invite.data.code},'third');
 assert.equal((await call('removeClinicMember',{clinicId,memberId:'third'},'member')).ok,true);assert.equal((await call('login',{},'third')).data.clinicId,second);
 await assert.rejects(()=>api._test.saveRecord({clinicId,name:'医师丙'},'third',{requestId:'stale_request_123',patient:{code:'P100',name:'虚构',sex:'未知',birthDate:'1950-01-01',village:'测试村'},record:{visitDate:'2026-10-12'},archive:false}),/不属于/);
 assert.equal((await call('residents',{clinicId:second},'third')).ok,true);
});

test('绩效按卫生室、归档医师、时间范围统计，排除草稿和其他卫生室',async()=>{
 const stamp=Date.parse('2026-10-12T02:00:00Z');const other=Object.keys(store.doctors.owner.memberships).find(id=>id!==clinicId);
 store.records={a:{clinicId,status:'archived',doctorId:'member',patientId:'p1',archivedAt:stamp},b:{clinicId,status:'archived',doctorId:'member',patientId:'p1',archivedAt:stamp},c:{clinicId,status:'draft',doctorId:'member',patientId:'p2',updatedAt:stamp},d:{clinicId:other,status:'archived',doctorId:'member',patientId:'p3',archivedAt:stamp},e:{clinicId,status:'archived',doctorId:'member',patientId:'p4',archivedAt:Date.parse('2026-09-01T00:00:00Z')}};
 store.exports={x:{clinicId,status:'ready',kind:'referral',ownerId:'member',createdAt:stamp},y:{clinicId,status:'ready',kind:'stats',ownerId:'member',createdAt:stamp}};
 store.services={x:{clinicId,doctorId:'member',type:'随访',createdAt:stamp}};
 const r=await call('clinicInfo',{clinicId,start:'2026-10-01',end:'2026-10-12'},'owner');assert.equal(r.ok,true);const m=r.data.members.find(m=>m.id==='member');assert.deepEqual(m.performance,{records:2,patients:1,referrals:1,expertNotes:1,followups:1});
 assert.equal((await call('clinicInfo',{clinicId,start:'2026-10-12',end:'2026-10-01'},'owner')).ok,false);
});

test('解散由负责人确认名称，所有成员和邀请码失效，历史档案及其他卫生室保留',async()=>{
 const before=Object.keys(store.records).length;const second=Object.keys(store.doctors.owner.memberships).find(id=>id!==clinicId);const code=await call('createClinicInvite',{clinicId,days:7,maxUses:3},'member');
 assert.equal((await call('dissolveClinic',{clinicId,confirmName:'错误名称'},'member')).ok,false);assert.equal((await call('dissolveClinic',{clinicId,confirmName:store.clinics[clinicId].name},'owner')).ok,false);
 const r=await call('dissolveClinic',{clinicId,confirmName:store.clinics[clinicId].name},'member');assert.equal(r.ok,true);assert.equal(store.clinics[clinicId].enabled,false);assert.equal(Object.keys(store.records).length,before);
 assert.equal((await call('residents',{clinicId},'owner')).ok,false);assert.equal((await call('joinClinic',{invite:code.data.code},'owner')).ok,false);assert.equal((await call('login',{},'owner')).data.clinicId,second);
 assert.equal((await call('residents',{clinicId:second},'owner')).ok,true);
});
test('无卫生室账号可读取地区目录；缺失地区或跨乡镇服务村不能创建机构',async()=>{
 await call('login',{name:'地区验收医师'},'region-account');const directory=await call('regionOptions',{parent:'23'},'region-account');assert.equal(directory.ok,true);assert.ok(directory.data.options.some(o=>o.name==='哈尔滨市'));const before=Object.keys(store.clinics).length;
 const missing=await call('createClinic',{name:'地区验收医师',clinic:{name:'缺失地区',county:'手输县',township:'手输乡',address:'地址'},requestId:'region_missing_123'},'region-account');assert.equal(missing.ok,false);
 const wrong=await call('createClinic',{name:'地区验收医师',clinic:{...form,serviceVillageCodes:['110101001001']},requestId:'region_wrong_123'},'region-account');assert.equal(wrong.ok,false);assert.equal(Object.keys(store.clinics).length,before);
});
test('机构保存从目录确定地区名称，不采信客户端伪造名称',async()=>{
 const r=await call('createClinic',{name:'地区验收医师',clinic:{...form,province:'伪造省',city:'伪造市',county:'伪造县',township:'伪造乡',village:'伪造村'},requestId:'region_valid_123'},'region-account');assert.equal(r.ok,true);assert.equal(r.data.clinic.province,'黑龙江省');assert.equal(r.data.clinic.city,'哈尔滨市');assert.equal(r.data.clinic.county,'道里区');assert.equal(r.data.clinic.serviceVillageCodes[0],form.regionCodes[4]);assert.notEqual(r.data.clinic.serviceVillages,'伪造村');
});
test('未注册账号可校时，不获得诊疗权限也不创建医师资料',async()=>{const r=await call('serverTime',{},'unregistered-clock');assert.equal(r.ok,true);assert.ok(Math.abs(r.data.epoch-Date.now())<1000);assert.equal(store.doctors['unregistered-clock'],undefined);assert.equal((await call('residents',{},'unregistered-clock')).ok,false);});
