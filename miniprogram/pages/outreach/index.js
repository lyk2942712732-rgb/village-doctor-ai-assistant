const api=require('../../utils/api');const ui=require('../../utils/ui');const d=require('../../utils/domain');
Page({
 data:{busy:false,error:'',rosters:[],roster:null,patient:null,types:['专家诊疗','随访'],form:{expertName:'',specialty:'',serviceDate:d.dateOnly(),type:'专家诊疗',opinion:'',followup:''}},
 call(action,data={}){const id=this._clinicId||(getApp().globalData.profile&&getApp().globalData.profile.clinicId);return api.call(action,Object.assign({},data,id?{clinicId:id}:{}));},
 onLoad(o){if(ui.guard()){this._clinicId=getApp().globalData.profile.clinicId;this.load(o.rosterId);}},
 async load(id){await ui.run(this,async()=>{const rows=await this.call('rosters');this.setData({rosters:rows});if(id){const roster=rows.find(r=>r._id===id);if(roster)this.setData({roster,'form.serviceDate':roster.serviceDate});}});},
 choose(e){const roster=this.data.rosters.find(r=>r._id===e.currentTarget.dataset.id);this.setData({roster,patient:null,'form.serviceDate':roster.serviceDate});},
 choosePatient(e){const p=this.data.roster.patients.find(p=>p._id===e.currentTarget.dataset.id);if(p.done){ui.toast('本次诊疗已归档');return;}this.setData({patient:p,'form.opinion':'','form.followup':'',error:''});},
 back(){this.setData({roster:null,patient:null});this.load();},
 input(e){this.setData({['form.'+e.currentTarget.dataset.key]:e.detail.value});},
 type(e){this.setData({'form.type':this.data.types[Number(e.detail.value)]});},
 save(){ui.run(this,async()=>{if(!this.data.form.expertName.trim()||!this.data.form.opinion.trim())throw new Error('请填写专家姓名和诊疗意见');if(!(await ui.confirm('归档专家诊疗意见','确认本次专家意见准确，并关联到 '+this.data.patient.name+' 的健康档案。')))return;const oldId=this.data.roster._id;await this.call('saveService',Object.assign({},this.data.form,{rosterId:oldId,patientId:this.data.patient._id}));this.setData({patient:null});ui.toast('诊疗意见已归档');const rosters=await this.call('rosters');this.setData({rosters,roster:rosters.find(r=>r._id===oldId)});});},
 priority(){ui.go('priority');}
});
