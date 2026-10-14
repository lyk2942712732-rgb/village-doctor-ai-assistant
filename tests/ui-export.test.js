const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function harness(fileType){let downloadOptions,openOptions,toasts=0;
 const uiSource=fs.readFileSync(require.resolve('../miniprogram/utils/ui'),'utf8');const module={exports:{}};
 vm.runInNewContext(uiSource,{module,require(){return {async call(){return {url:'https://example.test/private-file',fileType};}};},wx:{downloadFile(options){downloadOptions=options;return {abort(){},onProgressUpdate(){}};},openDocument(options){openOptions=options;return {};},showToast(){toasts++;}}});
 return {ui:module.exports,get download(){return downloadOptions;},get opened(){return openOptions;},get toasts(){return toasts;}};
}
test('PDF 与 Excel 等待 DownloadTask 回调及文档打开完成，不提前报失败或提示成功',async()=>{
 for(const fileType of ['pdf','xlsx']){
  const h=harness(fileType);let finished=false;const pending=h.ui.openExport({},{}).then(()=>{finished=true;});
  await new Promise(r=>setImmediate(r));assert.equal(finished,false);assert.equal(h.opened,undefined);assert.equal(h.toasts,0);
  h.download.success({statusCode:200,tempFilePath:'wxfile://downloaded.'+fileType});await new Promise(r=>setImmediate(r));
  assert.equal(finished,false);assert.equal(h.opened.fileType,fileType);assert.equal(h.opened.showMenu,true);assert.equal(h.toasts,0);
  h.opened.success({});await pending;assert.equal(finished,true);assert.equal(h.toasts,1);
 }
});
test('HTTP 错误、网络失败及文档打开失败不显示成功',async()=>{
 for(const failure of ['http','network','domain','open']){
  const h=harness('pdf');const pending=h.ui.openExport({},{});const rejection=assert.rejects(pending,/资料下载|文档打开/);
  await new Promise(r=>setImmediate(r));
  if(failure==='http')h.download.success({statusCode:403,tempFilePath:'wxfile://error'});
  else if(failure==='network'||failure==='domain')h.download.fail({errMsg:failure==='domain'?'downloadFile:fail url not in domain list':'downloadFile:fail timeout'});
  else{h.download.success({statusCode:200,tempFilePath:'wxfile://document.pdf'});await new Promise(r=>setImmediate(r));h.opened.fail({errMsg:'openDocument:fail'});}
  await rejection;assert.equal(h.toasts,0);if(failure!=='open')assert.equal(h.opened,undefined);
 }
});
