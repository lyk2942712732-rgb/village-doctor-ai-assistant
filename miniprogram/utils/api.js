const config=require('../config');
const demo=require('./demo');
async function call(action,data={}){
 if(getApp().globalData.demo)return demo.call(action,data);
 if(!config.env)throw new Error('尚未连接云环境，请填写 miniprogram/config.js 中的 env，或先体验演示');
 const accountOnly=['login','createClinic','myClinics','joinClinic','selectClinic','updateDoctorName','regionOptions','serverTime'].includes(action);const profile=getApp().globalData.profile;const clinicId=accountOnly?'':(data.clinicId||profile&&profile.clinicId);if(!accountOnly&&!clinicId)throw new Error('请先加入或创建卫生室');if(!accountOnly&&profile&&data.clinicId&&profile.clinicId!==data.clinicId)throw new Error('卫生室已切换，请重新打开页面');const payload=accountOnly?data:Object.assign({},data,{clinicId});
 try{
  const response=await wx.cloud.callFunction({name:config.functionName,data:{action,data:payload},config:{timeout:60000}});
  const result=response.result;
  if(!result||!result.ok)throw new Error(result&&result.message||'云服务未返回结果');
  if(!accountOnly&&(!getApp().globalData.profile||getApp().globalData.profile.clinicId!==clinicId))throw new Error('卫生室已切换，请重新打开页面');
  return result.data;
 }catch(e){if(e.errMsg)throw new Error('云服务连接失败，请检查环境及 medicalApi 是否已部署');throw e;}
}
module.exports={call};
