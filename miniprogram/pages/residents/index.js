const api=require('../../utils/api');const ui=require('../../utils/ui');const d=require('../../utils/domain');
Page({
 data:{query:'',people:[],detail:null,records:[],services:[],busy:false,error:'',selected:[],selectedCount:0,fields:d.FIELDS,opened:''},
 call(action,data={}){const id=this._clinicId||(getApp().globalData.profile&&getApp().globalData.profile.clinicId);return api.call(action,Object.assign({},data,id?{clinicId:id}:{}));},
 onShow(){ui.tab(this,1);if(ui.guard()){const id=getApp().globalData.profile.clinicId;if(this._clinicId!==id){this._clinicId=id;this.setData({people:[],detail:null,records:[],services:[],query:'',selected:[],selectedCount:0,opened:''});}if(this.data.detail)this.open(this.data.detail._id);else this.search();}},
 input(e){this.setData({query:e.detail.value});},
 search(){ui.run(this,async()=>this.setData({people:await this.call('residents',{query:this.data.query.trim()}),detail:null}));},
 async open(id){await ui.run(this,async()=>{const h=await this.call('history',{patientId:id});this.setData({detail:Object.assign({},h.patient,{age:d.age(h.patient.birthDate)}),records:h.records.map(r=>Object.assign({},r,{selected:false})),services:h.services,selected:[],selectedCount:0,opened:''});});},
 patient(e){this.open(e.currentTarget.dataset.id);},
 back(){this.setData({detail:null,selected:[],selectedCount:0});this.search();},
 expand(e){const id=e.currentTarget.dataset.id;this.setData({opened:this.data.opened===id?'':id});},
 select(e){const id=e.currentTarget.dataset.id;const selected=this.data.selected.includes(id)?this.data.selected.filter(v=>v!==id):this.data.selected.concat(id);this.setData({selected,selectedCount:selected.length,records:this.data.records.map(r=>Object.assign({},r,{selected:selected.includes(r._id)}))});},
 all(){const selected=this.data.selected.length===this.data.records.length?[]:this.data.records.map(r=>r._id);this.setData({selected,selectedCount:selected.length,records:this.data.records.map(r=>Object.assign({},r,{selected:selected.includes(r._id)}))});},
 add(){wx.navigateTo({url:'/pages/record/index?patientId='+this.data.detail._id});},
 export(){ui.run(this,async()=>{if(!this.data.selected.length)throw new Error('请勾选要导出的就诊记录');if(await ui.confirm('生成转诊资料包','将导出所选病历及该居民全部专家下乡诊疗记录。请确认用于本次转诊。'))await ui.openExport(this,{kind:'referral',patientId:this.data.detail._id,recordIds:this.data.selected});});}
});
