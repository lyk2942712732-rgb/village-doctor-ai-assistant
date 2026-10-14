// 对照文字差异，不推断医学含义。数字和英文词整体标记，避免只标出剂量的一位数字。
function tokens(text){return String(text||'').match(/\d+(?:\.\d+)?|[A-Za-z]+|\s+|[^\s]/gu)||[];}
function normalized(text){return String(text||'').replace(/[\s，,。.;；：:]/g,'');}
function parts(list,changed){const out=[];list.forEach((text,i)=>{const red=!!changed[i]&&!!text.trim();const last=out[out.length-1];if(last&&last.changed===red)last.text+=text;else out.push({id:out.length,text,changed:red});});return out;}
function compare(current,candidate){
 const different=!!normalized(current)&&!!normalized(candidate)&&normalized(current)!==normalized(candidate);
 if(!different)return {different:false,currentParts:[{id:0,text:String(current||''),changed:false}],parts:[{id:0,text:String(candidate||''),changed:false}]};
 const a=tokens(current),b=tokens(candidate),aa=a.map(()=>true),bb=b.map(()=>true);
 let start=0;while(start<a.length&&start<b.length&&a[start]===b[start]){aa[start]=bb[start]=false;start++;}
 let endA=a.length,endB=b.length;while(endA>start&&endB>start&&a[endA-1]===b[endB-1]){aa[--endA]=bb[--endB]=false;}
 const n=endA-start,m=endB-start;
 // 长段落采用保守标记，避免在手机主线程创建过大的对照矩阵。
 if(n*m<=250000){
  const rows=Array.from({length:n+1},()=>new Uint16Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)rows[i][j]=a[start+i]===b[start+j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1]);
  let i=0,j=0;while(i<n&&j<m){if(a[start+i]===b[start+j]){aa[start+i]=bb[start+j]=false;i++;j++;}else if(rows[i+1][j]>=rows[i][j+1])i++;else j++;}
 }
 return {different:true,currentParts:parts(a,aa),parts:parts(b,bb)};
}
function candidates(fields,form,values){return fields.map(f=>{const text=String(values[f.key]||'').trim().slice(0,2000);const current=String(form[f.key]||'');return Object.assign({key:f.key,label:f.label,text,same:!!text&&normalized(current)===normalized(text)},compare(current,text));});}
module.exports={compare,candidates};
