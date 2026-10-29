import { useEffect, useState } from 'react';
import { ArrowRight, Download, RefreshCw } from 'lucide-react';
import { conditionLabels, fetchModelData, modelAssets, type ModelData, type ModelPrediction, type ModelRecord } from './model-data';
import { downloadBlob } from './explorer-data';
import './model-browser.css';
type View = 'predictions' | 'performance' | 'principles';
type Branch = 'u' | 'v' | 'c';
const branchInfo = {
  u: { title: '激发贡献 u', input: '组成、占位、局域配位与晶体场相关描述符', action: '结合配对激发观测与外部光学先验，学习激发能量的变化。', meaning: '模型激发贡献，与 PLE 激发观测对应。' },
  v: { title: '潜在弛豫贡献 v', input: '局域几何、键合与弛豫相关物理描述符', action: '在激发和发射联合观测约束下，学习潜在能量损失。', meaning: '潜在模型分量；配对光谱约束的净能量差为 v − c。' },
  c: { title: '陶瓷观测修正 c', input: '组成、厚度、烧结和退火条件，以及微结构相关信息', action: '描述陶瓷条件与组成共同关联的观测变化，形成有符号的能量修正。', meaning: '模型修正分量；其响应供进一步机制分析与实验检验。' },
};
export function ModelBrowser() {
  const [data, setData] = useState<ModelData | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [view, setView] = useState<View>('predictions'), [algorithm, setAlgorithm] = useState('joint_gpr'), [seed, setSeed] = useState(20260918);
  const [family, setFamily] = useState(''), [formula, setFormula] = useState(''), [selected, setSelected] = useState(''), [branch, setBranch] = useState<Branch>('u');
  useEffect(() => { const c = new AbortController(); fetchModelData(c.signal).then(d => { setData(d); setSelected(d.records[0].sample_id); }).catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : '模型结果暂时不可用'); }); return () => c.abort(); }, [revision]);
  const retry = () => { setError(''); setData(null); setRevision(n => n+1); };
  if (error) return <div className="model-browser model-state" role="alert"><h2>模型结果暂时不可用</h2><p>{error}。请重新加载。</p><button className="science-action" onClick={retry}><RefreshCw size={16}/>重新加载模型结果</button></div>;
  if (!data) return <div className="model-browser model-state" role="status"><p>正在读取模型与样品结果…</p></div>;
  const families = [...new Set(data.records.map(r => r.family))].sort();
  const familyRecords = data.records.filter(r => !family || r.family === family);
  const formulas = [...new Set(familyRecords.map(r => r.formula))].sort();
  const records = familyRecords.filter(r => !formula || r.formula === formula);
  const record = records.find(r => r.sample_id === selected) || records[0];
  const points = data.predictions.filter(p => p.route === algorithm && p.seed === seed);
  const prediction = points.find(p => p.sample_id === record?.sample_id);
  const metric = data.metrics.find(m => m.route === algorithm)!;
  function selectSample(id: string) { if (!records.some(r => r.sample_id === id)) { setFamily(''); setFormula(''); } setSelected(id); }
  function exportResult() {
    const result = { version: data!.version, validation: data!.validation, algorithm, seed, record, prediction };
    downloadBlob(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),`REAL-${record.sample_id}-${algorithm}-${seed}.json`);
  }
  return <section className="model-browser" aria-label="机器学习模型工作台">
    <header className="model-intro"><div><h1>机器学习模型</h1><p>从已验证样品出发，查看组成和制备条件对应的折外预测，理解激发、弛豫与陶瓷观测修正。</p></div><span className="model-version">结果更新 {data.date}<br/>核验集 PL {data.n} · PL / PLE {data.paired}</span></header>
    <div className="science-tabs model-tabs" role="tablist" aria-label="模型展示">{([['predictions','预测结果'],['performance','模型性能'],['principles','模型原理']] as const).map(([key,name]) => <button key={key} id={`model-tab-${key}`} role="tab" aria-selected={view===key} aria-controls="model-panel" onClick={()=>setView(key)}>{name}</button>)}</div>
    <div className="model-controls"><label>模型算法<select aria-label="模型算法" value={algorithm} onChange={e=>setAlgorithm(e.target.value)}>{data.metrics.map(m=><option key={m.route} value={m.route}>{m.name}</option>)}</select></label><label>验证重复<select aria-label="验证重复" value={seed} onChange={e=>setSeed(Number(e.target.value))}>{data.seeds.map((s,i)=><option key={s} value={s}>重复 {i+1} · seed {s}</option>)}</select></label><p>浏览已保存的折外预测<br/><span>每次重复 {data.n} 个样品 · 5 折组成分组</span></p></div>
    <div id="model-panel" role="tabpanel" aria-labelledby={`model-tab-${view}`}>
    {view==='predictions' && record && prediction && <>
      <div className="model-workspace"><aside className="model-inputs"><h3>材料与制备条件</h3>
        <label>材料家族<select aria-label="材料家族" value={family} onChange={e=>{setFamily(e.target.value);setFormula('');setSelected('');}}><option value="">全部家族</option>{families.map(f=><option key={f}>{f}</option>)}</select></label>
        <label>材料配方<select aria-label="材料配方" value={formula} onChange={e=>{setFormula(e.target.value);setSelected('');}}><option value="">全部配方</option>{formulas.map(f=><option key={f}>{f}</option>)}</select></label>
        <label>具体样品<select aria-label="具体样品" value={record.sample_id} onChange={e=>setSelected(e.target.value)}>{records.map(r=><option key={r.sample_id}>{r.sample_id}</option>)}</select></label>
        <div className="model-input-evidence"><p className="model-composition">{record.formula}</p><dl>{conditionLabels.map(([key,name,unit])=><div key={key}><dt>{name}</dt><dd>{record.conditions[key]===null?'未记录':`${record.conditions[key]} ${unit}`}</dd></div>)}</dl><a className="model-source-link" href={`https://doi.org/${encodeURI(record.doi)}`} target="_blank" rel="noreferrer">{record.doi}<ArrowRight size={15}/></a><p className="model-hint">切换已有样品，比较不同配方与制备条件下的预测结果。</p></div>
      </aside>
      <div className="model-output" aria-live="polite"><header><div><h3>发射波长预测</h3><p>{metric.name} · 重复 {data.seeds.indexOf(seed)+1} · 第 {prediction.fold+1} 折</p></div><button className="science-action" onClick={exportResult}><Download size={15}/>导出当前结果</button></header>
        <div className="model-result-line"><div className="model-primary-result"><span>折外预测 / nm</span><strong data-result="predicted">{prediction.predicted_nm.toFixed(2)}</strong></div><div><span>文献实测 / nm</span><strong>{prediction.actual_nm.toFixed(2)}</strong></div><div><span>绝对误差 / nm</span><strong>{Math.abs(prediction.actual_nm-prediction.predicted_nm).toFixed(2)}</strong></div></div>
        <div className="model-energy-header"><h3>能量贡献</h3><p>E<sub>em</sub> = u − v + c</p></div><EnergyContributions prediction={prediction}/>
        <div className="model-energy-values">{([['u','激发贡献',prediction.excitation_ev],['v','潜在弛豫贡献',prediction.latent_loss_ev],['c','陶瓷观测修正',prediction.correction_ev]] as const).map(([key,name,value])=><button key={key} onClick={()=>{setBranch(key);setView('principles');}}><span>{name} {key}</span><strong><b data-energy={key}>{value.toFixed(4)}</b><small> eV</small></strong><span>查看支路原理 <ArrowRight size={13}/></span></button>)}</div>
        <p className="model-hint">u、v、c 为联合模型分量。配对光谱对应的净损失为 v − c = {prediction.net_loss_ev.toFixed(4)} eV；贡献图表示模型能量分解。</p>
      </div></div>
      <ParityPlot points={points.filter(p => records.some(r => r.sample_id === p.sample_id))} selected={record.sample_id} onSelect={selectSample} records={data.records}/>
    </>}
    {view==='performance' && <section className="model-performance"><div className="model-performance-header"><div><h3>{metric.name}</h3><p>{data.validation}</p></div><p>数据版本 {data.database_version}</p></div>
      <div className="model-score-row">{[['R²',metric.r2,metric.r2_sd,4],['MAE / nm',metric.mae,metric.mae_sd,3],['RMSE / nm',metric.rmse,metric.rmse_sd,3]].map(([name,value,sd,digits])=><div key={name}><span>{name}</span><strong>{Number(value).toFixed(Number(digits))}<small> ± {Number(sd).toFixed(Number(digits))}</small></strong></div>)}</div><p className="model-hint">均值与标准差按三次完整折外预测统计；散点显示当前选择的重复。</p>
      <div className="science-table-scroll"><table><caption>六类算法比较 · 同一核验集与验证划分</caption><thead><tr><th>算法</th><th>R²</th><th>MAE / nm</th><th>RMSE / nm</th><th>查看</th></tr></thead><tbody>{data.metrics.map(m=><tr key={m.route} className={m.route===algorithm?'is-selected':''}><th scope="row">{m.name}</th><td>{m.r2.toFixed(4)} ± {m.r2_sd.toFixed(4)}</td><td>{m.mae.toFixed(3)} ± {m.mae_sd.toFixed(3)}</td><td>{m.rmse.toFixed(3)} ± {m.rmse_sd.toFixed(3)}</td><td><button className="science-action" aria-pressed={m.route===algorithm} onClick={()=>setAlgorithm(m.route)}>查看结果</button></td></tr>)}</tbody></table></div>
      <ParityPlot points={points} selected={record?.sample_id||null} onSelect={selectSample} records={data.records}/>
      <section className="model-progress"><h3>模型建设进展</h3><dl><div><dt>数据核验</dt><dd>{data.n} 条发射标签，{data.paired} 组配对激发／发射观测</dd></div><div><dt>模型训练</dt><dd>六类算法，每类保留三次五折验证模型</dd></div><div><dt>结果核对</dt><dd>折外预测指标与 u − v + c 能量分解一致性已核对</dd></div><div><dt>当前评价范围</dt><dd>组成分组开发集验证；后续开展独立实验评价</dd></div></dl></section>
    </section>}
    {view==='principles' && <section className="model-principles"><header><h3>物理分层联合学习</h3><p>材料组成与物理描述符分别进入激发、弛豫和陶瓷观测修正支路，以激发与发射观测共同约束发射能量。</p></header><div className="model-method-flow" aria-label="模型总体逻辑">{['多源数据与观测','组成与物理特征','激发—弛豫—陶瓷观测修正','发射能量与波长'].map((v,i)=><div key={v}><span>{v}</span>{i<3&&<ArrowRight size={20}/>}</div>)}</div>
      <div className="model-branches" role="group" aria-label="选择物理支路">{(['u','v','c'] as const).map(key=><button key={key} aria-pressed={branch===key} onClick={()=>setBranch(key)}>{branchInfo[key].title}</button>)}</div><div className="model-branch-detail" aria-live="polite"><h3>{branchInfo[branch].title}</h3><dl><div><dt>输入信息</dt><dd>{branchInfo[branch].input}</dd></div><div><dt>学习作用</dt><dd>{branchInfo[branch].action}</dd></div><div><dt>输出含义</dt><dd>{branchInfo[branch].meaning}</dd></div></dl>{prediction&&<p>当前样品 {record.sample_id} · {metric.name}：<strong>{({u:prediction.excitation_ev,v:prediction.latent_loss_ev,c:prediction.correction_ev})[branch].toFixed(4)} eV</strong></p>}</div>
      <div className="model-equations"><div><h4>能量与波长</h4><p className="model-equation">E<sub>em</sub> = u − v + c  λ = hc / E<sub>em</sub></p><p>hc ≈ 1239.841984 eV·nm。u 对应 PLE 激发观测；净能量差 E<sub>ex</sub> − E<sub>em</sub> = v − c。</p></div><div><h4>联合观测约束</h4><p className="model-equation">y<sub>O</sub> = H<sub>O</sub>f + ε</p><p>发射观测采用 (1, −1, 1)，激发观测采用 (1, 0, 0)，由已有标签共同约束三个支路。</p></div><div><h4>高斯过程表征</h4><p className="model-equation">f<sub>j</sub>(x<sub>j</sub>) ∼ GP(m<sub>j</sub>, k<sub>j</sub>)，j ∈ {'{u, v, c}'}</p><p>均值函数融合外部光学先验，协方差描述物理特征关联；先验权重与超参数在训练折内选择。其余五类算法采用相同的观测分解框架。</p></div></div>
      <figure className="model-architecture"><a href={`${modelAssets}research/paper-architecture.png`} target="_blank" rel="noreferrer"><img src={`${modelAssets}research/paper-architecture.png`} loading="lazy" alt="数据库建设、物理特征工程、联合学习及验证的总体架构"/></a><figcaption>数据库—特征—联合学习—材料评价总体架构。图内预测小图为前期示例，当前模型性能见“模型性能”；预训练漏斗为指定折的处理示例，虚线实验区域为后续验证环节。点击查看原图。</figcaption></figure>
      <details className="model-foundation"><summary>前期建模基础 · 关键物理量</summary><p>基于公开数据与方法框架完成数据清洗、特征工程和模型重建。相对介电常数、Ce³⁺最低5d₁能量和质心位移的图示 R² 分别为0.9733、0.8545和0.8879，对应前期物理量建模任务。</p><a href={`${modelAssets}research/physical-quantities.png`} target="_blank" rel="noreferrer"><img src={`${modelAssets}research/physical-quantities.png`} loading="lazy" alt="前期介电常数、5d₁能量、质心位移预测与相关性分析"/></a></details>
    </section>}
    </div><details className="model-provenance"><summary>模型版本与数据来源</summary><p>{data.version} · {data.date}</p>{Object.entries(data.source_hashes).map(([name,hash])=><p key={name}>{name} · SHA-256 {hash}</p>)}<a href={`${modelAssets}public-data/research-20261029.json`} target="_blank" rel="noreferrer">查看公开结果文件</a></details>
  </section>;
}
function EnergyContributions({prediction:p}:{prediction:ModelPrediction}) {
  const values = [p.excitation_ev,-p.latent_loss_ev,p.correction_ev,p.emission_ev]; const levels=[0,p.excitation_ev,p.excitation_ev-p.latent_loss_ev,p.emission_ev];
  const lo=Math.min(0,...levels),hi=Math.max(...levels)*1.08;const y=(v:number)=>235-(v-lo)/(hi-lo)*195;
  const names=['激发 +u','弛豫 −v','修正 c','发射 Eem'];const colors=['#426f98','#b27d69','#698c83','#173f59'];
  return <svg className="model-contributions" viewBox="0 0 650 290" role="img" aria-label="激发、弛豫、陶瓷观测修正的能量贡献图">
    {[0,1,2,3].map(t=>t>=lo&&t<=hi?<g key={t}><line x1="45" x2="630" y1={y(t)} y2={y(t)} stroke="#e6ecef"/><text x="33" y={y(t)+4} textAnchor="end">{t}</text></g>:null)}<text x="20" y="20">eV</text>
    {values.map((v,i)=>{const start=i===3?0:levels[i],end=i===3?p.emission_ev:levels[i+1];const top=y(Math.max(start,end));const height=Math.max(2,Math.abs(y(start)-y(end)));return <g key={i}><rect x={65+i*148} y={top} width="86" height={height} fill={colors[i]}/>{i<2&&<line x1={151+i*148} x2={213+i*148} y1={y(end)} y2={y(end)} stroke="#91a5af" strokeDasharray="4 3"/>}<text x={108+i*148} y={Math.max(20,top-9)} textAnchor="middle">{i===3?'':v>=0?'+':''}{v.toFixed(4)}</text><text x={108+i*148} y="270" textAnchor="middle">{names[i]}</text></g>;})}
  </svg>;
}
function ParityPlot({points,selected,onSelect,records}:{points:ModelPrediction[];selected:string|null;onSelect:(id:string)=>void;records:ModelRecord[]}) {
  const current=points.find(p=>p.sample_id===selected),record=records.find(r=>r.sample_id===selected);
  const lo=Math.floor(Math.min(...points.flatMap(p=>[p.actual_nm,p.predicted_nm]))/10)*10-5,hi=Math.ceil(Math.max(...points.flatMap(p=>[p.actual_nm,p.predicted_nm]))/10)*10+5;
  const x=(v:number)=>80+(v-lo)/(hi-lo)*530,y=(v:number)=>590-(v-lo)/(hi-lo)*530;
  return <figure className="model-parity-figure"><figcaption><h3>折外预测与实测对照</h3><p>当前范围 {points.length} 个样品；点选散点查看材料与预测，颜色加深表示当前样品。</p></figcaption><div className="model-parity-layout"><svg className="model-parity" viewBox="0 0 670 670" aria-label="发射波长折外预测散点图">{Array.from({length:6},(_,i)=>lo+i*(hi-lo)/5).map(t=><g key={t}><line x1="80" x2="610" y1={y(t)} y2={y(t)} stroke="#e6ecef"/><text x="65" y={y(t)+5} textAnchor="end">{t.toFixed(0)}</text><text x={x(t)} y="616" textAnchor="middle">{t.toFixed(0)}</text></g>)}<path d="M80 60V590H610" fill="none" stroke="#8296a2"/><line x1={x(lo)} x2={x(hi)} y1={y(lo)} y2={y(hi)} stroke="#b77972" strokeDasharray="7 5"/><text x="345" y="653" textAnchor="middle">文献实测发射波长 / nm</text><text transform="translate(22 325) rotate(-90)" textAnchor="middle">折外预测发射波长 / nm</text>{points.map(p=><circle key={p.sample_id} data-sample={p.sample_id} cx={x(p.actual_nm)} cy={y(p.predicted_nm)} r={p.sample_id===selected?7:4.5} fill={p.sample_id===selected?'#173f59':'#4b929a'} fillOpacity=".85" stroke="white" role="button" tabIndex={0} aria-label={`查看样品 ${p.sample_id}`} onClick={()=>onSelect(p.sample_id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(p.sample_id);}}}><title>{p.sample_id} · 实测 {p.actual_nm.toFixed(2)} / 预测 {p.predicted_nm.toFixed(2)} nm</title></circle>)}</svg><div className="model-plot-selection" aria-live="polite">{current&&record?<><h4>{record.sample_id}</h4><p>{record.formula}</p><dl><div><dt>文献实测</dt><dd>{current.actual_nm.toFixed(2)} nm</dd></div><div><dt>折外预测</dt><dd>{current.predicted_nm.toFixed(2)} nm</dd></div><div><dt>绝对误差</dt><dd>{Math.abs(current.actual_nm-current.predicted_nm).toFixed(2)} nm</dd></div><div><dt>验证折</dt><dd>第 {current.fold+1} 折</dd></div></dl><a href={`https://doi.org/${encodeURI(record.doi)}`} target="_blank" rel="noreferrer">查看文献来源 <ArrowRight size={15}/></a></>:<p>选择一个散点，查看对应样品。</p>}</div></div></figure>;
}
