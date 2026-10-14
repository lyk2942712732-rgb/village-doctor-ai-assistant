const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function harness(){let definition;const regionResponses=[];let confirm=true;let admin=true;const app={globalData:{profile:null,demo:false}};const ui={guard(){return true;},async run(p,fn){p.setData({busy:true,error:''});try{return await fn();}catch(e){p.setData({error:e.message});}finally{p.setData({busy:false});}},confirm:async()=>confirm,toast(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/clinic/index'),'utf8'),{require(name){return name.endsWith('/ui')?ui:name.endsWith('/domain')?require('../miniprogram/utils/domain'):{async call(action){if(action==='regionOptions')return await (regionResponses.shift()||{options:[]});return {clinic:{_id:'clinic',version:2,name:'服务器新名称'},profile:{role:admin?'admin':'doctor'},isAdmin:admin,members:[],invites:[],memberCount:1};}};},Page(p){definition=p;},getApp(){return app;},wx:{},Date,Math});
 const p={...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(values){for(const [key,value] of Object.entries(values)){const parts=key.split('.');let target=this.data;for(const part of parts.slice(0,-1))target=target[part];target[parts.at(-1)]=value;}}};
 return {p,app,regionResponses,setConfirm(v){confirm=v;},setAdmin(v){admin=v;}};
}
test('刷新成员或邀请码保留未保存资料及原始版本，避免绕过版本冲突',async()=>{
 const h=harness();h.p.data.clinic={_id:'clinic',version:1,name:'原始名称'};h.p.data.form={name:'原始名称'};h.p.input({currentTarget:{dataset:{key:'name'}},detail:{value:'尚未保存的修改'}});await h.p.load();assert.equal(h.p.data.form.name,'尚未保存的修改');assert.equal(h.p.data.clinic.version,1);
 h.setConfirm(false);await h.p.reload();assert.equal(h.p.data.formDirty,true);assert.equal(h.p.data.form.name,'尚未保存的修改');h.setConfirm(true);await h.p.reload();assert.equal(h.p.data.form.name,'服务器新名称');assert.equal(h.p.data.clinic.version,2);assert.equal(h.p.data.formDirty,false);
});
test('失去负责人权限时清除完整邀请码并更新为只读资料',async()=>{
 const h=harness();h.p.data.clinic={_id:'clinic',version:1};h.p.data.form={name:'旧修改'};h.p.data.formDirty=true;h.p.data.latestInvite={code:'私下交付的旧码'};h.setAdmin(false);await h.p.load();assert.equal(h.p.data.latestInvite,null);assert.equal(h.p.data.isAdmin,false);assert.equal(h.p.data.formDirty,false);assert.equal(h.app.globalData.profile.role,'doctor');assert.equal(h.p.data.form.name,'服务器新名称');
});
test('离开管理页清除完整邀请码，保留未保存的机构资料',()=>{
 const h=harness();h.p.data.latestInvite={code:'一次展示的私密邀请码'};h.p.data.formDirty=true;h.p.data.form.name='尚未保存';h.p.onHide();assert.equal(h.p.data.latestInvite,null);assert.equal(h.p.data.formDirty,true);assert.equal(h.p.data.form.name,'尚未保存');
});

test('变更上级清空下级和服务村庄；较早请求不能覆盖新选择',async()=>{
 const h=harness();h.p.data.creating=true;h.p.data.form={province:'黑龙江省',city:'旧市',county:'旧县',township:'旧镇',village:'旧村',regionCodes:['23','2301','230102','230102001','230102001001'],serviceVillageCodes:['230102001001'],serviceVillages:'旧村'};h.p.data.regionOptions=[[{code:'23',name:'黑龙江省'},{code:'22',name:'吉林省'}],[{code:'2301',name:'哈尔滨市'}],[],[],[]];let finishOld;h.regionResponses.push(new Promise(resolve=>finishOld=resolve),{options:[{code:'2201',name:'长春市'}]});const old=h.p.regionChange({currentTarget:{dataset:{level:0}},detail:{value:0}});assert.equal(h.p.data.form.county,'');assert.deepEqual(Array.from(h.p.data.form.serviceVillageCodes),[]);await h.p.regionChange({currentTarget:{dataset:{level:0}},detail:{value:1}});finishOld({options:[{code:'2301',name:'哈尔滨市'}]});await old;assert.equal(h.p.data.form.province,'吉林省');assert.equal(h.p.data.regionOptions[1][0].name,'长春市');assert.equal(h.p.data.regionLoading,false);
});
