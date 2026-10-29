import { useEffect, useState } from 'react';
import type { ExplorerRecord } from './explorer-data';
import './research-results.css';
type Prediction = { sample_id: string; seed: number; fold: number; actual_nm: number; predicted_nm: number };
type Metric = { route: string; name: string; mae: number; mae_sd: number; rmse: number; r2: number; r2_sd: number };
type Research = { version: string; date: string; n: number; paired: number; seeds: number[]; metrics: Metric[]; records: ExplorerRecord[]; predictions: Prediction[]; validation: string; source_hashes: Record<string,string> };
const root = `${import.meta.env.BASE_URL}workbench/`;
export function ResearchResults() {
  const [data, setData] = useState<Research | null>(null), [error, setError] = useState('');
  const [seed, setSeed] = useState(20260918), [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { const c = new AbortController(); fetch(`${root}public-data/research-20261029.json`, { signal: c.signal }).then(r => { if (!r.ok) throw new Error('研究结果读取失败'); return r.json(); }).then(setData).catch(e => { if (!c.signal.aborted) setError(String(e)); }); return () => c.abort(); }, []);
  if (error) return <p role="alert">{error}。请重新打开“模型与论文”。</p>;
  if (!data) return <p role="status">正在读取版本化模型结果…</p>;
  const metric = data.metrics.find(m => m.route === 'joint_gpr')!;
  const points = data.predictions.filter(p => p.seed === seed);
  const chosen = points.find(p => p.sample_id === selected), record = data.records.find(p => p.sample_id === selected);
  const lo = Math.floor(Math.min(...data.predictions.flatMap(p => [p.actual_nm,p.predicted_nm])) / 10) * 10 - 5;
  const hi = Math.ceil(Math.max(...data.predictions.flatMap(p => [p.actual_nm,p.predicted_nm])) / 10) * 10 + 5;
  const x = (n: number) => 75 + (n-lo)/(hi-lo)*550, y = (n: number) => 595 - (n-lo)/(hi-lo)*550;
  const ticks = Array.from({ length: 6 }, (_, i) => lo + i*(hi-lo)/5);
  return <article className="research-results">
    <header><h2>物理分层建模与论文进展</h2><p>Ce³⁺石榴石陶瓷发射预测 · 核验数据与六类联合算法比较 · {data.date}</p><p className="science-note">本节展示固定的论文核验集与模型版本；上方样品筛选用于前三个数据库页签。</p></header>
    <section><h3>最新发射预测结果</h3><p>以 {data.n} 条核验发射标签和 {data.paired} 组配对激发／发射观测开展联合学习。{data.validation}同一组成保持在同一折，数据处理、先验权重和超参数选择在训练折内完成。</p>
      <div className="research-metrics"><div><span>平均 R²</span><strong>{metric.r2.toFixed(4)}</strong></div><div><span>MAE / nm</span><strong>{metric.mae.toFixed(2)}</strong></div><div><span>RMSE / nm</span><strong>{metric.rmse.toFixed(2)}</strong></div><div><span>验证方式</span><strong>3 × 5 折</strong></div></div>
      <div className="research-parity-layout"><div><label className="research-repeat">折外预测重复 <select aria-label="预测重复" value={seed} onChange={e => setSeed(Number(e.target.value))}>{data.seeds.map((v,i) => <option key={v} value={v}>重复 {i+1} · seed {v}</option>)}</select></label>
        <svg className="research-parity" viewBox="0 0 700 670" aria-label="联合高斯过程发射波长折外预测散点图">
          {ticks.map(t => <g key={t}><line x1={75} x2={625} y1={y(t)} y2={y(t)} stroke="#e6edf0"/><text x={62} y={y(t)+5} textAnchor="end">{t.toFixed(0)}</text><text x={x(t)} y={619} textAnchor="middle">{t.toFixed(0)}</text></g>)}
          <path d="M75 45V595H625" fill="none" stroke="#78909c"/><line x1={x(lo)} y1={y(lo)} x2={x(hi)} y2={y(hi)} stroke="#ba716d" strokeDasharray="7 5"/>
          <text x="350" y="654" textAnchor="middle">文献实测发射波长 / nm</text><text transform="translate(21 320) rotate(-90)" textAnchor="middle">折外预测发射波长 / nm</text>
          {points.map(p => <circle key={p.sample_id} cx={x(p.actual_nm)} cy={y(p.predicted_nm)} r={selected === p.sample_id ? 7 : 4.5} fill={selected === p.sample_id ? '#db9c56' : '#388792'} fillOpacity=".8" stroke="white" role="button" tabIndex={0} aria-label={`查看预测样品 ${p.sample_id}`} onClick={() => setSelected(p.sample_id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(p.sample_id); } }}><title>{p.sample_id} · 实测 {p.actual_nm.toFixed(2)} nm · 预测 {p.predicted_nm.toFixed(2)} nm · 第 {p.fold+1} 折</title></circle>)}
        </svg></div>
        <aside className="research-sample" aria-live="polite"><h3>点选查看样品证据</h3>{chosen && record ? <><h4>{record.sample_id}</h4><dl><dt>组成</dt><dd>{record.formula}</dd><dt>材料家族</dt><dd>{record.family}</dd><dt>文献实测</dt><dd>{chosen.actual_nm.toFixed(2)} nm</dd><dt>折外预测</dt><dd>{chosen.predicted_nm.toFixed(2)} nm</dd><dt>绝对误差</dt><dd>{Math.abs(chosen.actual_nm-chosen.predicted_nm).toFixed(2)} nm</dd><dt>验证折</dt><dd>seed {seed} · fold {chosen.fold+1}</dd><dt>来源</dt><dd><a href={`https://doi.org/${encodeURI(record.doi)}`} target="_blank" rel="noreferrer">{record.doi}</a></dd></dl></> : <p>点击散点或用键盘选择，查看对应样品的组成、实测值、预测值及文献链接。</p>}<p className="science-note">每次重复包含92个样品的折外预测。上方指标为三次重复的均值，散点展示当前所选重复。验证范围为组成分组开发集评估。</p></aside>
      </div>
      <h3>相同数据与验证划分下的算法比较</h3><div className="science-table-scroll"><table><thead><tr><th>联合学习算法</th><th>MAE ± SD / nm</th><th>RMSE / nm</th><th>R² ± SD</th></tr></thead><tbody>{data.metrics.filter(m => m.route !== 'joint_inner_selected').map(m => <tr key={m.route}><td>{m.name}</td><td>{m.mae.toFixed(3)} ± {m.mae_sd.toFixed(3)}</td><td>{m.rmse.toFixed(3)}</td><td>{m.r2.toFixed(4)} ± {m.r2_sd.toFixed(4)}</td></tr>)}</tbody></table></div><p className="science-note">SD 表示三次重复间的标准差。六类算法采用相同的激发—弛豫—陶瓷观测修正结构。性能反映当前样品与分组方案，材料外推仍需独立实验评价。</p>
    </section>
    <section><h3>论文架构：联合观测约束下的物理分层学习</h3><p>研究围绕数据库建设、物理特征工程、联合建模与候选材料评价展开。激发支路 u 描述激发观测，弛豫支路 v 表征潜在能量损失，陶瓷观测修正 c 纳入工艺、厚度与微结构相关影响，三支路共同确定发射能量。</p>
      <figure className="research-figure"><a href={`${root}research/paper-architecture.png`} target="_blank" rel="noreferrer"><img loading="lazy" src={`${root}research/paper-architecture.png`} alt="论文数据库、特征工程、u-v+c联合学习与应用验证总体架构"/></a><figcaption>论文主稿中的总体研究架构（点击查看原图）。图内预测小图沿用前期示例，最新92条模型结果见上方交互散点；预训练漏斗数字对应指定折的数据处理示例，虚线实验区域表示拟开展的验证环节。</figcaption></figure>
      <div className="research-equations">
        <div><h4>能量分解与观测关系</h4><p className="research-equation">E<sub>em</sub> = u − v + c<span>E = hc / λ</span></p><p>hc ≈ 1239.84 eV·nm。配对光谱给出的净能量差为 E<sub>ex</sub> − E<sub>em</sub> = v − c；u 与 PLE 激发观测对应，v 与 c 由联合观测约束。</p></div>
        <div><h4>物理支路的概率表征</h4><p className="research-equation">f<sub>j</sub>(x<sub>j</sub>) ∼ GP(m<sub>j</sub>, k<sub>j</sub>)<span>j ∈ {'{u, v, c}'}</span></p><p>外部数据先验提供激发与发射均值函数；各支路采用对应的组成、局域结构和陶瓷条件特征。先验权重由内层验证选择。</p></div>
        <div><h4>联合观测与后验推断</h4><p className="research-equation">y<sub>O</sub> = H<sub>O</sub>f + ε<span>ε ∼ N(0, Σ<sub>ε</sub>)</span></p><p className="research-equation">f̂<sub>*</sub> = m<sub>*</sub> + K<sub>*f</sub>H<sub>O</sub><sup>T</sup>C<sub>O</sub><sup>−1</sup>(y<sub>O</sub> − H<sub>O</sub>m<sub>f</sub>)</p><p>C<sub>O</sub> = H<sub>O</sub>K<sub>f</sub>H<sub>O</sub><sup>T</sup> + Σ<sub>ε</sub>。激发观测行采用 (1, 0, 0)，发射观测行采用 (1, −1, 1)，按实际标签组织联合学习。</p></div>
      </div>
    </section>
    <section><h3>前期物理量建模基础</h3><p>基于公开数据与方法框架完成数据清洗、特征工程和模型重建。相对介电常数、Ce³⁺最低5d₁能量和5d能级质心位移的图示 R² 分别为 0.9733、0.8545 和 0.8879。该组结果对应前期物理量建模任务，与本页最新陶瓷发射模型分别报告。</p><Figure file="research/physical-quantities.png" title="关键物理量预测与描述符相关性：相对介电常数、最低5d₁能量、质心位移及相关性热图。"/></section>
    <section><h3>数据库材料空间与多源证据</h3><p>保留材料家族发射分布、证据拓扑和跨尺度变量关联图。下列原图对应前期132条核心数据整理；最新核验子集可在上方“数据库版本”中选择，全部交互图与样品链接同步切换。</p><Figure file="figures/08_emission_landscape.png" title="石榴石陶瓷材料家族的发射波长分布（历史核心集）。"/><Figure file="figures/07_evidence_topology.png" title="多源证据拓扑、字段覆盖与变量关联（历史核心集）。"/></section>
    <details className="science-method"><summary>结果版本与来源记录</summary><p>{data.version} · {data.validation}</p>{Object.entries(data.source_hashes).map(([f,h]) => <p key={f}>{f} · SHA-256 {h}</p>)}<a href={`${root}public-data/research-20261029.json`} target="_blank" rel="noreferrer">查看本页公开结果与来源哈希</a></details>
  </article>;
}
function Figure({file,title}:{file:string;title:string}) { return <figure className="research-figure"><a href={`${root}${file}`} target="_blank" rel="noreferrer"><img loading="lazy" src={`${root}${file}`} alt={title}/></a><figcaption>{title} 点击查看原图。</figcaption></figure>; }
