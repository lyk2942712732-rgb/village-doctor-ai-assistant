const test=require('node:test');const assert=require('node:assert/strict');const r=require('../cloudfunctions/medicalApi/regions');
const chain=['23','2301','230102','230102001','230102001001'];
test('五级目录返回真实下级，校验编码并用目录名称覆盖客户端文本',()=>{let parent='';for(const code of chain){assert.ok(r.options(parent).some(o=>o.code===code));parent=code;}const v=r.validate(chain);assert.equal(v.province,'黑龙江省');assert.equal(v.city,'哈尔滨市');assert.equal(v.county,'道里区');assert.ok(v.village);assert.deepEqual(v.regionCodes,chain);});
test('跨省县镇村组合、缺失下级、文件路径参数被拒绝',()=>{assert.throws(()=>r.validate(['11',...chain.slice(1)]),/失效/);assert.throws(()=>r.validate(chain.slice(0,4)),/完整/);assert.throws(()=>r.options('../../etc'),/编码/);assert.throws(()=>r.options('239999'),/上级/);});
