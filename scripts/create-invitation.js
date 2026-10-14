const crypto=require('crypto');
const clinicId=process.argv[2],clinicName=process.argv[3];if(!clinicId||!clinicName){console.error('用法：node scripts/create-invitation.js <clinicId> <clinicName>');process.exit(1);}
const invite=crypto.randomBytes(18).toString('base64url');console.log('请私下交给村医的邀请码：'+invite);
console.log('在 invitations 集合新增以下文档（_id 为邀请码 SHA256）：');
console.log(JSON.stringify({_id:crypto.createHash('sha256').update(invite).digest('hex'),clinicId,clinicName,enabled:true,used:0,maxUses:20,expiresAt:Date.now()+7*86400000},null,2));
