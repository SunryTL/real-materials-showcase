import { useEffect, useState } from 'react';
import { Copy, Menu, ShieldCheck, UploadCloud, X } from 'lucide-react';
import InstitutionalHome, { UniversityMarks, ResearchFooter } from './InstitutionalHome';
import './institutional.css';
import { ScientificExplorer } from './ScientificExplorer';
import { fetchExplorer, type ExplorerData } from './explorer-data';

type Page = 'home' | 'intake' | 'literature' | 'database';
type Priority = {
  doi: string; title: string; target_routes: string; priority: number;
  status: string; next_action: string;
};

const TASK = `请读取 real-materials-research 根 README.md、STATUS.md、DECISIONS.md、research/README.md 和 research/database/EXTERNAL_DATA_COLLABORATION_PLAN.md。处理我上传的论文：核对 DOI、题目、版本与 SHA-256，按七表 Schema 生成候选数据和逐字段证据；检查 PL/PLE、单位、样品重复与分组。不要覆盖权威 Excel 或正式快照，完成后给出核心／辅助／排除／待补证据建议，等待我确认。`;
const privateWorkbench = import.meta.env.VITE_REAL_PRIVATE_URL || 'http://127.0.0.1:5173/real-materials-showcase/workbench#inbox';


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

type Route = Page | 'cooperation';
function scrollToCooperation() {
  document.getElementById('cooperation')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function readRoute(): Route {
  const raw = window.location.hash.slice(1);
  if (raw === 'dashboard') return 'home';
  if (raw === 'inbox') return 'intake';
  return ['home','cooperation','database','literature','intake'].includes(raw) ? raw as Route : 'home';
}
export default function PublicWorkbenchApp() {
  const [route, setRoute] = useState<Route>(readRoute);
  const page: Page = route === 'cooperation' ? 'home' : route;
  const [mobile, setMobile] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data, priorities, error } = usePortalData();
  useEffect(() => {
    const sync = () => { setRoute(readRoute()); setMobile(false); };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => {
    if (route === 'cooperation') scrollToCooperation();
    else window.scrollTo({ top: 0 });
  }, [route]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobile(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const nav: [Route, string][] = [['home','首页'],['cooperation','合作研究'],['database','数据库'],['literature','文献整理'],['intake','数据录入']];
  const go = (next: Route) => { window.location.assign(`#${next}`); setMobile(false); if (next === route && next === 'cooperation') scrollToCooperation(); };
  const copyTask = async () => { await navigator.clipboard.writeText(TASK); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return <div className="wb-shell real-public-site">
    <a className="real-skip" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>跳到正文</a>
    <header className="real-header"><div className="real-header-inner">
      <UniversityMarks/>
      <button className="real-menu" onClick={() => setMobile(!mobile)} aria-label={mobile ? '关闭导航' : '打开导航'} aria-expanded={mobile} aria-controls="real-navigation">{mobile ? <X/> : <Menu/>}</button>
      <nav id="real-navigation" className={mobile ? 'is-open' : ''} aria-label="主导航"><a className="real-nav-brand" href="#home">REAL</a>{nav.map(([id,label])=><button key={id} aria-current={route === id ? 'page' : undefined} onClick={() => go(id)}>{label}</button>)}</nav>
    </div></header>
    <main id="main-content" className="real-main" tabIndex={-1}>
      {page !== 'home' && <header className="real-tool-heading"><div><h1>{({database:'数据库状态',literature:'文献整理',intake:'数据录入'})[page]}</h1><p>REAL科研平台 · 可追溯的研究证据</p></div><div><span>数据库版本</span><b>{data?.version || '载入中'}</b><span>绘图规范：master-v2-individual</span></div></header>}
      <div className={page === 'home' ? 'real-home-content' : 'wb-content real-tool-content'}>
        {error && <p className="portal-data-error">{error}。数据库主页面仍可单独重试。</p>}
        {page === 'home' && <InstitutionalHome data={data}/>}
        {page === 'intake' && <IntakePage data={data} copied={copied} copyTask={copyTask}/>}
        {page === 'literature' && <LiteraturePage data={data} priorities={priorities}/>}
        {page === 'database' && <ScientificExplorer publicMode/>}
      </div>
    </main>
    <ResearchFooter/>
  </div>;
}
