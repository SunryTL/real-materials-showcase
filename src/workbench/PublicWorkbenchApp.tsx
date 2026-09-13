import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpenCheck, Copy, ExternalLink, FileSearch, LayoutDashboard, Menu } from 'lucide-react';
import { ScientificExplorer } from './ScientificExplorer';

type Page = 'dashboard' | 'inbox' | 'database';
const TASK = `请读取 real-materials-research 根 README.md、STATUS.md、DECISIONS.md、research/README.md 和 WORKFLOW.md。处理我上传的论文：核对 DOI、题目、版本与 SHA-256，按七表 Schema 生成候选数据和逐字段证据；检查 PL/PLE、单位、样品重复与分组。不要覆盖权威 Excel 或正式快照，完成后给出核心／辅助／排除／待补证据建议，等待我确认。`;

export default function PublicWorkbenchApp() {
  const initial = window.location.hash.replace('#', '') as Page;
  const [page, setPage] = useState<Page>(['dashboard', 'inbox', 'database'].includes(initial) ? initial : 'dashboard');
  const [mobile, setMobile] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { window.location.hash = page; }, [page]);
  const nav = useMemo(() => [
    { id: 'dashboard' as Page, label: '工作台', icon: LayoutDashboard },
    { id: 'inbox' as Page, label: '文献处理', icon: FileSearch },
    { id: 'database' as Page, label: '数据库状态', icon: BarChart3 },
  ], []);
  const meta = {
    dashboard: ['科研工作台', 'Codex整理、GitHub同步与REAL展示的公开入口'],
    inbox: ['文献处理', '原文留在本地，通过Codex按固定七表工作流整理'],
    database: ['数据库状态', '当前正式脱敏快照的交互科研图'],
  }[page];
  return <div className="wb-shell wb-public-shell">
    <aside className={`wb-sidebar ${mobile ? 'open' : ''}`}>
      <div className="wb-sidebar-brand"><span>R</span><div><b>REAL</b><small>RESEARCH WORKBENCH</small></div></div>
      <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setMobile(false); }}><Icon size={18}/><span>{label}</span>{page === id && <i/>}</button>)}</nav>
      <div className="wb-sidebar-system"><p>GitHub Pages</p><div><span className="status-dot candidate_ready"/><b>公开只读</b></div><div><span className="status-dot candidate_ready"/><b>正式脱敏快照</b></div><small>PDF、权威Excel与API Key不进入公开构建</small></div>
      <a className="wb-user" href="https://github.com/SunryTL/real-materials-research" target="_blank" rel="noreferrer"><span><BookOpenCheck size={16}/></span><div><b>科研主库</b><small>规则与证据索引</small></div><ExternalLink size={16}/></a>
    </aside>
    <main className="wb-main"><header className="wb-topbar"><button className="icon-button mobile-menu" onClick={() => setMobile(!mobile)}><Menu size={20}/></button><div><p className="wb-overline">REAL / PUBLIC READ-ONLY</p><h1>{meta[0]}</h1><span>{meta[1]}</span></div><div className="wb-top-status"><div><small>数据权限</small><b>审核后公开</b></div><div><small>绘图规范</small><b>master-v2</b></div></div></header>
      <div className="wb-content">
        {page === 'dashboard' && <section className="wb-public-home"><p className="wb-overline">AUDITED RESEARCH DATA</p><h2>文献在 Codex 中整理，正式版本在 GitHub 中追溯，科研图在 REAL 中交互。</h2><div className="wb-public-flow">{['本地PDF', 'Codex七表候选', '负责人审核', 'GitHub脱敏快照', 'REAL科研图'].map((item, i) => <div key={item}><small>0{i + 1}</small><b>{item}</b></div>)}</div><button className="wb-button primary" onClick={() => setPage('database')}>查看数据库状态</button></section>}
        {page === 'inbox' && <section className="wb-panel wb-codex-handoff"><p className="wb-overline">CODEX HANDOFF</p><h2>交给 Codex 整理</h2><p>公开网页不上传论文，也不调用网页API。请在本项目的 Codex 科研任务中上传PDF或指定本地文件；Codex会按科研主库规则形成候选包，只有你确认后才发布。</p><ol><li>在 Codex 中上传PDF或提供本地路径</li><li>粘贴下方固定任务模板</li><li>审核七表候选与逐字段证据</li><li>确认后由 Codex 更新脱敏快照、PR与REAL图表</li></ol><pre>{TASK}</pre><button className="wb-button primary" onClick={async () => { await navigator.clipboard.writeText(TASK); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}><Copy size={16}/>{copied ? '已复制' : '复制固定任务模板'}</button></section>}
        {page === 'database' && <ScientificExplorer publicMode />}
      </div>
    </main>
  </div>;
}
