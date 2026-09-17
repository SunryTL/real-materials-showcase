import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, BookOpenCheck, Copy, Database, ExternalLink,
  FileSearch, FlaskConical, Home, Layers3, Menu, Microscope, ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { ScientificExplorer } from './ScientificExplorer';
import { fetchExplorer, type ExplorerData } from './explorer-data';

type Page = 'home' | 'intake' | 'literature' | 'database';
type Priority = {
  doi: string; title: string; target_routes: string; priority: number;
  status: string; next_action: string;
};

const TASK = `请读取 real-materials-research 根 README.md、STATUS.md、DECISIONS.md、research/README.md 和 research/database/EXTERNAL_DATA_COLLABORATION_PLAN.md。处理我上传的论文：核对 DOI、题目、版本与 SHA-256，按七表 Schema 生成候选数据和逐字段证据；检查 PL/PLE、单位、样品重复与分组。不要覆盖权威 Excel 或正式快照，完成后给出核心／辅助／排除／待补证据建议，等待我确认。`;
const privateWorkbench = import.meta.env.VITE_REAL_PRIVATE_URL || 'http://127.0.0.1:5173/real-materials-showcase/workbench#inbox';

const REAL_PRINCIPLES = [
  ['Reality', '真实', '可追溯数据与可核验研究证据'],
  ['Exact', '精确', '面向发光性能的定量建模与严格验证'],
  ['Actionable', '可行动', '连接候选筛选、材料设计与实验反馈'],
  ['Light', '光与启发', '服务稀土发光材料与极端功率照明'],
];

function usePortalData() {
  const [data, setData] = useState<ExplorerData | null>(null);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchExplorer({ version: 'latest', family: '', material_form: '', status: 'formal' }, controller.signal, true),
      fetch(`${import.meta.env.BASE_URL}workbench/public-data/literature-priorities.json`, { signal: controller.signal }).then(response => response.ok ? response.json() : { items: [] }),
    ]).then(([explorer, queue]) => {
      setData(explorer);
      setPriorities(queue.items || []);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '公开数据载入失败');
    });
    return () => controller.abort();
  }, []);
  return { data, priorities, error };
}

