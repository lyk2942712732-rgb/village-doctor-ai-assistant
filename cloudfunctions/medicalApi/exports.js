const path=require('path');const d=require('./domain');
async function pdf(title,sections,isTest=false){
 const PDFDocument=require('pdfkit');const doc=new PDFDocument({size:'A4',margin:48,bufferPages:true});const chunks=[];
 const done=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 doc.font(require('./font-data'));
 doc.fontSize(20).fillColor('#166b57').text(title);doc.moveDown(.7);
 doc.fontSize(9).fillColor('#61756d').text('村医病历助手 | '+ '导出时间 '+new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}));doc.moveDown();
 for(const section of sections){if(section.newPage)doc.addPage();doc.fontSize(13).fillColor('#183d35').text(section.heading);doc.moveDown(.5);for(const [label,value] of section.rows){doc.fontSize(10).fillColor('#166b57').text(label);doc.fontSize(10).fillColor('#183d35').text(String(value||'未记录'),{lineGap:4});doc.moveDown(.7);}doc.moveDown();}
 const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.fontSize(8).fillColor('#61756d').text('仅供授权诊疗使用，请妥善保管    '+(i+1)+' / '+range.count,48,doc.page.height-32,{align:'center',width:doc.page.width-96,lineBreak:false});doc.page.margins.bottom=bottom;}
 doc.end();return done;
}
function referral(patient,records,services,isTest=false){return pdf(patient.name+' · 转诊资料包',[
 {heading:'居民基本信息',rows:[['居民编号',patient.code],['姓名 / 性别 / 出生日期',patient.name+' / '+patient.sex+' / '+patient.birthDate],['所属村',patient.village],['联系电话',patient.phone],['资料范围',records.length+' 份正式就诊病历，'+services.length+' 条专家服务记录']]},
 ...records.map((r,i)=>({newPage:true,heading:'就诊记录 '+(i+1)+' | '+r.visitDate,rows:[['接诊医师',r.doctorName],...d.FIELDS.map(f=>[f.label,r[f.key]]),['原始沟通记录',r.rawText],['审核及归档时间',new Date(r.archivedAt||r.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})]]})),
 ...services.map(s=>({newPage:true,heading:'专家下乡服务 | '+s.serviceDate,rows:[['专家 / 专业',s.expertName+' / '+(s.specialty||'未记录')],['服务类型',s.type],['诊疗意见',s.opinion],['随访安排',s.followup],['归档医师',s.doctorName]]}))
],isTest);}
function roster(r,people,isTest=false){return pdf(r.title,[{heading:'下乡接诊安排',rows:[['计划日期',r.serviceDate],['确认村医',r.doctorName],['接诊人数',people.length+' 人'],['说明','筛选仅供参考，接诊次序及安排由医师最终确认。']]},...people.map((p,i)=>({heading:(i+1)+'. '+p.name+' | '+p.code,rows:[['基本信息',p.sex+' / '+d.age(p.birthDate)+' 岁 / '+p.village],['参考原因',(r.reasons&&r.reasons[p._id]||[]).join('；')||'村医人工确认'],['联系电话',p.phone]]}))],isTest);}
async function workbook(stats,records,services,residents,range,exports,isTest=false){
 const ExcelJS=require('exceljs');const w=new ExcelJS.Workbook();w.creator='村医病历助手';
 const summary=w.addWorksheet('各村统计');summary.columns=[{header:'村名',key:'village',width:20},{header:'累计建档人数',key:'residents',width:18},{header:'就诊记录数',key:'visits',width:16},{header:'转诊包生成数',key:'referrals',width:18},{header:'专家服务次数',key:'experts',width:18},{header:'其中随访次数',key:'followups',width:18},{header:'当前重点人数',key:'priority',width:18},{header:'建议专家人数',key:'suggestedExperts',width:18}];summary.addRows(stats.rows);
 const pm={};residents.forEach(p=>pm[p._id]=p);const within=date=>date>=range.start&&date<=range.end;
 const visits=w.addWorksheet('就诊台账');visits.columns=[{header:'居民编号',key:'code',width:18},{header:'姓名',key:'name',width:16},{header:'所属村',key:'village',width:18},{header:'日期',key:'date',width:16},{header:'接诊医师',key:'doctor',width:18},{header:'主诉',key:'complaint',width:36}];records.filter(r=>r.status==='archived'&&within(r.visitDate)).forEach(r=>{const p=pm[r.patientId];if(p)visits.addRow({code:p.code,name:p.name,village:p.village,date:r.visitDate,doctor:r.doctorName,complaint:r.chiefComplaint});});
 const service=w.addWorksheet('专家与随访台账');service.columns=[{header:'居民编号',key:'code',width:18},{header:'姓名',key:'name',width:16},{header:'所属村',key:'village',width:18},{header:'日期',key:'date',width:16},{header:'类型',key:'type',width:18},{header:'专家',key:'expert',width:18},{header:'科别',key:'specialty',width:18},{header:'意见',key:'opinion',width:60},{header:'随访安排',key:'followup',width:40}];services.filter(s=>within(s.serviceDate)).forEach(s=>{const p=pm[s.patientId];if(p)service.addRow({code:p.code,name:p.name,village:p.village,date:s.serviceDate,type:s.type,expert:s.expertName,specialty:s.specialty,opinion:s.opinion,followup:s.followup});});
 const referrals=w.addWorksheet('转诊资料台账');referrals.columns=[{header:'居民编号',key:'code',width:18},{header:'姓名',key:'name',width:18},{header:'村名',key:'village',width:18},{header:'生成日期',key:'date',width:18},{header:'病历份数',key:'count',width:14}];exports.filter(e=>e.kind==='referral'&&e.status==='ready'&&within(d.dateOnly(e.createdAt))).forEach(e=>{const p=pm[e.patientId];if(p)referrals.addRow({code:p.code,name:p.name,village:p.village,date:d.dateOnly(e.createdAt),count:e.recordIds.length});});
 
 const notes=w.addWorksheet('统计口径');notes.columns=[{header:'项目',width:30},{header:'说明',width:100}];notes.addRows([['统计起止',range.start+' 至 '+range.end],['累计居民','所有已建档居民，不受日期区间限制'],['就诊记录','期间已审核归档的病历条数'],['转诊包','期间成功生成的资料包次数，不等于实际转诊人数'],['专家服务','期间已归档的专家诊疗与随访记录总数'],['重点人数','依据最新已归档病历：疾病数≥2、医师标记异常或90天未复诊，满足任一条件'],['安排建议','当前重点人数 ÷ 每位专家计划接诊 '+range.capacity+' 人，向上取整。须人工确认']]);
 for(const sheet of w.worksheets){sheet.views=[{state:'frozen',ySplit:1}];sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF166B57'}};sheet.autoFilter={from:'A1',to:{row:1,column:sheet.columnCount}};sheet.eachRow(row=>row.alignment={vertical:'top',wrapText:true});}
 return Buffer.from(await w.xlsx.writeBuffer());
}
module.exports={pdf,referral,roster,workbook};
