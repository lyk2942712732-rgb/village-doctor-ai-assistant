const test=require('node:test');const assert=require('node:assert/strict');const {compare}=require('../miniprogram/utils/ai-fill');
test('剂量与否定词差异标红，保留共同内容及双向对照',()=>{
 const r=compare('无胸痛，氨氯地平5mg','有胸痛，氨氯地平10mg');
 assert.equal(r.different,true);assert.deepEqual(r.parts.filter(p=>p.changed).map(p=>p.text),['有','10']);
 assert.deepEqual(r.currentParts.filter(p=>p.changed).map(p=>p.text),['无','5']);assert.equal(r.parts.map(p=>p.text).join(''),'有胸痛，氨氯地平10mg');
 const deletion=compare('咳嗽，无胸痛','咳嗽');assert.equal(deletion.different,true);assert.match(deletion.currentParts.filter(p=>p.changed).map(p=>p.text).join(''),/无胸痛/);
});
test('空白字段无需冲突标记，排版差异不标红，长文本保持完整',()=>{
 assert.equal(compare('','咳嗽三天').different,false);assert.equal(compare('咳嗽，三天。','咳嗽三天').different,false);assert.equal(compare('有过敏史','').different,false);
 const r=compare('甲'.repeat(1500),'乙'.repeat(1500));assert.equal(r.different,true);assert.equal(r.parts.map(p=>p.text).join(''),'乙'.repeat(1500));assert.equal(r.parts[0].changed,true);
});
