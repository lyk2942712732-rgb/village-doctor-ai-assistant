const api=require('../../utils/api');const ui=require('../../utils/ui');const d=require('../../utils/domain');const local=require('../../utils/local-context');
Page({
 data:{locationLabel:'',locationRegion:[],beijingClock:'',profile:null,busy:false,error:'',invite:'',doctorName:'',today:d.dateOnly(),summary:{residents:0,archived:0,drafts:[],referrals:0,screening:0,rosters:0},demo:false},
 onShow(){this._visible=true;const saved=wx.getStorageSync('village-doctor-local-region');const label=local.placeLabel(saved);this.setData({locationLabel:label,locationRegion:label?saved:[]});this.startClock();this.syncClock();ui.tab(this,0);this.setData({profile:getApp().globalData.profile,demo:getApp().globalData.demo});if(this.data.profile)this.refresh();},
 onHide(){this._visible=false;this.stopClock();},onUnload(){this._visible=false;this.stopClock();},
 tick(){const value=local.beijingTime(Date.now()+(this._clockOffset||0));this.setData({beijingClock:value.time,today:value.today});},
 startClock(){this.stopClock();this.tick();this._clockTimer=setInterval(()=>this.tick(),1000);},
 stopClock(){if(this._clockTimer)clearInterval(this._clockTimer);this._clockTimer=null;},
 async syncClock(){const started=Date.now();try{const result=await api.call('serverTime');const ended=Date.now();if(!this._visible||!Number.isFinite(result.epoch)||ended-started>10000)return;this._clockOffset=result.epoch-(started+ended)/2;this.tick();}catch(e){/* 离线时按设备时钟换算 UTC+8，保持登录可用。 */}},
 chooseRegion(e){const region=e.detail.value;const label=local.placeLabel(region);if(!label)return;wx.setStorageSync('village-doctor-local-region',region);this.setData({locationRegion:region,locationLabel:label});},
 input(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value});},
 login(){ui.run(this,async()=>{const profile=await api.call('login',{invite:this.data.invite,name:this.data.doctorName});getApp().globalData.profile=profile;this.setData({profile});if(profile.joinError)this.setData({error:'已登录，加入卫生室失败：'+profile.joinError});await this.refresh();});},
 enterDemo(){getApp().globalData.demo=true;this.login();this.setData({demo:true});},
 async refresh(){try{const profile=await api.call('myClinics');getApp().globalData.profile=profile;this.setData({profile});if(profile.clinicId)this.setData({summary:await api.call('dashboard')});else this.setData({summary:{residents:0,archived:0,drafts:[],referrals:0,screening:0,rosters:0}});}catch(e){ui.showError(this,e);}},
 navigate(e){if(ui.guard())ui.go(e.currentTarget.dataset.page);},
 createClinic(){if(!getApp().globalData.profile)return;getApp().globalData.demo=false;wx.navigateTo({url:'/pages/clinic/index?mode=create'});},
 clinic(){if(getApp().globalData.demo){ui.showError(this,new Error('请退出演示并使用微信身份登录后管理卫生室'));return;}wx.navigateTo({url:'/pages/clinic/index'});},
 editDraft(e){wx.navigateTo({url:'/pages/record/index?id='+e.currentTarget.dataset.id});},
 logout(){getApp().globalData.profile=null;getApp().globalData.demo=false;this.setData({profile:null,demo:false,invite:'',doctorName:'',error:''});},
 reset(){ui.run(this,async()=>{if(await ui.confirm('重置演示数据','所有演示操作将被清除，恢复示例居民和病历。')){await api.call('resetDemo');await this.refresh();}});}
});
