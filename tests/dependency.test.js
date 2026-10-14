const test=require('node:test');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const sdkRequire=createRequire(require.resolve('../cloudfunctions/medicalApi/node_modules/@cloudbase/database'));
const set=sdkRequire('lodash.set');
const unset=sdkRequire('lodash.unset');
test('SDK 属性适配器阻止原型污染并保留正常嵌套读写',()=>{
 const value={};
 set(value,'profile.enabled',true);
 assert.equal(value.profile.enabled,true);
 set(value,'__proto__.villageDoctorPolluted',true);
 set(value,'constructor.prototype.villageDoctorPolluted',true);
 assert.equal({}.villageDoctorPolluted,undefined);
 assert.equal(unset(value,'profile.enabled'),true);
 assert.equal(value.profile.enabled,undefined);
 assert.equal(set.default,set);
 assert.equal(unset.default,unset);
});