function HomePage({ data, go }: { data: ExplorerData | null; go: (page: Page) => void }) {
  const metrics = [
    [data?.summary.samples ?? '—', '数据库记录'],
    [132, '核心陶瓷样品'],
    [data?.summary.doi ?? '—', '可追溯 DOI'],
    [36, '组成描述符'],
  ];
  return <div className="portal-home">
    <section className="portal-hero">
      <div className="portal-hero-copy">
        <span className="portal-status"><i />AUDITED · VERSIONED · REPRODUCIBLE</span>
        <h2>把文献证据变成<em>可检验的发射预测</em></h2>
        <p>REAL围绕Ce³⁺石榴石陶瓷，把散落在论文中的组成、光谱、结构与工艺证据整理成可追溯数据库，再用严格分组的黑箱基线和物理分层模型回答“为什么发出这个波长”。</p>
        <div className="portal-hero-partners" aria-label="中塞联合研究单位">
          <p><b>江苏师范大学</b><span>Jiangsu Normal University</span></p>
          <p><b>贝尔格莱德大学塞尔维亚文卡国家核科学研究所</b><span>Vinča Institute of Nuclear Sciences</span></p>
        </div>
        <div className="portal-actions">
          <button className="wb-button primary" onClick={() => go('database')}>探索数据库 <ArrowRight size={16}/></button>
          <button className="wb-button portal-quiet" onClick={() => go('literature')}>查看文献证据</button>
        </div>
      </div>
      <div className="portal-orbit" aria-label="REAL分层研究路线">
        <div className="orbit-field"><i/><i/><i/><i/></div>
        <div className="orbit-core"><span>REAL</span><small>emission intelligence</small></div>
        <div className="orbit-node node-data"><Database size={18}/><b>Data</b><small>可追溯证据</small></div>
        <div className="orbit-node node-excite"><FlaskConical size={18}/><b>M2</b><small>最低5d₁</small></div>
        <div className="orbit-node node-relax"><Layers3 size={18}/><b>M3</b><small>表观Stokes</small></div>
        <div className="orbit-node node-ceramic"><Microscope size={18}/><b>M5</b><small>陶瓷观测修正</small></div>
      </div>
    </section>
    <section className="portal-philosophy" aria-labelledby="real-philosophy-title">
      <header>
        <p>Rare-Earth Absorption and Luminescence</p>
        <h3 id="real-philosophy-title">REAL Predictions. Real Light.</h3>
        <span>真实预测，真切发光</span>
      </header>
      <div className="portal-principles">
        {REAL_PRINCIPLES.map(([name, cn, description]) => <article key={name}><b>{name}</b><span>{cn}</span><p>{description}</p></article>)}
      </div>
    </section>
    <section className="portal-metrics" aria-label="当前数据库证据规模">
      {metrics.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
      <p>当前版本 <b>{data?.version || '正在读取'}</b><small>数字随审核后的正式快照更新</small></p>
    </section>
    <section className="portal-story">
      <div><span>科学问题</span><h3>同样是Ce³⁺石榴石，组成和局域环境怎样共同决定发射？</h3></div>
      <ol>
        <li><b>M0</b><span>组成黑箱基线</span><p>先确认数据库能否学到稳定的家族与组成趋势。</p></li>
        <li><b>M2–M4</b><span>激发—弛豫分层</span><p>把最低5d₁和表观能量损失拆开学习。</p></li>
        <li><b>M5</b><span>陶瓷观测修正</span><p>检验厚度、自吸收、工艺和微结构形成的观测残差。</p></li>
      </ol>
    </section>
    <section className="portal-proof">
      <h3>每一次数据库更新，都必须回到论文证据。</h3>
      <div>{['发现数据缺口','取得原文','Codex七表候选','负责人审核','正式快照','REAL重算'].map((item, index) => <span key={item}><i>{String(index + 1).padStart(2, '0')}</i>{item}</span>)}</div>
    </section>
    <footer className="portal-collaboration-footer">
      <div><b>中塞联合研究平台</b><span>China–Serbia Collaborative Research</span></div>
      <p><b>江苏师范大学</b><span>江苏省先进激光材料与器件重点实验室</span><small>Jiangsu Normal University · Jiangsu Key Laboratory of Advanced Laser Materials and Devices</small></p>
      <p><b>贝尔格莱德大学塞尔维亚文卡国家核科学研究所</b><small>Vinča Institute of Nuclear Sciences – National Institute of the Republic of Serbia, University of Belgrade</small></p>
    </footer>
  </div>;
}

function IntakePage({ data, copied, copyTask }: { data: ExplorerData | null; copied: boolean; copyTask: () => void }) {
  return <div className="portal-page">
    <section className="portal-page-lead intake-lead">
      <div><span>LOCAL-FIRST RESEARCH INTAKE</span><h2>论文与候选表进入同一审核链</h2><p>公开页面不接收PDF，也不调用网页API。原文、权威Excel和密钥留在本机；这里展示当前正式数据，并把整理任务交接给受控的私有工作台与Codex。</p></div>
      <div className="intake-actions"><a className="wb-button primary" href={privateWorkbench}><UploadCloud size={16}/>打开本机私有工作台</a><button className="wb-button portal-quiet" onClick={copyTask}><Copy size={15}/>{copied ? '已复制' : '复制Codex任务'}</button></div>
    </section>
    <section className="intake-path" aria-label="数据准入步骤">
      {['PDF登记与哈希','DOI与目标字段','Codex七表候选','人工证据审核','新正式快照'].map((item, index) => <div key={item}><strong>{index + 1}</strong><span>{item}</span></div>)}
    </section>
    <section className="portal-table-section">
      <header><div><h3>当前正式数据库预览</h3><p>只展示审核后的脱敏样品字段；完整证据仍由本地主库管理。</p></div><span>{data?.summary.samples ?? '—'} records · {data?.summary.doi ?? '—'} DOI</span></header>
      <div className="portal-table-scroll"><table aria-label="当前正式数据库预览"><thead><tr><th>样品ID</th><th>材料家族</th><th>组成</th><th>PL / nm</th><th>字段覆盖</th></tr></thead><tbody>{data?.records.slice(0, 12).map(row => <tr key={row.sample_id}><td>{row.sample_id}</td><td>{row.family}</td><td>{row.formula}</td><td>{row.emission_nm ?? '缺失'}</td><td>{row.available_fields}/{row.total_fields}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

function LiteraturePage({ data, priorities }: { data: ExplorerData | null; priorities: Priority[] }) {
  const papers = data?.charts.evidence.papers || [];
  return <div className="portal-page">
    <section className="portal-page-lead literature-lead"><div><span>EVIDENCE LEDGER</span><h2>已整理文献与下一批证据</h2><p>样品数不等于独立证据。这里同时显示正式数据库中的论文贡献和根据材料家族缺口生成的下一批候选。</p></div><div className="literature-totals"><strong>{papers.length}</strong><span>正式数据库DOI</span><strong>{priorities.length}</strong><span>下一批候选</span></div></section>
    <div className="literature-columns">
      <section className="literature-ledger"><header><h3>已进入正式数据库</h3><span>按样品贡献排序</span></header>{papers.slice(0, 14).map((paper, index) => <article key={paper.doi}><i>{String(index + 1).padStart(2, '0')}</i><div><a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">{paper.doi || 'DOI待确认'}</a><small>已审核 · 正式快照</small></div><strong>{paper.samples}<small>samples</small></strong></article>)}</section>
      <section className="literature-ledger priority"><header><h3>下一批优先处理</h3><span>候选 · 需原文核验</span></header>{priorities.map(item => <article key={item.doi}><i>P{item.priority}</i><div><a href={`https://doi.org/${item.doi}`} target="_blank" rel="noreferrer">{item.doi}</a><b>{item.title}</b><small>{item.target_routes} · {item.next_action}</small></div><strong>{item.status}</strong></article>)}</section>
    </div>
    <p className="portal-boundary"><ShieldCheck size={17}/>候选DOI不代表已经取得原文，也不代表样品已经进入数据库；只有逐字段证据审核通过后才移动正式版本。</p>
  </div>;
}

export default function PublicWorkbenchApp() {
  const raw = window.location.hash.replace('#', '') as Page | 'dashboard' | 'inbox';
  const initial: Page = raw === 'dashboard' ? 'home' : raw === 'inbox' ? 'intake' : ['home', 'intake', 'literature', 'database'].includes(raw) ? raw as Page : 'home';
  const [page, setPage] = useState<Page>(initial);
  const [mobile, setMobile] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data, priorities, error } = usePortalData();
  useEffect(() => { window.location.hash = page; }, [page]);
  const nav = useMemo(() => [
    { id: 'home' as Page, label: '首页', icon: Home },
    { id: 'intake' as Page, label: '数据录入', icon: UploadCloud },
    { id: 'literature' as Page, label: '文献整理', icon: FileSearch },
    { id: 'database' as Page, label: '数据库状态', icon: BarChart3 },
  ], []);
  const meta = {
    home: ['REAL科研平台', '从文献证据到物理可解释的Ce³⁺石榴石陶瓷发射预测'],
    intake: ['数据录入', '本机登记、Codex蒸馏、人工审核与版本发布'],
    literature: ['文献整理', '已整理证据与下一批高价值论文'],
    database: ['数据库状态', '当前正式脱敏快照的交互科研图'],
  }[page];
  const go = (next: Page) => { setPage(next); setMobile(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const copyTask = async () => { await navigator.clipboard.writeText(TASK); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return <div className="wb-shell wb-public-shell">
    <aside className={`wb-sidebar ${mobile ? 'open' : ''}`}>
      <div className="wb-sidebar-brand"><span>R</span><div><b>REAL</b><small>RESEARCH WORKBENCH</small><small className="wb-collab-mark">中塞联合研究平台</small></div></div>
      <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} aria-label={label} className={page === id ? 'active' : ''} onClick={() => go(id)}><Icon size={18}/><span>{label}</span>{page === id && <i/>}</button>)}</nav>
      <div className="wb-sidebar-system"><p>公开研究版本</p><div><span className="status-dot candidate_ready"/><b>{data?.version || '正在读取'}</b></div><div><span className="status-dot candidate_ready"/><b>审核后脱敏</b></div><small>PDF、权威Excel、候选证据与API Key不进入公开构建</small></div>
      <a className="wb-user" href="https://github.com/SunryTL/real-materials-research" target="_blank" rel="noreferrer"><span><BookOpenCheck size={16}/></span><div><b>科研主库</b><small>规则与证据索引</small></div><ExternalLink size={16}/></a>
    </aside>
    <main className="wb-main"><header className="wb-topbar"><button className="icon-button mobile-menu" onClick={() => setMobile(!mobile)} aria-label="打开导航"><Menu size={20}/></button><div className="wb-topbar-title"><h1>{meta[0]}</h1><span>{meta[1]}</span></div><div className="wb-top-collaboration"><small>CHINA–SERBIA COLLABORATIVE RESEARCH</small><b>中塞联合研究平台</b></div><div className="wb-top-status"><div><small>数据库版本</small><b>{data?.version || '载入中'}</b></div><div><small>绘图规范</small><b>master-v2-individual</b></div></div></header>
      <div className={`wb-content ${page === 'home' ? 'portal-content-home' : ''}`}>
        {error && <p className="portal-data-error">{error}。数据库主页面仍可单独重试。</p>}
        {page === 'home' && <HomePage data={data} go={go}/>}
        {page === 'intake' && <IntakePage data={data} copied={copied} copyTask={copyTask}/>}
        {page === 'literature' && <LiteraturePage data={data} priorities={priorities}/>}
        {page === 'database' && <ScientificExplorer publicMode/>}
      </div>
    </main>
  </div>;
}
