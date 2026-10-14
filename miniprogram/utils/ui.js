const api=require('./api');
function showError(page,e){if(!page._unloaded)page.setData({error:e.message||'操作失败，请重试'});}
async function run(page,fn){if(page._unloaded||page.data.busy)return;page.setData({busy:true,error:''});try{return await fn();}catch(e){showError(page,e);}finally{if(!page._unloaded)page.setData({busy:false});}}
function guard(options={}){const p=getApp().globalData.profile;if(!p){wx.switchTab({url:'/pages/index/index'});return false;}if(!options.accountOnly&&!p.clinicId){wx.showToast({title:'请先加入或创建卫生室',icon:'none'});wx.navigateTo({url:'/pages/clinic/index'});return false;}return true;}
function tab(page,n){const t=page.getTabBar&&page.getTabBar();if(t)t.setData({selected:n});}
function confirm(title,content){return new Promise(resolve=>wx.showModal({title,content,success:r=>resolve(r.confirm),fail:()=>resolve(false)}));}
function toast(title){wx.showToast({title,icon:'success'});}
function go(path){const tabs=['index','residents','priority','stats'];const url='/pages/'+path+'/index';if(tabs.includes(path))wx.switchTab({url});else wx.navigateTo({url});}
async function openExport(page,data){
 const r=await (page.call?page.call('export',data):api.call('export',data));
 // downloadFile 返回 DownloadTask，必须等待成功回调，不能直接 await 任务对象。
 const download=await new Promise((resolve,reject)=>wx.downloadFile({url:r.url,success:resolve,fail:e=>reject(new Error(/not in domain|不在合法域名/i.test(e.errMsg||'')?'资料下载域名尚未配置，请联系管理员':'资料下载失败，请检查网络后重试'))}));
 if(download.statusCode!==200||!download.tempFilePath)throw new Error('资料下载失败，请重新生成或联系管理员');
 await new Promise((resolve,reject)=>wx.openDocument({filePath:download.tempFilePath,fileType:r.fileType,showMenu:true,success:resolve,fail:()=>reject(new Error('文档打开失败，请稍后重试或联系管理员'))}));
 toast('已生成，可在菜单中保存');
}
module.exports={run,guard,tab,confirm,toast,go,openExport,showError};
