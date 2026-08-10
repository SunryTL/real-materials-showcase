import { useMemo, useState } from "react";
import project from "../content/project.json";
import models from "../content/models.json";
import literature from "../content/literature.json";
import releases from "../content/releases.json";
import { evaluateReadiness } from "../lib/readiness.mjs";

const fieldNames: Record<string, string> = {
  hostComposition: "基质组成",
  activator: "激活离子",
  sampleForm: "样品形态",
  latticeA: "晶格常数",
  localStructure: "局域结构",
  thickness: "陶瓷厚度",
};

const palette = ["#159a8c", "#287ca3", "#577c99", "#8ca4b5"];

function Stat({ value, label, note }: { value: number; label: string; note: string }) {
  return (
    <article className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </article>
  );
}

function SectionTitle({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return (
    <header className="section-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{lead}</p>
    </header>
  );
}

function App() {
  const [form, setForm] = useState({
    hostComposition: "",
    activator: "Ce³⁺",
    sampleForm: "陶瓷",
    latticeA: "",
    localStructure: "",
    thickness: "",
  });
  const readiness = useMemo(() => evaluateReadiness(form), [form]);
  const maxFamily = Math.max(...project.familyCounts.map(([, count]) => Number(count)));

  const update = (field: keyof typeof form, value: string) => setForm((old) => ({ ...old, [field]: value }));

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="REAL 首页">
          <span className="brand-mark">R</span>
          <span><b>REAL</b><small>Materials Intelligence</small></span>
        </a>
        <nav aria-label="主导航">
          <a href="#data">数据探索</a>
          <a href="#mechanism">机制解析</a>
          <a href="#lab">预测实验室</a>
          <a href="#evidence">研究证据</a>
          <a href="#roadmap">版本路线</a>
        </nav>
        <span className="version">{project.version}</span>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="status-line"><span /> 模型验证中 · 数据窗口已开放</div>
            <p className="hero-kicker">{project.expansion}</p>
            <h1>REAL<br /><em>材料预测平台</em></h1>
            <p className="hero-lead">从可追溯数据出发，拆解稀土发光陶瓷的激发、弛豫与观测过程，让材料预测不仅给出答案，也说明答案为什么可信。</p>
            <div className="hero-actions">
              <a className="button primary" href="#data">查看真实数据</a>
              <a className="button ghost" href="#lab">进入预测预览</a>
            </div>
          </div>
          <div className="hero-visual" aria-label="激发弛豫发射机制示意">
            <div className="energy-axis"><span>高能级</span><span>低能级</span></div>
            <div className="level level-high"><span>5d₁ 激发态</span></div>
            <div className="level level-relaxed"><span>结构弛豫后</span></div>
            <div className="level level-ground"><span>4f 基态</span></div>
            <div className="beam excitation"><i />激发</div>
            <div className="beam emission"><i />发射</div>
            <div className="loss">电子—声子耦合<br /><b>能量损失</b></div>
            <div className="ceramic-chip">陶瓷观测修正<br /><small>厚度 · 自吸收 · 微结构</small></div>
          </div>
        </section>

        <section className="metrics" aria-label="数据库核心指标">
          <Stat value={project.metrics.totalSamples} label="陶瓷样品记录" note="权威总库" />
          <Stat value={project.metrics.coreSamples} label="正式核心候选" note="双标志严格筛选" />
          <Stat value={project.metrics.physicsPairs} label="严格 PL / PLE 配对" note="支持物理分层" />
          <Stat value={project.metrics.coreDoi} label="核心 DOI" note="可追溯来源" />
          <Stat value={project.metrics.families} label="材料家族" note="用于外推分组" />
        </section>

        <section id="data" className="section data-section">
          <SectionTitle eyebrow="01 · Data Explorer" title="数据探索" lead="公开的是经过审计的聚合统计；样品级数据库、论文原图和个人信息保留在私有研究库。" />
          <div className="data-grid">
            <article className="panel family-panel">
              <div className="panel-head"><h3>核心集材料家族</h3><span>n = {project.metrics.coreSamples}</span></div>
              <div className="family-bars">
                {project.familyCounts.slice(0, 10).map(([name, rawCount], index) => {
                  const count = Number(rawCount);
                  return (
                    <div className="family-row" key={name}>
                      <span>{name}</span>
                      <div><i style={{ width: `${(count / maxFamily) * 100}%`, background: palette[index % palette.length] }} /></div>
                      <b>{count}</b>
                    </div>
                  );
                })}
              </div>
              <p className="caption">其余 9 个家族合计 {project.metrics.coreSamples - project.familyCounts.slice(0, 10).reduce((sum, item) => sum + Number(item[1]), 0)} 条。数据口径：{project.coreDefinition}</p>
            </article>
            <div className="data-side">
              <article className="panel funnel-panel">
                <div className="panel-head"><h3>从文献到训练任务</h3><span>2026-08-10 审计</span></div>
                <div className="funnel">
                  <div><strong>255</strong><span>总库</span></div>
                  <div><strong>132</strong><span>核心</span></div>
                  <div><strong>53</strong><span>PL/PLE</span></div>
                </div>
                <p>每次缩小都对应明确质量规则，不以“行数”冒充独立科学证据。</p>
              </article>
              <article className="panel readiness-panel">
                <div className="panel-head"><h3>当前训练准备度</h3><span>不是模型成绩</span></div>
                <div className="readiness-item"><div><b>M0</b><span>组成黑箱基线</span></div><strong>{project.metrics.m0Ready}/132</strong></div>
                <div className="progress"><i style={{ width: `${(project.metrics.m0Ready / 132) * 100}%` }} /></div>
                <div className="readiness-item"><div><b>M1</b><span>严格结构增强</span></div><strong>{project.metrics.m1Ready}/132</strong></div>
                <div className="progress secondary"><i style={{ width: `${(project.metrics.m1Ready / 132) * 100}%` }} /></div>
              </article>
            </div>
          </div>
        </section>

        <section id="mechanism" className="section mechanism-section">
          <SectionTitle eyebrow="02 · Mechanism" title="机制解析" lead="观测到的发射峰不是单一原因决定的。REAL把一个结果拆成三个可检验的问题。" />
          <div className="mechanism-flow">
            <article><span>01</span><h3>电子被激发到哪里？</h3><p>组成、Ce占位、质心位移、晶体场劈裂和局域结构共同决定最低 5d₁ 激发位置。</p><b>M2 · 激发能模型</b></article>
            <i className="flow-arrow">+</i>
            <article><span>02</span><h3>发光前损失多少？</h3><p>结构弛豫、晶格刚性和电子—声子耦合决定激发与发射之间的能量损失。</p><b>M3 · 弛豫损失模型</b></article>
            <i className="flow-arrow">+</i>
            <article><span>03</span><h3>光怎样穿过陶瓷？</h3><p>厚度、自吸收、气孔、缺陷与晶粒使实际测得的峰位偏离材料本征结果。</p><b>M5 · 陶瓷修正</b></article>
          </div>
          <div className="equation"><span>激发位置</span><i>−</i><span>弛豫损失</span><i>+</i><span>陶瓷修正</span><b>= 实测发射能</b></div>
        </section>

        <section id="lab" className="section lab-section">
          <SectionTitle eyebrow="03 · Prediction Lab" title="预测实验室" lead="首版只检查输入能支持哪一级模型，不输出未经严格验证的数值。" />
          <div className="lab-grid">
            <form className="lab-form" onSubmit={(event) => event.preventDefault()}>
              <label>基质组成 <span>必填</span><input value={form.hostComposition} onChange={(e) => update("hostComposition", e.target.value)} placeholder="例如 Y₃Al₅O₁₂" /></label>
              <label>激活离子 <span>必填</span><input value={form.activator} onChange={(e) => update("activator", e.target.value)} /></label>
              <label>样品形态 <span>必填</span><select value={form.sampleForm} onChange={(e) => update("sampleForm", e.target.value)}><option>陶瓷</option><option>透明陶瓷</option><option>粉体</option><option>单晶</option></select></label>
              <label>晶格常数 a <small>可选 · Å</small><input value={form.latticeA} onChange={(e) => update("latticeA", e.target.value)} placeholder="例如 12.01" /></label>
              <label>局域配位信息 <small>可选</small><input value={form.localStructure} onChange={(e) => update("localStructure", e.target.value)} placeholder="例如 Ce–O 平均键长" /></label>
              <label>陶瓷厚度 <small>可选 · mm</small><input value={form.thickness} onChange={(e) => update("thickness", e.target.value)} placeholder="例如 1.0" /></label>
            </form>
            <article className="lab-result">
              <p className="eyebrow">Readiness check</p>
              <div className="score-ring" style={{ "--score": `${readiness.completeness * 3.6}deg` } as React.CSSProperties}><span><strong>{readiness.completeness}%</strong>字段完整度</span></div>
              <div className="route"><span>当前对应模型层级</span><b>{readiness.route}</b></div>
              <div className="missing"><span>{readiness.missing.length ? "尚缺必填字段" : "必填字段完整"}</span><p>{readiness.missing.length ? readiness.missing.map((field) => fieldNames[field]).join("、") : "可继续补充结构与厚度信息，进入更高层级。"}</p></div>
              <div className="validation-note"><i />模型正在进行严格分组验证，暂不提供数值预测。当前登记 {models.models.length} 个研究层级。</div>
            </article>
          </div>
        </section>

        <section id="evidence" className="section evidence-section">
          <SectionTitle eyebrow="04 · Evidence" title="研究证据" lead="平台路线建立在可核验的前人工作上，同时明确哪些问题仍由本项目回答。" />
          <div className="evidence-grid">
            {literature.map((paper, index) => (
              <article key={paper.doi}>
                <span className="paper-number">0{index + 1}</span>
                <p>{paper.author} · {paper.year}</p>
                <h3>{paper.title}</h3>
                <div><small>已有贡献</small><p>{paper.contribution}</p></div>
                <div><small>REAL 的承接</small><p>{paper.relation}</p></div>
                <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">DOI {paper.doi} ↗</a>
              </article>
            ))}
          </div>
        </section>

        <section id="roadmap" className="section roadmap-section">
          <SectionTitle eyebrow="05 · Releases" title="版本路线" lead="每一个公开能力都绑定数据口径、模型版本和验证状态，计划不写成成果。" />
          <div className="release-list">
            {releases.map((release) => (
              <article className={release.status} key={release.version}>
                <div><span>{release.status === "current" ? "当前版本" : release.status === "planned" ? "下一阶段" : "长期方向"}</span><b>{release.date}</b></div>
                <h3>{release.version}</h3>
                <ul>{release.changes.map((change) => <li key={change}>{change}</li>)}</ul>
              </article>
            ))}
          </div>
          <div className="contribution-callout">
            <div><p className="eyebrow">Future contribution portal</p><h3>让课题组实验数据持续进入研究闭环</h3><p>未来入口将包含标准模板、单位校验、来源追溯与人工审核。未经审核的数据不会直接参与正式训练。</p></div>
            <span>规划中</span>
          </div>
        </section>
      </main>

      <footer><div><b>REAL</b><span>{project.project}</span></div><p>公开聚合统计 · 来源版本 {project.sourceVersion} · 审计日期 {project.auditedOn}</p></footer>
    </>
  );
}

export default App;
