import test from 'node:test';
import assert from 'node:assert/strict';
import { filterReviewSamples, familyEvidenceGaps } from '../lib/model-review.mjs';

test('family and search combine without changing source order', () => {
  const rows=[{sample_id:'A',family:'Y',doi:'10/a'}, {sample_id:'B',family:'Lu',doi:'10/b'}];
  assert.deepEqual(filterReviewSamples(rows,'Y','10/A'),[rows[0]]);
  assert.deepEqual(filterReviewSamples(rows,'Lu','A'),[]);
  assert.equal(rows.length,2);
});

test('coverage guidance distinguishes missing labels, single sources and repeated compositions',()=>{
  assert.deepEqual(familyEvidenceGaps({records:1,compositions:1,sources:1,pl:1,ple:0,paired:0}),[
    '仅1种组成：补不同组成，建立变化趋势',
    '仅1个来源：补独立来源或独立实验',
    '无PLE：补同一样品的PL与PLE',
  ]);
  assert.deepEqual(familyEvidenceGaps({records:36,compositions:11,sources:12,pl:25,ple:12,paired:5}),[
    '25条重复组成记录：保留工艺信息，按组成分组评价',
    '5条配对：优先补齐已有组成的PL/PLE',
  ]);
  assert.deepEqual(familyEvidenceGaps({records:5,compositions:5,sources:2,pl:5,ple:5,paired:5}),['标签已配对：继续检查组成跨度与结构证据']);
});
test('supplement targets count compositions rather than repeated records', async () => {
  const {supplementPlan}=await import('../lib/model-review.mjs');
  const rows=[{family:'Y / Al',records:36,compositions:11,sources:12,paired:5},
    {family:'Lu / Al',records:14,compositions:12,sources:4,paired:0},
    {family:'Y / Al–Sc',records:1,compositions:1,sources:1,paired:0}];
  const plan=supplementPlan(rows,{compositions:5,sources:2,paired:5});
  assert.equal(plan[0].family,'Y / Al–Sc');
  assert.deepEqual(plan[0].missing,{compositions:4,sources:1,paired:5});
  assert.deepEqual(plan.find(r=>r.family==='Lu / Al').missing,{compositions:0,sources:0,paired:5});
  assert.equal(rows[0].records,36);
  assert.throws(()=>supplementPlan(rows,{compositions:-1,sources:2,paired:5}));
});
