// RecorderManager 是全局单例，只注册一组监听，避免反复进入页面累积回调。
let manager=null;let active=null;
function notify(session,event,result){
 if(session&&session.owner&&!session.owner._unloaded&&session.handlers)session.handlers[event](result);
}
function stopManager(){try{manager.stop();}catch(e){/* 启动回调到达后再次结束录音。 */}}
function getManager(){
 if(manager)return manager;
 manager=wx.getRecorderManager();
 manager.onStart(()=>{if(active&&!active.owner){stopManager();return;}notify(active,'start');});
 manager.onStop(result=>{const session=active;active=null;notify(session,'stop',result);});
 manager.onError(error=>{const session=active;active=null;notify(session,'error',error);});
 return manager;
}
function start(owner,options,handlers){
 const recorder=getManager();
 if(active)throw new Error('上一段录音正在结束，请稍后再试');
 const session={owner,handlers};active=session;
 try{recorder.start(options);}catch(e){active=null;throw e;}
 return {
  stop(){if(active===session)stopManager();},
  release(){if(active===session){session.owner=null;session.handlers=null;stopManager();}}
 };
}
module.exports={start};
