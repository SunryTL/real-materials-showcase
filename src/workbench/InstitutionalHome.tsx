import { ArrowRight } from 'lucide-react';
import type { ExplorerData } from './explorer-data';

const asset = (name: string) => `${import.meta.env.BASE_URL}brand/${name}`;
export function UniversityMarks() {
  return <div className="real-university-marks" aria-label="江苏师范大学、贝尔格莱德大学与文卡国家核科学研究所">
    <a href="https://www.jsnu.edu.cn/" target="_blank" rel="noreferrer"><img src={asset('jsnu-crest.png')} alt="江苏师范大学校徽"/><span>江苏师范大学<small>Jiangsu Normal University</small></span></a>
    <a href="https://www.bg.ac.rs/" target="_blank" rel="noreferrer"><img src={asset('belgrade-crest.png')} alt="贝尔格莱德大学校徽"/><span>贝尔格莱德大学<small>University of Belgrade</small></span></a>
    <a className="real-vinca-mark" href="https://vin.bg.ac.rs/en/" target="_blank" rel="noreferrer" title="贝尔格莱德大学文卡国家核科学研究所 · Vinča Institute of Nuclear Sciences"><img src={asset('vinca-mark.png')} alt="文卡国家核科学研究所官方标识"/><span><b>文卡国家核科学研究所</b><small>Vinča Institute of Nuclear Sciences</small></span></a>
  </div>;
}

export function ResearchFooter() {
  return <footer className="real-footer"><div className="real-container real-footer-grid">
    <div><b className="real-footer-brand">REAL</b><p>稀土荧光材料合作研究平台</p><p>Rare-Earth Absorption and Luminescence</p><a href="#database">探索数据库 <ArrowRight size={16}/></a></div>
    <div><a href="https://www.jsnu.edu.cn/" target="_blank" rel="noreferrer"><h3>江苏师范大学</h3></a><p>Jiangsu Normal University</p><p>江苏省先进激光材料与器件重点实验室</p><p>Jiangsu Key Laboratory of Advanced Laser Materials and Devices</p></div>
    <div><a href="https://www.bg.ac.rs/" target="_blank" rel="noreferrer"><h3>贝尔格莱德大学</h3></a><p>University of Belgrade</p><a href="https://vin.bg.ac.rs/en/" target="_blank" rel="noreferrer"><p>贝尔格莱德大学塞尔维亚文卡国家核科学研究所</p></a><p>Vinča Institute of Nuclear Sciences – National Institute of the Republic of Serbia, University of Belgrade</p></div>
  </div><div className="real-container real-footer-bottom">REAL · 中塞合作研究平台<span>可追溯数据 · 物理可解释建模 · 实验验证</span></div></footer>;
}

export default function InstitutionalHome({ data }: { data: ExplorerData | null }) {
  return <div className="real-home">
    <section className="real-hero"><div className="real-container real-hero-layout">
      <div className="real-hero-copy"><h1>REAL Predictions.<br/>Real Light.</h1><h2>真实预测，真切发光</h2><p>面向稀土荧光材料的物理可解释人工智能与定向创制。</p><div className="real-actions"><a className="real-button" href="#database">探索数据库 <ArrowRight size={20}/></a><a className="real-button secondary" href="#cooperation">了解合作研究</a></div></div>
      <div className="real-letterform" aria-hidden="true">REAL</div>
    </div></section>
    <section className="real-philosophy real-container" aria-labelledby="philosophy-title">
      <div className="real-section-heading"><h2 id="philosophy-title">让材料研究走向<br/>可解释、可验证</h2><p>Rare-Earth Absorption and Luminescence<br/><span>以物理认识材料，以数据拓展发现。</span></p></div>
      <div className="real-values">{[
        ['Reality','真实','以可追溯数据与物理证据认识材料。'],
        ['Exact','精确','以定量建模与严格验证研究发光性能。'],
        ['Actionable','可行动','让模型分析服务材料选择、实验设计与工艺优化。'],
        ['Light','光与启发','探索稀土发光机制与高性能光转换材料。'],
      ].map(([en,cn,body])=><article key={en}><h3>{en}<span>{cn}</span></h3><p>{body}</p></article>)}</div>
    </section>
    <section className="real-cooperation" id="cooperation"><div className="real-container">
      <div className="real-section-heading"><h2>两校协同，<br/>拓展材料研究的边界</h2><p>以多体系荧光材料为共同研究方向，汇聚材料探索、机制表征、人工智能与陶瓷创制的研究优势。双方在已有合作基础上推进联合项目申报。</p></div>
      <div className="real-partners"><article><h3>江苏师范大学</h3><p className="real-institution-en">Jiangsu Normal University</p><p className="real-unit">江苏省先进激光材料与器件重点实验室</p><h4>物理可解释人工智能<br/>与陶瓷定向创制</h4><p>研究关注构效规律提炼与多目标逆向设计，结合陶瓷定向制备、微结构调控及极端功率服役评价，探索材料性能与应用需求的协同优化。</p><p className="real-research-terms">可解释建模 · 逆向设计 · 陶瓷制备 · 服役评价</p></article>
      <article><h3>贝尔格莱德大学</h3><p className="real-institution-en">University of Belgrade</p><p className="real-unit">文卡国家核科学研究所</p><h4>多体系荧光粉探索<br/>与热猝灭机制研究</h4><p>合作研究聚焦多基质荧光材料、局域结构与缺陷能级、能量迁移及热猝灭过程，通过候选材料制备与表征，为构效分析积累多样的材料证据。</p><p className="real-research-terms">粉体探索 · 缺陷表征 · 热猝灭机制 · 实验验证</p></article></div>
      <div className="real-research-chain" aria-label="共同研究方向">{['材料探索','机制解析与智能设计','实验反馈','陶瓷制备与服役评价'].map((s,i)=><div key={s}><span>{s}</span>{i<3&&<ArrowRight aria-hidden="true" size={22}/>}</div>)}</div>
    </div></section>
    <section className="real-foundation real-container"><div className="real-section-heading"><h2>从研究证据出发</h2><p>现有Ce³⁺石榴石荧光／透明陶瓷数据库，为材料组成、局域结构、光谱与工艺的关联研究提供可追溯基础。</p></div>
      <div className="real-foundation-grid"><div className="real-evidence-panel"><img className="real-evidence-preview" src={asset('evidence-galaxy-preview.png')} alt="REAL公开数据库证据星系界面预览；节点表示材料、文献和样品归属" loading="lazy"/><h3>组成、结构、光谱与工艺<br/>在同一证据体系中相遇</h3><p>探索证据星系中的材料家族与文献归属，或切换至PCA化学空间，查看描述符空间中的样品分布。</p><a href="#database">进入交互数据库 <ArrowRight size={20}/></a><dl><div><dt>正式记录</dt><dd>{data?.summary.samples ?? '—'}</dd></div><div><dt>可追溯 DOI</dt><dd>{data?.summary.doi ?? '—'}</dd></div></dl><small>当前公开快照：{data?.version || '正在读取'}。统计随审核后的版本更新。</small></div>
      <div className="real-entry-links"><a href="#database"><h3>数据库</h3><p>材料家族、证据星系与PCA化学空间</p><ArrowRight/></a><a href="#literature"><h3>文献整理</h3><p>正式文献证据与待核验研究线索</p><ArrowRight/></a><a href="#intake"><h3>数据录入</h3><p>本机整理、人工审核与版本化发布</p><ArrowRight/></a><p className="real-model-status">模型正在进行严格分组验证，暂不提供数值预测。</p></div></div>
    </section>
  </div>;
}
