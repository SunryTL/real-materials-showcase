import { useCallback, useEffect, useState } from 'react';
import './model-review.css';

type Parameter={default:number;min:number;max:number;label:string;help:string};
type Metric={task:string;n:number;mae:number;rmse:number;r2:number};
type Run={id:string;status:string;parameters:Record<string,number>;completed_folds:number;total_folds:number;summary:Metric[];labels_revised?:boolean;candidate_decision_ids?:string[]};
type Catalog={configured:boolean;parameters:Record<string,Parameter>;runs:Run[]};
const taskNames:Record<string,string>={emission:'发射峰（nm）',excitation:'激发能（meV）',loss:'净损失（meV）'};
const states:Record<string,string>={running:'训练中',completed:'已完成',failed:'运行失败',unknown:'状态待核对'};

export function ModelTraining({owner}:{owner:boolean}) {
  const [catalog,setCatalog]=useState<Catalog|null>(null);
  const [draft,setDraft]=useState<Record<string,string>>({});
  const [error,setError]=useState('');
  const [starting,setStarting]=useState(false);
  const refresh=useCallback(async()=>{
    try {
      const response=await fetch('/api/v1/database/model-runs',{credentials:'include'});
      const body=await response.json();
      if(!response.ok)throw new Error(body.detail || '训练记录读取失败');
      setCatalog(body);
      setDraft(current=>Object.keys(current).length?current:Object.fromEntries(Object.entries(body.parameters as Record<string,Parameter>).map(([key,spec])=>[key,String(spec.default)])));
      setError('');
    }catch(reason){setError(reason instanceof Error?reason.message:'读取失败，请重试');}
  },[]);
  useEffect(()=>{
    // refresh updates state only after the asynchronous HTTP request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  },[refresh]);
  useEffect(()=>{
    const onStarted=()=>{void refresh();};
    window.addEventListener('real-model-run-started',onStarted);
    return ()=>window.removeEventListener('real-model-run-started',onStarted);
  },[refresh]);
  const running=catalog?.runs.some(run=>run.status==='running') || false;
  useEffect(()=>{
    if(!running)return;
    const timer=window.setInterval(()=>{void refresh();},2000);
    return ()=>window.clearInterval(timer);
  },[running,refresh]);
  async function start(event:React.FormEvent) {
    event.preventDefault();
    if(starting || running || !catalog?.configured || !owner)return;
    setStarting(true);setError('');
    try {
      const parameters=Object.fromEntries(Object.entries(draft).map(([key,value])=>[key,Number(value)]));
      const response=await fetch('/api/v1/database/model-runs',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({parameters})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.detail || '启动失败，请重试');
      setCatalog(current=>current?{...current,runs:[body,...current.runs]}:current);
    }catch(reason){setError(reason instanceof Error?reason.message:'启动失败，请重试');}
    finally{setStarting(false);}
  }
  return <section className="model-review model-training" aria-labelledby="model-training-title">
    <h2 id="model-training-title">调参实验</h2>
    <p>先只改一项，观察发射、激发和净损失分别怎样变化。固定89条材料记录与原15折划分，每次另存代码、参数和预测结果。</p>
    <p>这里是开发实验，结果用于理解参数作用；重复比较不能替代新样品验证，也不会自动更改论文主结果。</p>
    {error && <div role="alert"><p>{error}</p><button onClick={()=>void refresh()}>重新读取训练记录</button></div>}
    {!catalog?<p role="status">正在读取训练配置…</p>:<>
      {!catalog.configured && <p>本地训练尚未连接。需配置研究库位置与训练Python环境后使用；公开网页不提供训练操作。</p>}
      <form className="review-form" onSubmit={start}>
        <fieldset disabled={!owner || !catalog.configured || starting || running}>
          <legend>联合模型参数</legend>
          {Object.entries(catalog.parameters).map(([key,spec])=><div key={key}>
            <label htmlFor={`model-param-${key}`}>{spec.label}</label>
            <input id={`model-param-${key}`} aria-describedby={`model-help-${key}`} required type="number" step="any" min={spec.min} max={spec.max} value={draft[key]??''} onChange={event=>setDraft({...draft,[key]:event.target.value})}/>
            <p id={`model-help-${key}`}>{spec.help} 原模型：{spec.default}；可选范围：{spec.min}–{spec.max}。</p>
          </div>)}
          <div className="review-controls">
            <button type="button" onClick={()=>setDraft(Object.fromEntries(Object.entries(catalog.parameters).map(([key,spec])=>[key,String(spec.default)])))}>恢复原模型参数</button>
            <button type="submit">{starting?'正在启动…':running?'训练进行中…':'运行一次对照训练'}</button>
          </div>
        </fieldset>
      </form>
      {!owner && <p>当前账号可查看结果；启动训练需要负责人权限。</p>}
      <h3>运行记录</h3>
      {catalog.runs.length===0?<p>尚无调参记录。使用默认参数可先复现原模型。</p>:catalog.runs.map(run=><article key={run.id} className="training-run">
        <h4>{states[run.status] || '状态待核对'} · {run.id.slice(0,8)}</h4>
        {run.labels_revised && <p>候选数据修正实验 · 修改记录：{run.candidate_decision_ids?.join('、')}。原冻结数据未修改。</p>}
        <p role={run.status==='running'?'status':undefined}>已完成 {run.completed_folds}/{run.total_folds} 折</p>
        {run.status==='running' && <progress aria-label="训练进度" value={run.completed_folds} max={run.total_folds}/>}
        {run.status==='failed' && <p>本次训练未成功，请检查本地运行日志；已有实验保持不变。</p>}
        {run.status==='unknown' && <p>服务可能已重启，请核对本地运行状态后再启动。</p>}
        <details><summary>查看本次参数</summary><dl>{Object.entries(run.parameters).map(([key,value])=><div key={key}><dt>{catalog.parameters[key]?.label || key}</dt><dd>{value}</dd></div>)}</dl></details>
        {run.summary.length>0 && <div className="review-table" tabIndex={0}><table><caption>MAE、RMSE越低越好；R²越接近1越好。不同任务的误差单位不同。</caption><thead><tr><th>预测任务</th><th>评价记录</th><th>MAE</th><th>RMSE</th><th>R²</th></tr></thead><tbody>{run.summary.map(row=><tr key={row.task}><th>{taskNames[row.task] || row.task}</th><td>{row.n}</td><td>{row.mae.toFixed(3)}</td><td>{row.rmse.toFixed(3)}</td><td>{row.r2.toFixed(3)}</td></tr>)}</tbody></table></div>}
      </article>)}
    </>}
  </section>;
}
