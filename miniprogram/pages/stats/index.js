const api=require('../../utils/api');const ui=require('../../utils/ui');const d=require('../../utils/domain');
Page({
 data:{busy:false,error:'',range:{start:d.dateOnly().slice(0,7)+'-01',end:d.dateOnly(),capacity:12},stats:{rows:[],total:{residents:0,visits:0,referrals:0,experts:0,followups:0}},dirty:false},
 call(action,data={}){const id=this._clinicId||(getApp().globalData.profile&&getApp().globalData.profile.clinicId);return api.call(action,Object.assign({},data,id?{clinicId:id}:{}));},
 onShow(){ui.tab(this,3);if(ui.guard()){const id=getApp().globalData.profile.clinicId;if(this._clinicId!==id){this._clinicId=id;this.setData({stats:{rows:[],total:{residents:0,visits:0,referrals:0,experts:0,followups:0}},dirty:false,error:''});}this.refresh();}},
 input(e){this.setData({['range.'+e.currentTarget.dataset.key]:e.detail.value,dirty:true});},
 refresh(){ui.run(this,async()=>{if(this.data.range.start>this.data.range.end)throw new Error('开始日期不能晚于结束日期');this.setData({stats:await this.call('stats',this.data.range),dirty:false});});},
 export(){ui.run(this,async()=>{if(this.data.dirty)throw new Error('筛选条件已变化，请先更新统计');await ui.openExport(this,{kind:'stats',range:this.data.range});});}
});
