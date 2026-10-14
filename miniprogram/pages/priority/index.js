const api=require('../../utils/api');const ui=require('../../utils/ui');const d=require('../../utils/domain');
Page({
 data:{busy:false,error:'',filters:{complex:true,abnormal:true,overdue:true,days:90,minChronic:2},rows:[],selected:[],selectedCount:0,ran:false,title:'本次专家下乡接诊',serviceDate:d.dateOnly(),roster:null},
 call(action,data={}){const id=this._clinicId||(getApp().globalData.profile&&getApp().globalData.profile.clinicId);return api.call(action,Object.assign({},data,id?{clinicId:id}:{}));},
 onShow(){ui.tab(this,2);if(ui.guard()){const id=getApp().globalData.profile.clinicId;if(this._clinicId!==id){this._clinicId=id;this.setData({rows:[],selected:[],selectedCount:0,ran:false,roster:null,error:''});}}},
 toggle(e){this.setData({['filters.'+e.currentTarget.dataset.key]:e.detail.value,ran:false,roster:null,selected:[],selectedCount:0,rows:[]});},
 input(e){this.setData({['filters.'+e.currentTarget.dataset.key]:e.detail.value,ran:false,roster:null,selected:[],selectedCount:0,rows:[]});},
 meta(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value,roster:null});},
 filter(){ui.run(this,async()=>{const f=this.data.filters;if(!f.complex&&!f.abnormal&&!f.overdue)throw new Error('请至少选择一个筛选维度');const rows=await this.call('priority',f);this.setData({rows:rows.map(p=>Object.assign({},p,{selected:false})),selected:[],selectedCount:0,ran:true,roster:null});});},
 select(e){const id=e.currentTarget.dataset.id;const selected=this.data.selected.includes(id)?this.data.selected.filter(p=>p!==id):this.data.selected.concat(id);this.setData({selected,selectedCount:selected.length,rows:this.data.rows.map(p=>Object.assign({},p,{selected:selected.includes(p._id)})),roster:null});},
 all(){const selected=this.data.selected.length===this.data.rows.length?[]:this.data.rows.map(p=>p._id);this.setData({selected,selectedCount:selected.length,rows:this.data.rows.map(p=>Object.assign({},p,{selected:selected.includes(p._id)})),roster:null});},
 save(){ui.run(this,async()=>{if(!this.data.selected.length)throw new Error('请人工勾选要接诊的居民');if(!(await ui.confirm('确认本次接诊名单','筛选仅供参考。请确认勾选居民、接诊日期和名单名称。')))return;const recordIdsByPatient={};this.data.rows.filter(p=>this.data.selected.includes(p._id)).forEach(p=>{recordIdsByPatient[p._id]=p.latestRecordId;});const r=await this.call('saveRoster',{patientIds:this.data.selected,recordIdsByPatient,filters:this.data.filters,title:this.data.title,serviceDate:this.data.serviceDate});this.setData({roster:r});ui.toast('名单已确认保存');});},
 export(){ui.run(this,async()=>{if(!this.data.roster)throw new Error('请先确认并保存名单');await ui.openExport(this,{kind:'roster',rosterId:this.data.roster._id});});},
 outreach(){wx.navigateTo({url:'/pages/outreach/index'+(this.data.roster?'?rosterId='+this.data.roster._id:'')});}
});
