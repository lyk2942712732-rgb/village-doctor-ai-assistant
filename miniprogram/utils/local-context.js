function beijingTime(now=Date.now()){const date=new Date(now+8*3600000).toISOString();return {today:date.slice(0,10),time:date.slice(11,19)};}
function placeLabel(region){if(!Array.isArray(region)||region.length!==3||region.some(v=>typeof v!=='string'||!v.trim()||v.length>40))return '';return [...new Set(region.slice(1).filter(v=>v!=='市辖区'&&v!=='县'))].join(' · ')||region[0];}
module.exports={beijingTime,placeLabel};
