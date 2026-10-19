import { useEffect, useState } from 'react';
import { filterReviewSamples, familyEvidenceGaps, supplementPlan } from '../../lib/model-review.mjs';
import './model-review.css';
import { TrainingInfluence, type InfluenceSample } from './TrainingInfluence';

type Sample = InfluenceSample & {sample_id:string; family:string; doi:string; pl:boolean; ple:boolean; paired:boolean; pl_mae_nm:number|null; loss_mae_mev:number|null; observed_labels?:{pl_peak_nm:number|null;excitation_ev:number|null;net_loss_ev:number|null}};
type Family = {family:string; records:number; compositions:number; sources:number; pl:number; ple:number; paired:number};
type Correction = {field:string;old_value:number|null;new_value:number;unit:string;evidence:string};
type Decision = {id:string;sample_id:string;decision:string;reason:string;created_at:string;correction?:Correction};
type Review = {counts:{records:number;pl:number;ple:number;paired:number;partitions:number}; families:Family[]; samples:Sample[]; metrics:{pl_mae_nm:number;family_macro_pl_mae_nm:number}; provenance:Record<string,string>; decisions:Decision[];training_influence_available?:boolean};
const value = (n:number|null) => n === null ? '未评价' : n.toFixed(2);
const correctionFields:Record<string,{label:string;unit:string}>={pl_peak_nm:{label:'发射峰',unit:'nm'},ple_peak_nm:{label:'PLE峰',unit:'nm'},thickness_mm:{label:'厚度',unit:'mm'},annealing_temperature_c:{label:'退火温度',unit:'°C'}};

