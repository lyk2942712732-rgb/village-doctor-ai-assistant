// 仅验证适配器协议及访问控制；不连接腾讯云，不代表真实识别已验收。
const test=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');
const store={audioTasks:{}};const deleted=[];let submitted=0,described=0,status=1;
const db={collection(name){store[name]||={};return {doc(id){return {async get(){return {data:store[name][id]?{_id:id,...store[name][id]}:null};},async set({data}){store[name][id]={...data};},async update({data}){Object.assign(store[name][id],data);}};}};}};
const cloud={init(){},database:()=>db,async getTempFileURL(){return {fileList:[{tempFileURL:'https://example.invalid/test-only-recording.mp3'}]};},async deleteFile({fileList}){deleted.push(...fileList);}};
class Client{
 async CreateRecTask(request){assert.equal(request.EngineModelType,'16k_zh');assert.equal(request.ChannelNum,1);submitted++;return {Data:{TaskId:submitted}};}
 async DescribeTaskStatus(){described++;return {Data:{Status:status,Result:'未诉胸痛，血压 145/85 mmHg。'}};}
}
const originalLoad=Module._load;Module._load=function(name,...args){if(name==='wx-server-sdk')return cloud;if(name==='tencentcloud-sdk-nodejs-asr')return {asr:{v20190614:{Client}}};return originalLoad.call(this,name,...args);};
const api=require('../cloudfunctions/medicalApi');test.after(()=>{Module._load=originalLoad;delete process.env.ASR_SECRET_ID;delete process.env.ASR_SECRET_KEY;});
const profile={clinicId:'clinicA'};
function credentials(){process.env.ASR_SECRET_ID='dummy-test-id';process.env.ASR_SECRET_KEY='dummy-test-key';}
function fileID(reservation){return 'cloud://test-env.bucket/'+reservation.path;}
test('未配置语音凭证时明确拒绝，且不会创建上传预约',async()=>{
 delete process.env.ASR_SECRET_ID;delete process.env.ASR_SECRET_KEY;
 await assert.rejects(()=>api._test.handle('reserveAudio',{},profile,'doctorA'),/尚未配置腾讯云语音识别/);assert.equal(Object.keys(store.audioTasks).length,0);
});
test('录音预约拒绝别的医师、卫生室及非预约路径',async()=>{
 credentials();const reservation=await api._test.handle('reserveAudio',{},profile,'doctorA');const data={audioId:reservation.id,fileID:fileID(reservation)};
 await assert.rejects(()=>api._test.handle('transcribe',data,profile,'doctorB'),/预约失效/);
 await assert.rejects(()=>api._test.handle('transcribe',data,{clinicId:'clinicB'},'doctorA'),/无权/);
 await assert.rejects(()=>api._test.handle('transcribe',{...data,fileID:'cloud://test-env.bucket/audio/other.mp3'},profile,'doctorA'),/来源无效/);assert.equal(submitted,0);
});
test('语音任务完成后保留否定和单位、删除音频，并复用已完成结果',async()=>{
 credentials();const reservation=await api._test.handle('reserveAudio',{},profile,'doctorA');const file=fileID(reservation);
 const task=await api._test.handle('transcribe',{audioId:reservation.id,fileID:file},profile,'doctorA');
 await assert.rejects(()=>api._test.handle('transcription',{id:task.id},profile,'doctorB'),/无权/);
 status=1;assert.equal((await api._test.handle('transcription',{id:task.id},profile,'doctorA')).status,'processing');
 status=2;const result=await api._test.handle('transcription',{id:task.id},profile,'doctorA');assert.equal(result.status,'completed');assert.equal(result.text,'未诉胸痛，血压 145/85 mmHg。');assert.equal(deleted.filter(x=>x===file).length,1);
 const calls=described;const cached=await api._test.handle('transcription',{id:task.id},profile,'doctorA');assert.equal(cached.text,result.text);assert.equal(described,calls);
});
test('识别失败保留失败状态、清空识别文本，并删除音频',async()=>{
 credentials();const reservation=await api._test.handle('reserveAudio',{},profile,'doctorA');const file=fileID(reservation);await api._test.handle('transcribe',{audioId:reservation.id,fileID:file},profile,'doctorA');
 status=3;const result=await api._test.handle('transcription',{id:reservation.id},profile,'doctorA');assert.equal(result.status,'failed');assert.equal(result.text,'');assert.match(result.message,/失败/);assert.ok(deleted.includes(file));
});
