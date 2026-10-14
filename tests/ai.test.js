const test=require('node:test');const assert=require('node:assert/strict');
const {parseDraft}=require('../cloudfunctions/medicalApi/ai');
const vm=require('node:vm');const fs=require('node:fs');const {EventEmitter}=require('node:events');const d=require('../miniprogram/utils/domain');
function response(status,body,env={AI_PROVIDER:'deepseek',AI_API_URL:'https://api.deepseek.com/chat/completions',AI_API_KEY:'dummy-test-key',AI_MODEL:'deepseek-flash'}){
 let requestBody,requestUrl;const module={exports:{}};
 const https={request(url,options,callback){requestUrl=url.href;const req=new EventEmitter();req.destroy=()=>{};req.end=text=>{requestBody=JSON.parse(text);queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=status;callback(res);res.emit('data',JSON.stringify(body));res.emit('end');});};return req;}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../cloudfunctions/medicalApi/ai'),'utf8'),{module,require:name=>name==='https'?https:d,URL,process:{env}});
 return {generate:module.exports.generate,get body(){return requestBody;},get url(){return requestUrl;}};
}
test('模型返回畸形 JSON、数组、空值时拒绝生成草稿',()=>{
 for(const value of ['not-json','[]','null','"text"',undefined])assert.throws(()=>parseDraft(value,'AI'),/格式不正确/);
});
test('模型草稿保留否定及单位，仅接受模板字符串字段',()=>{
 const out=parseDraft('```json\n{"presentIllness":"否认发热，血压 140/90 mmHg","diagnosis":null,"plan":123,"unexpected":"忽略"}\n```','AI');
 assert.equal(out.fields.presentIllness,'否认发热，血压 140/90 mmHg');
 assert.equal(out.fields.diagnosis,'');assert.equal(out.fields.plan,'');
 assert.equal(out.fields.unexpected,undefined);
});
test('DeepSeek JSON 输出关闭思考并保持医师审核标记',async()=>{
 const h=response(200,{choices:[{finish_reason:'stop',message:{content:'{"presentIllness":"未诉胸痛","diagnosis":"","plan":""}'}}]});const r=await h.generate('未诉胸痛');assert.equal(r.engine,'DeepSeek 整理 · 待医师审核');assert.equal(r.fields.presentIllness,'未诉胸痛');assert.equal(h.body.thinking.type,'disabled');assert.equal(h.body.response_format.type,'json_object');assert.equal(h.body.stream,false);
});
test('模型输出被截断时拒绝使用，密钥与余额错误给出明确原因',async()=>{
 await assert.rejects(()=>response(200,{choices:[{finish_reason:'length',message:{content:'{"diagnosis":""}'}}]}).generate('样例'),/未完整生成/);
 for(const [status,message]of [[401,/授权失败/],[402,/余额不足/],[429,/繁忙/]])await assert.rejects(()=>response(status,{error:{message:'upstream private detail'}}).generate('样例'),message);
});
test('仅配置 DeepSeek 密钥时使用官方接口与当前 Flash 模型',async()=>{
 const h=response(200,{choices:[{finish_reason:'stop',message:{content:'{"presentIllness":"样例","diagnosis":""}'}}]},{DEEPSEEK_API_KEY:'dummy-test-key'});const r=await h.generate('样例');assert.equal(h.url,'https://api.deepseek.com/chat/completions');assert.equal(h.body.model,'deepseek-flash');assert.equal(r.engine,'DeepSeek 整理 · 待医师审核');
});