export function ModelReview() {
  const [data,setData]=useState<Review|null>(null);
  const [error,setError]=useState('');
  const [family,setFamily]=useState('');
  const [query,setQuery]=useState('');
  const [attempt,setAttempt]=useState(0);
  const [selected,setSelected]=useState('');
  const [decision,setDecision]=useState('check');
  const [reason,setReason]=useState('');
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');
  const [field,setField]=useState('pl_peak_nm');
  const [oldValue,setOldValue]=useState('');
  const [newValue,setNewValue]=useState('');
  const [evidence,setEvidence]=useState('');
  const [startingCandidate,setStartingCandidate]=useState(false);
  const [targets,setTargets]=useState({compositions:5,sources:2,paired:5});
  const observed=data?.samples.find(row=>row.sample_id===selected)?.observed_labels;
  const labelValue=(n:number|null|undefined,unit:string)=>n==null?'本轮未使用':`${n.toFixed(unit==='nm'?2:4)} ${unit}`;
  async function exportCandidate(id:string) {
    setNotice('');
    try {
      const response=await fetch('/api/v1/database/model-review/candidate',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision_ids:[id]})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.detail || '导出失败');
      const url=URL.createObjectURL(new Blob([JSON.stringify(body,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=`REAL-candidate-${id}.json`;
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice('已导出候选修改包，包含数值、依据和版本；尚未应用于训练库。');
    } catch(error) {setNotice(error instanceof Error?error.message:'导出失败');}
  }
  async function trainCandidate(id:string) {
    if(startingCandidate)return;
    setStartingCandidate(true);setNotice('');
    try {
      const response=await fetch('/api/v1/database/model-runs',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({parameters:{},candidate_decision_ids:[id]})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.detail || '候选训练启动失败');
      window.dispatchEvent(new Event('real-model-run-started'));
      setNotice('候选修改训练已启动，请在下方运行记录查看进度。');
    } catch(error) {setNotice(error instanceof Error?error.message:'启动失败');}
    finally {setStartingCandidate(false);}
  }
  function selectSample(sampleId:string) {
    setSelected(sampleId);setReason('');setNotice('');setDecision('check');
    setField('pl_peak_nm');setOldValue('');setNewValue('');setEvidence('');
  }
  async function saveReview(event:React.FormEvent) {
    event.preventDefault();
    if(!data || saving)return;
    setSaving(true);setNotice('');
    try {
      const correction=decision==='propose_correction'?{field,old_value:oldValue===''?null:Number(oldValue),new_value:Number(newValue),unit:correctionFields[field].unit,evidence}:undefined;
      const response=await fetch('/api/v1/database/model-review/decisions',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({sample_id:selected,decision,reason,provenance:data.provenance,correction})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.detail || '保存失败，请重试');
      setData(current=>current?{...current,decisions:[...(current.decisions || []),body.record]}:current);
      setReason('');setNotice('已保存审核意见；原始数据未修改。');
    } catch(error) {setNotice(error instanceof Error?error.message:'保存失败，请重试');}
    finally {setSaving(false);}
  }
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/v1/database/model-review',{credentials:'include',signal:controller.signal})
      .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.detail || '读取失败');return body as Review;})
      .then(setData).catch(reason=>{if(!controller.signal.aborted)setError(reason.message || '读取失败，请重试');});
    return ()=>controller.abort();
  },[attempt]);
  return <section className="model-review" aria-labelledby="model-review-heading">
    <h2 id="model-review-heading">模型样品审核</h2>
    <p>本地开发数据：先看体系覆盖，再核对样品。这里的误差是预测偏差，不代表数据有错。</p>
    {error ? <div role="alert"><p>{error}</p><button onClick={()=>{setError('');setAttempt(attempt+1);}}>重新读取</button></div> : !data ? <p role="status">正在核对样品范围与预测记录…</p> : <>
      <p>本轮范围 <b>{data.counts.records}</b> 条 · 发射 {data.counts.pl} 条 · 激发 {data.counts.ple} 条 · 配对 {data.counts.paired} 条</p>
      <p>按样品平均误差：<b>{value(data.metrics.pl_mae_nm)} nm</b>；各体系等权平均：<b>{value(data.metrics.family_macro_pl_mae_nm)} nm</b>。两者相差较大时，要注意少数体系是否被多数样品掩盖。</p>
      <details className="review-coverage supplement-plan"><summary>补库目标与缺口试算</summary>
        <p>这是下一批补库的可调整规划，不是统计充分性的门槛。优先补单一组成、无配对和单一来源体系；不要删除多数体系来制造均衡。</p>
        <div className="review-controls">{([['compositions','每体系目标组成数'],['sources','每体系目标来源数'],['paired','每体系目标配对记录数']] as const).map(([key,label])=><label key={key}>{label}<input type="number" min="0" max="1000" step="1" value={targets[key]} onChange={event=>{const n=Number(event.target.value);if(Number.isInteger(n)&&n>=0&&n<=1000)setTargets({...targets,[key]:n});}}/></label>)}</div>
        <div className="review-table" tabIndex={0}><table><caption>当前数量 → 对应缺口；同一新增记录可以同时补齐多项</caption><thead><tr><th>体系</th><th>组成</th><th>来源</th><th>配对记录</th></tr></thead><tbody>{supplementPlan(data.families,targets).map((row:Family & {missing:{compositions:number;sources:number;paired:number}})=><tr key={row.family}><th>{row.family}</th><td>{row.compositions}种 · 还缺{row.missing.compositions}种</td><td>{row.sources}个 · 还缺{row.missing.sources}个</td><td>{row.paired}条 · 还缺{row.missing.paired}条</td></tr>)}</tbody></table></div>
        <p>配对记录应来自同一样品、相容测量条件下的PL与PLE，并尽量覆盖不同组成。重复测量不能替代新组成；来源数也不自动等于独立实验组数。</p>
        <p>表格只覆盖当前已有体系。达到试算目标后，还需检查组成跨度、结构来源与外部验证，才能判断适用域；不能据此宣称覆盖全部石榴石。</p>
      </details>
      <details className="review-coverage"><summary>各体系下一步补什么？</summary>
        <p>优先补不同组成、独立来源和同一样品的PL/PLE。表中只列本轮已有体系；数量均衡不等于覆盖了全部石榴石体系。</p>
        {data.families.map(row=><div key={row.family}><h3>{row.family} · {row.records}条／{row.compositions}种组成</h3><ul>{familyEvidenceGaps(row).map(gap=><li key={gap}>{gap}</li>)}</ul></div>)}
      </details>
      <div className="review-table" tabIndex={0} aria-label="体系覆盖表，可横向滚动"><table><caption>点击体系名称，查看对应样品</caption><thead><tr><th>体系</th><th>记录</th><th>组成</th><th>来源</th><th>PL</th><th>PLE</th><th>配对</th></tr></thead><tbody>{data.families.map(row=><tr key={row.family}><th><button aria-pressed={family===row.family} onClick={()=>setFamily(family===row.family?'':row.family)}>{row.family}</button></th><td>{row.records}</td><td>{row.compositions}</td><td>{row.sources}</td><td>{row.pl}</td><td>{row.ple}</td><td>{row.paired}</td></tr>)}</tbody></table></div>
      <div className="review-controls"><label>材料体系<select value={family} onChange={e=>setFamily(e.target.value)}><option value="">全部体系</option>{data.families.map(row=><option key={row.family}>{row.family}</option>)}</select></label><label>搜索样品编号或DOI<input value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
      <div className="review-table review-samples" tabIndex={0} aria-label="样品误差表，可横向滚动"><table><caption>按发射误差由高到低排列；三套划分先在样品内取平均</caption><thead><tr><th>样品</th><th>审核</th><th>体系</th><th>光谱标签</th><th>发射误差/nm</th><th>损失误差/meV</th><th>原文DOI</th></tr></thead><tbody>{filterReviewSamples(data.samples,family,query).map((row:Sample)=><tr key={row.sample_id}><th>{row.sample_id}</th><td><button aria-label={`审核 ${row.sample_id}`} aria-pressed={selected===row.sample_id} disabled={saving} onClick={()=>selectSample(row.sample_id)}>审核</button></td><td>{row.family}</td><td>{row.paired?'PL＋PLE':row.pl?'仅PL':row.ple?'仅PLE':'无可用标签'}</td><td>{value(row.pl_mae_nm)}</td><td>{value(row.loss_mae_mev)}</td><td>{row.doi}</td></tr>)}</tbody></table>{filterReviewSamples(data.samples,family,query).length===0 && <p role="status">没有匹配记录，请清空搜索或切换体系。</p>}</div>
      {data.training_influence_available && <TrainingInfluence samples={filterReviewSamples(data.samples,family,query)} partitions={data.counts.partitions} onSelect={selectSample} disabled={saving}/>}
      {selected && <form className="review-form" onSubmit={saveReview}>
        <h3>审核：{selected}</h3>
        <div aria-label="本轮使用的观测标签">
          <p>先核对本轮使用的标签，再对照原文填写修正建议：</p>
          <ul><li>发射峰：{labelValue(observed?.pl_peak_nm,'nm')}</li><li>激发能：{labelValue(observed?.excitation_ev,'eV')}</li><li>配对净损失：{labelValue(observed?.net_loss_ev,'eV')}</li></ul>
          <p>这里是评价所用标签，不是模型预测。净损失由配对峰位换算；“本轮未使用”也可能表示标签尚未通过审核。</p>
        </div>
        <label>审核决定<select value={decision} disabled={saving} onChange={e=>setDecision(e.target.value)}><option value="check">待核对原文</option><option value="keep">确认保留</option><option value="propose_correction">建议修正</option></select></label>
        {decision==='propose_correction' && <fieldset disabled={saving}><legend>数值修正建议</legend>
          <p>对照原文填写；原值为人工录入，保存后仍需确认。PLE峰指激发谱的峰位。</p>
          <label>修改字段<select value={field} onChange={e=>{setField(e.target.value);setOldValue('');setNewValue('');}}>{Object.entries(correctionFields).map(([key,item])=><option key={key} value={key}>{item.label}（{item.unit}）</option>)}</select></label>
          <label>原值（手动核对，可留空）<input type="number" min="0" step="any" value={oldValue} onChange={e=>setOldValue(e.target.value)}/></label>
          <label>建议新值<input required type="number" min="0" step="any" value={newValue} onChange={e=>setNewValue(e.target.value)}/></label>
          <label>原文依据<textarea required maxLength={4000} value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="DOI、页码、图表号及读取方法"/></label>
        </fieldset>}
        <label>审核理由<textarea required maxLength={4000} value={reason} disabled={saving} onChange={e=>setReason(e.target.value)} placeholder="例如：原文图号、峰位或组成需要核对"/></label>
        <button disabled={saving || !reason.trim()} type="submit">{saving?'正在保存…':'保存审核意见'}</button>
      </form>}
      {notice && <p role="status">{notice}</p>}
      <div className="review-history"><h3>审核历史</h3>{(data.decisions || []).length===0?<p>还没有审核记录。</p>:<ul>{(data.decisions || []).map(item=><li key={item.id}><b>{item.sample_id}</b> · {item.decision==='keep'?'确认保留':item.decision==='check'?'待核对原文':'建议修正'} · {item.created_at}<p>{item.reason}</p>{item.correction && <p>{correctionFields[item.correction.field]?.label || item.correction.field}：{item.correction.old_value??'缺失'} → {item.correction.new_value} {item.correction.unit}；依据：{item.correction.evidence}</p>}</li>)}</ul>}</div>
      <p>审核意见保存在本地，可追溯到本轮数据版本。这里不直接修改原始数据。</p>
      {(data.decisions || []).filter(item=>item.correction).map(item=><button key={`export-${item.id}`} onClick={()=>exportCandidate(item.id)} aria-label={`导出候选修改 ${item.sample_id}`}>导出候选修改：{item.sample_id} · {correctionFields[item.correction!.field]?.label}</button>)}
      <p>确认修改依据后，可用默认参数在数据副本上重训。修改过标签的结果属于新版数据实验，不能仅凭误差变化判断算法提升。</p>
      {(data.decisions || []).filter(item=>item.correction).map(item=><button key={`train-${item.id}`} disabled={startingCandidate} onClick={()=>trainCandidate(item.id)} aria-label={`按默认参数重训候选修改 ${item.sample_id}`}>按默认参数重训候选修改：{item.sample_id} · {correctionFields[item.correction!.field]?.label}</button>)}
    </>}
  </section>;
}
