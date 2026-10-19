export function filterReviewSamples(rows, family, query) {
  const needle = query.trim().toLowerCase();
  return rows.filter(row => (!family || row.family === family) &&
    [row.sample_id, row.doi].some(value => value.toLowerCase().includes(needle)));
}

export function familyEvidenceGaps(row) {
  const gaps=[];
  if(row.compositions===1)gaps.push('仅1种组成：补不同组成，建立变化趋势');
  if(row.sources===1)gaps.push('仅1个来源：补独立来源或独立实验');
  if(row.records>row.compositions)gaps.push(`${row.records-row.compositions}条重复组成记录：保留工艺信息，按组成分组评价`);
  if(row.ple===0)gaps.push('无PLE：补同一样品的PL与PLE');
  else if(row.pl===0)gaps.push('无PL：补同一样品的发射峰');
  else if(row.paired<Math.max(row.pl,row.ple))gaps.push(`${row.paired}条配对：优先补齐已有组成的PL/PLE`);
  if(!gaps.length)gaps.push('标签已配对：继续检查组成跨度与结构证据');
  return gaps;
}

export function supplementPlan(rows, targets) {
  const keys=['compositions','sources','paired'];
  if(keys.some(key=>!Number.isInteger(targets[key]) || targets[key]<0 || targets[key]>1000))
    throw new Error('补充目标须为0至1000之间的整数');
  return rows.map(row=>({...row,missing:Object.fromEntries(keys.map(key=>[key,Math.max(0,targets[key]-row[key])]))}))
    .sort((a,b)=>Number(a.compositions>1)-Number(b.compositions>1) ||
      Number(a.paired>0)-Number(b.paired>0) || a.sources-b.sources || a.family.localeCompare(b.family));
}
