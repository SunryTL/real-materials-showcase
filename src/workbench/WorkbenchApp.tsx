import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  FileSearch,
  FileText,
  FolderSearch,
  LayoutDashboard,
  LibraryBig,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Microscope,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { api, CandidatePackage, Dashboard, DatabaseHealth, DocumentRecord, User } from "./api";

type Page = "dashboard" | "inbox" | "review" | "database" | "literature";

const PAGE_META: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: "科研工作台", subtitle: "论文、候选数据和数据库状态的统一入口" },
  inbox: { title: "文献处理", subtitle: "PDF查重、DOI确认与AI蒸馏任务" },
  review: { title: "七表审核", subtitle: "逐字段核对样品、光谱、结构、工艺与来源证据" },
  database: { title: "数据库状态", subtitle: "材料家族、描述符覆盖和模型准备度" },
  literature: { title: "下一批文献", subtitle: "依据家族缺口排列的DOI任务清单" },
};

const STATUS_LABEL: Record<string, string> = {
  metadata_needs_review: "待确认DOI",
  ready_for_extraction: "可以蒸馏",
  extracting: "AI蒸馏中",
  candidate_ready: "候选包待审核",
  failed: "需要处理",
};

const TABLE_LABELS: Record<string, string> = {
  sample_master: "样品表",
  site_occupancy: "位点占据",
  optical_measurement: "光谱测量",
  ceramic_process: "陶瓷工艺",
  crystal_structure: "晶体结构",
  physical_descriptors: "物理描述符",
  data_source: "来源关联",
};

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState("sunry");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(await api.login(username, password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wb-login">
      <section className="wb-login-story">
        <div className="wb-brand-lockup"><span>R</span><div><b>REAL</b><small>RESEARCH WORKBENCH</small></div></div>
        <p className="wb-overline">LOCAL · TRACEABLE · HUMAN-REVIEWED</p>
        <h1>把一篇论文，变成<br /><em>可以审查的数据证据。</em></h1>
        <div className="wb-login-flow">
          {["PDF登记", "AI蒸馏", "七表审核", "候选版本"].map((item, index) => <div key={item}><span>0{index + 1}</span><b>{item}</b>{index < 3 && <ArrowRight size={15} />}</div>)}
        </div>
        <p>原始PDF、API密钥和权威Excel只保存在本机。网页输出始终是候选数据，不会覆盖权威数据库。</p>
      </section>
      <form className="wb-login-card" onSubmit={submit}>
        <div className="wb-login-icon"><LockKeyhole size={24} /></div>
        <p className="wb-overline">PRIVATE ACCESS</p>
        <h2>进入课题组工作台</h2>
        <label>账号<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
        <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
        {error && <p className="wb-form-error"><CircleAlert size={15} />{error}</p>}
        <button className="wb-button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}安全登录</button>
        <small>本机／Tailscale私有网络 · 会话7天后自动失效</small>
      </form>
    </main>
  );
}

function Metric({ value, label, note, accent = "blue" }: { value: string | number; label: string; note: string; accent?: string }) {
  return <article className={`wb-metric ${accent}`}><strong>{value}</strong><span>{label}</span><small>{note}</small></article>;
}

function Empty({ icon: Icon = FileText, title, text }: { icon?: typeof FileText; title: string; text: string }) {
  return <div className="wb-empty"><Icon size={24} /><b>{title}</b><p>{text}</p></div>;
}

function DashboardPage({ data, go }: { data: Dashboard; go: (page: Page) => void }) {
  const d = data.documents;
  const stages = [
    { label: "本地PDF", value: d.locations, note: `${d.duplicate_groups}组重复`, icon: FileText },
    { label: "唯一文献", value: d.unique_pdf, note: "按SHA-256识别", icon: FileCheck2 },
    { label: "可以蒸馏", value: d.ready_for_extraction, note: "DOI已经确认", icon: Bot },
    { label: "候选包", value: d.candidate_ready, note: "等待人工审核", icon: ListChecks },
  ];
  return <>
    <section className="wb-stage-rail">
      <div className="wb-section-head"><div><p className="wb-overline">LIVE PIPELINE</p><h2>论文进入数据库的当前进度</h2></div><button onClick={() => go("inbox")} className="wb-link">处理文献<ArrowRight size={15} /></button></div>
      <div className="wb-stage-grid">{stages.map(({ label, value, note, icon: Icon }, index) => <article key={label}><div><Icon size={19} /><span>0{index + 1}</span></div><strong>{value}</strong><b>{label}</b><small>{note}</small>{index < stages.length - 1 && <ChevronRight className="stage-arrow" size={18} />}</article>)}</div>
    </section>
    <section className="wb-metric-grid">
      <Metric value={data.database.metrics.totalSamples} label="总样品记录" note="本地权威库口径" />
      <Metric value={data.database.metrics.coreSamples} label="核心样品" note="Ce³⁺石榴石陶瓷" accent="teal" />
      <Metric value={data.database.metrics.physicsPairs} label="严格PL/PLE对子" note="同一样品严格配对" accent="orange" />
      <Metric value={data.database.metrics.families} label="汇报材料家族" note="当前公开分类口径" accent="purple" />
    </section>
    <div className="wb-two-columns wide-left">
      <section className="wb-panel">
        <div className="wb-panel-head"><div><p className="wb-overline">THIS WEEK</p><h3>本周数据准备进展</h3></div><span className="wb-badge live"><Activity size={13} />已核验汇总</span></div>
        <div className="wb-weekly-strip">
          <div><strong>{data.weekly.external_ce_rt_rows}</strong><span>外部室温Ce³⁺记录</span></div>
          <div><strong>{data.weekly.external_deduplicated_rows}</strong><span>去重后暂存记录</span></div>
          <div><strong>{data.weekly.exact_hosts}</strong><span>精确host化学式</span></div>
          <div><strong>{data.weekly.priority_dois}</strong><span>优先处理DOI</span></div>
        </div>
        <div className="wb-lee-list">{data.weekly.lee_tasks.map((task) => <div key={task.name}><span>{task.name}</span><b>{task.rows}条</b><i style={{ width: `${task.r2 * 100}%` }} /><strong>R² {task.r2.toFixed(3)}</strong></div>)}</div>
        <p className="wb-callout"><Microscope size={16} />Lee三级复现用于验证分层物理任务可学习，当前不作为本项目正式M2结果。</p>
      </section>
      <section className="wb-panel">
        <div className="wb-panel-head"><div><p className="wb-overline">RECENT JOBS</p><h3>最近任务</h3></div><button className="icon-button" onClick={() => go("review")} aria-label="查看七表审核"><ArrowRight size={17} /></button></div>
        {data.jobs.length ? <div className="wb-job-list">{data.jobs.map((job) => <article key={job.id}><div><span className={`status-dot ${job.status}`} /><b>{job.canonical_filename}</b><small>{job.message}</small></div><strong>{job.progress}%</strong></article>)}</div> : <Empty icon={Bot} title="还没有AI蒸馏任务" text="先去文献处理页确认DOI，再逐篇启动Agent。" />}
      </section>
    </div>
    <PublicationFigure
      name="01_weekly_data_preparation"
      overline="WEEKLY DATA AUDIT"
      title="本周数据准备、外部接入与结构证据审计"
      note="所有数值来自已核验统计；外部记录和候选PDF仍与132个陶瓷核心样品分层保存。"
    />
    <PublicationFigure
      name="02_literature_distillation_workflow"
      overline="TRACEABLE PIPELINE"
      title="论文进入七表候选数据库的可追溯流程"
      note="流程节点、七张表和审核边界保持原工作流内容，使用论文式证据拓扑和矩阵重新排版。"
    />
    <section className="wb-authority-note"><ShieldCheck size={20} /><div><b>候选数据先审后入库</b><p>AI负责结构化和检查，负责人确认准入。当前网页不会覆盖权威Excel、冻结快照、STATUS或DECISIONS。</p></div><span>AUTHORITY WRITE · OFF</span></section>
  </>;
}

function InboxPage({ documents, reload }: { documents: DocumentRecord[]; reload: () => Promise<void> }) {
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState<DocumentRecord | null>(null);

  async function upload() {
    if (!files.length) return;
    setBusy(true); setMessage("");
    try { await api.upload(files); setMessage(`已登记${files.length}个文件，系统已完成哈希查重。`); setFiles([]); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "上传失败"); }
    finally { setBusy(false); }
  }
  async function scan() {
    setBusy(true); setMessage("");
    try { const result = await api.scan(); setMessage(`已扫描${result.scanned}个本地PDF。`); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "扫描失败"); }
    finally { setBusy(false); }
  }

  return <>
    <section className="wb-upload-zone">
      <div className="wb-upload-copy"><div className="wb-upload-icon"><UploadCloud size={24} /></div><div><p className="wb-overline">PDF INBOX</p><h2>上传论文或扫描本地未处理文件夹</h2><p>系统先计算SHA-256和识别DOI候选，用户确认后才允许发送给AI。</p></div></div>
      <div className="wb-upload-actions"><label className="wb-button secondary"><UploadCloud size={16} />选择PDF<input type="file" accept="application/pdf" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label><button className="wb-button primary" disabled={!files.length || busy} onClick={upload}>{busy ? <LoaderCircle className="spin" size={16} /> : <FileCheck2 size={16} />}登记{files.length ? ` ${files.length} ` : ""}个文件</button><button className="wb-button ghost" disabled={busy} onClick={scan}><FolderSearch size={16} />扫描本地目录</button></div>
      {message && <p className="wb-inline-message">{message}</p>}
    </section>
    <section className="wb-panel wb-table-panel">
      <div className="wb-panel-head"><div><p className="wb-overline">DOCUMENT REGISTER</p><h3>文献处理清单</h3></div><div className="wb-filter"><Search size={14} /><span>{documents.length}份唯一PDF</span></div></div>
      {documents.length ? <div className="wb-table-scroll"><table className="wb-table"><thead><tr><th>文件</th><th>哈希</th><th>DOI</th><th>目标家族</th><th>状态</th><th>负责人</th><th>下一动作</th></tr></thead><tbody>{documents.map((doc) => <tr key={doc.id} onClick={() => setSelected(doc)} className={selected?.id === doc.id ? "selected" : ""}><td><div className="file-cell"><FileText size={16} /><span><b>{doc.canonical_filename}</b><small>{(doc.size_bytes / 1024 / 1024).toFixed(1)} MB · {doc.location_count}个位置</small></span></div></td><td><code>{doc.sha256_short}</code></td><td>{doc.doi_confirmed || doc.doi_candidates[0] || <span className="muted">未识别</span>}</td><td>{doc.target_family || <span className="muted">待填写</span>}</td><td><span className={`wb-status ${doc.workflow_status}`}>{STATUS_LABEL[doc.workflow_status] || doc.workflow_status}</span></td><td>{doc.owner_name}</td><td><button className="wb-row-action" onClick={(event) => { event.stopPropagation(); setSelected(doc); }}>{doc.workflow_status === "metadata_needs_review" ? "确认元数据" : doc.workflow_status === "ready_for_extraction" ? "启动AI" : "查看详情"}<ChevronRight size={14} /></button></td></tr>)}</tbody></table></div> : <Empty icon={FileSearch} title="收件箱还是空的" text="上传PDF或扫描配置的未处理文件夹。" />}
    </section>
    {selected && <DocumentDrawer document={selected} onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); await reload(); }} onExtract={() => setConfirming(selected)} />}
    {confirming && <ExtractionConfirm document={confirming} onClose={() => setConfirming(null)} onDone={async () => { setConfirming(null); setSelected(null); await reload(); }} />}
  </>;
}

function DocumentDrawer({ document, onClose, onSaved, onExtract }: { document: DocumentRecord; onClose: () => void; onSaved: () => void; onExtract: () => void }) {
  const [doi, setDoi] = useState(document.doi_confirmed || document.doi_candidates[0] || "");
  const [family, setFamily] = useState(document.target_family || "");
  const [fields, setFields] = useState(document.target_fields.length ? document.target_fields : ["composition", "PL"]);
  const [error, setError] = useState("");
  const fieldOptions = ["composition", "PL", "PLE", "process", "lattice", "CIF", "efficiency", "lifetime"];
  async function save() { try { await api.updateDocument(document.id, doi, family, fields); onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); } }
  return <div className="wb-overlay"><aside className="wb-drawer"><header><div><p className="wb-overline">DOCUMENT #{document.id}</p><h2>确认论文元数据</h2></div><button className="icon-button" onClick={onClose}><X size={19} /></button></header><div className="wb-drawer-file"><FileText size={20} /><div><b>{document.canonical_filename}</b><code>SHA-256 {document.sha256}</code></div></div><label>DOI<input value={doi} onChange={(event) => setDoi(event.target.value)} placeholder="10.xxxx/xxxxx" /></label>{document.doi_candidates.length > 0 && <div className="wb-suggestions"><span>自动识别候选</span>{document.doi_candidates.map((candidate) => <button key={candidate} onClick={() => setDoi(candidate)}>{candidate}</button>)}</div>}<label>目标材料家族<input value={family} onChange={(event) => setFamily(event.target.value)} placeholder="例如 Y–Lu固溶" /></label><fieldset><legend>本篇优先提取字段</legend><div className="wb-check-grid">{fieldOptions.map((field) => <label key={field}><input type="checkbox" checked={fields.includes(field)} onChange={() => setFields(fields.includes(field) ? fields.filter((item) => item !== field) : [...fields, field])} />{field}</label>)}</div></fieldset>{error && <p className="wb-form-error"><CircleAlert size={15} />{error}</p>}<div className="wb-drawer-footer"><button className="wb-button ghost" onClick={onClose}>取消</button>{document.workflow_status === "ready_for_extraction" && <button className="wb-button secondary" onClick={onExtract}><Sparkles size={16} />启动AI蒸馏</button>}<button className="wb-button primary" onClick={save}><CheckCircle2 size={16} />确认并保存</button></div></aside></div>;
}

function ExtractionConfirm({ document, onClose, onDone }: { document: DocumentRecord; onClose: () => void; onDone: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() { setBusy(true); try { await api.extract(document.id); onDone(); } catch (reason) { setError(reason instanceof Error ? reason.message : "启动失败"); setBusy(false); } }
  return <div className="wb-overlay"><section className="wb-confirm-dialog"><div className="wb-confirm-icon"><Bot size={25} /></div><p className="wb-overline">PER-PAPER CONSENT</p><h2>确认发送本篇论文给OpenAI</h2><p>AI将读取 <b>{document.canonical_filename}</b>，按照GitHub固定工作流生成七张候选表。模型、提示词版本、文件哈希和Token用量会被记录。</p><ul><li><CheckCircle2 size={15} />只生成候选数据包</li><li><CheckCircle2 size={15} />不会覆盖权威数据库</li><li><CheckCircle2 size={15} />PDF处理后仍只保存在本机</li></ul><label className="wb-consent"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />我确认本篇PDF可以发送至OpenAI API进行科研数据蒸馏</label>{error && <p className="wb-form-error">{error}</p>}<div><button className="wb-button ghost" onClick={onClose}>返回</button><button className="wb-button primary" disabled={!confirmed || busy} onClick={start}>{busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}开始生成七表</button></div></section></div>;
}

function ReviewPage({ jobs }: { jobs: Dashboard["jobs"] }) {
  const candidateJobs = jobs.filter((job) => job.status === "candidate_ready");
  const [selectedJob, setSelectedJob] = useState<number | null>(candidateJobs[0]?.id || null);
  const [candidate, setCandidate] = useState<CandidatePackage | null>(null);
  const [table, setTable] = useState("sample_master");
  const [message, setMessage] = useState("");
  useEffect(() => { if (selectedJob) api.candidatePackage(selectedJob).then(setCandidate).catch((error) => setMessage(error.message)); }, [selectedJob]);
  const rows = candidate?.tables[table] || [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  function updateCell(rowIndex: number, column: string, value: string) { if (!candidate) return; const next = structuredClone(candidate); next.tables[table][rowIndex][column] = value; setCandidate(next); }
  async function save() { if (!selectedJob || !candidate) return; await api.saveTable(selectedJob, table, candidate.tables[table]); setMessage(`${TABLE_LABELS[table]}已保存到本地候选包。`); }
  return <div className="wb-review-layout"><aside className="wb-review-queue"><div className="wb-panel-head"><div><p className="wb-overline">CANDIDATE QUEUE</p><h3>待审核候选包</h3></div><span>{candidateJobs.length}</span></div>{candidateJobs.length ? candidateJobs.map((job) => <button className={selectedJob === job.id ? "active" : ""} key={job.id} onClick={() => setSelectedJob(job.id)}><FileCheck2 size={17} /><span><b>{job.canonical_filename}</b><small>{job.message}</small></span><ChevronRight size={15} /></button>) : <Empty icon={ListChecks} title="暂无候选包" text="完成一次AI蒸馏后会在这里出现。" />}</aside><section className="wb-panel wb-review-main">{candidate ? <><div className="wb-panel-head"><div><p className="wb-overline">SEVEN-TABLE REVIEW</p><h3>{String(candidate.metadata.doi)}</h3></div><div className="wb-review-actions"><span className="wb-badge warning">AI候选 · 待人工审核</span><button className="wb-button primary compact" onClick={save}><CheckCircle2 size={15} />保存本表</button></div></div><nav className="wb-table-tabs">{Object.keys(candidate.tables).map((name) => <button key={name} className={table === name ? "active" : ""} onClick={() => setTable(name)}>{TABLE_LABELS[name]}<span>{candidate.tables[name].length}</span></button>)}</nav>{message && <p className="wb-inline-message">{message}</p>}<div className="wb-table-scroll review"><table className="wb-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{columns.map((column) => <td key={column}><input value={row[column] || ""} onChange={(event) => updateCell(rowIndex, column, event.target.value)} /></td>)}</tr>)}</tbody></table>{!rows.length && <Empty icon={FileSearch} title="该表当前没有记录" text="AI没有找到可靠值时保持空白；可以人工补充并登记证据。" />}</div><div className="wb-review-footer"><p><ShieldCheck size={16} />网页审核只修改候选包，不会覆盖权威数据库。</p><div><button className="wb-button ghost" onClick={() => selectedJob && api.review(selectedJob, "pending", "仍需补证据")}>标记待补证据</button><button className="wb-button secondary" onClick={() => selectedJob && api.review(selectedJob, "auxiliary", "保存为辅助数据建议")}>建议辅助层</button><button className="wb-button primary" onClick={() => selectedJob && api.review(selectedJob, "core_candidate", "提交核心候选建议")}>提交核心候选建议</button></div></div></> : <Empty icon={BookOpenCheck} title="选择一个候选包" text="七张表和证据将在这里逐项展开。" />}</section></div>;
}

const FIGURE_BASE = `${import.meta.env.BASE_URL}workbench/figures`;

function PublicationFigure({ name, overline, title, note }: { name: string; overline: string; title: string; note: string }) {
  return <section className="wb-panel wb-publication-figure">
    <div className="wb-panel-head">
      <div><p className="wb-overline">{overline}</p><h3>{title}</h3></div>
      <div className="figure-downloads">
        <a href={`${FIGURE_BASE}/${name}.png`} download>下载高清PNG</a>
      </div>
    </div>
    <img src={`${FIGURE_BASE}/${name}.png`} alt={title} />
    <p className="wb-figure-note"><Microscope size={16} />{note}</p>
  </section>;
}

function DatabasePage({ health }: { health: DatabaseHealth }) {
  return <><section className="wb-metric-grid"><Metric value={health.metrics.coreSamples} label="核心样品" note="当前正式口径" /><Metric value={health.metrics.coreDoi} label="独立核心DOI" note="来源可以追溯" accent="teal" /><Metric value={health.metrics.m0Ready} label="M0资格样品" note="组成＋室温PL完整" accent="orange" /><Metric value={health.candidate_packages} label="本地候选包" note="尚未进入正式库" accent="purple" /></section><PublicationFigure name="03_database_landscape" overline="DATABASE QUALITY" title="数据库质量、家族覆盖与独立证据" note="四个面板直接读取冻结快照：发射标签分布、19类家族区间、样品数与独立DOI、结构和光谱字段缺失。" /><PublicationFigure name="08_emission_landscape" overline="EMISSION LANDSCAPE" title="不同石榴石家族的实测发射分布" note="曲线和散点来自132个核心样品；不同家族形成不同发射中心，同一家族内部仍有组成和陶瓷条件造成的离散。" /><PublicationFigure name="07_evidence_topology" overline="EVIDENCE TOPOLOGY" title="字段证据如何连接分层模型" note="连线宽度表示可用样品数量；矩阵方块大小表示成对样本量，颜色表示Spearman相关方向，不表示因果关系。" /><PublicationFigure name="04_m0_diagnostics" overline="MODEL DIAGNOSTICS" title="M0严格DOI分组评价" note="图中保留五模型MAE、RMSE、MSE、R²、实测—预测、残差和五轮稳定性；当前最佳Extra Trees的MAE为17.01 nm。" /><section className="wb-panel wb-readiness"><div className="wb-panel-head"><div><p className="wb-overline">MODEL READINESS</p><h3>M0与M1训练准备度</h3></div><span className="wb-badge live">数据版本 {health.version}</span></div>{health.model_readiness.map((model) => <div key={model.model}><div><b>{model.model}</b><span>{model.status}</span></div><div className="wb-progress"><i style={{ width: `${model.ready / model.total * 100}%` }} /></div><strong>{model.ready}/{model.total}</strong></div>)}<p>当前M0基线已经具备启动条件；M1优先扩展host结构代理和独立论文证据。所有图表均绑定审计版本与日期。</p></section></>;
}

function LiteraturePage({ items, rule }: { items: { doi: string; route: string; priority: string }[]; rule: string }) {
  return <><section className="wb-priority-hero"><div><p className="wb-overline">NEXT LITERATURE BATCH</p><h2>下一批文献按材料家族缺口排序</h2><p>{rule}</p></div><div><strong>{items.length}</strong><span>篇优先DOI</span><small>取得原文后进入同一七表流程</small></div></section><section className="wb-panel wb-priority-list"><div className="wb-panel-head"><div><p className="wb-overline">DOI QUEUE</p><h3>可直接复制的处理清单</h3></div><span className="wb-badge warning">候选 · 需原文核验</span></div>{items.map((item, index) => <article key={item.doi}><span>0{index + 1}</span><div><b>{item.route}</b><a href={`https://doi.org/${item.doi}`} target="_blank" rel="noreferrer">{item.doi}</a></div><i>{item.priority}优先级</i><button className="icon-button" onClick={() => navigator.clipboard.writeText(item.doi)} aria-label="复制DOI"><FileCheck2 size={15} /></button></article>)}</section><section className="wb-authority-note"><LibraryBig size={20} /><div><b>人工检索只处理高价值缺口</b><p>优先新增主流家族、独立DOI、连续系列和明确室温PL标签；候选论文通过原文核验后才计入数据库。</p></div></section></>;
}

export default function WorkbenchApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>((window.location.hash.slice(1) as Page) || "dashboard");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [priorities, setPriorities] = useState<{ items: { doi: string; route: string; priority: string }[]; rule: string }>({ items: [], rule: "" });
  const [apiReady, setApiReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const loadAll = useCallback(async () => {
    const [dash, docs, db, priority, server] = await Promise.all([api.dashboard(), api.documents(), api.databaseHealth(), api.priorities(), api.health()]);
    setDashboard(dash); setDocuments(docs.items); setHealth(db); setPriorities(priority); setApiReady(server.openai_configured);
  }, []);

  useEffect(() => { api.me().then(async (next) => { setUser(next); await loadAll(); }).catch(() => setUser(null)).finally(() => setLoading(false)); }, [loadAll]);
  useEffect(() => { window.location.hash = page; }, [page]);
  const meta = PAGE_META[page];
  const nav = useMemo(() => [
    { id: "dashboard" as Page, label: "工作台", icon: LayoutDashboard },
    { id: "inbox" as Page, label: "文献处理", icon: FileSearch },
    { id: "review" as Page, label: "七表审核", icon: ListChecks },
    { id: "database" as Page, label: "数据库状态", icon: BarChart3 },
    { id: "literature" as Page, label: "下一批文献", icon: LibraryBig },
  ], []);

  if (loading) return <div className="wb-loading"><LoaderCircle className="spin" /><span>正在连接本地REAL工作台</span></div>;
  if (!user) return <Login onLogin={async (next) => { setUser(next); await loadAll(); }} />;

  return <div className="wb-shell"><aside className={`wb-sidebar ${mobileNav ? "open" : ""}`}><div className="wb-sidebar-brand"><span>R</span><div><b>REAL</b><small>RESEARCH WORKBENCH</small></div></div><nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? "active" : ""} onClick={() => { setPage(id); setMobileNav(false); }}><Icon size={18} /><span>{label}</span>{page === id && <i />}</button>)}</nav><div className="wb-sidebar-system"><p>本地科研环境</p><div><span className="status-dot candidate_ready" /><b>数据库只读</b></div><div><span className={`status-dot ${apiReady ? "candidate_ready" : "failed"}`} /><b>OpenAI {apiReady ? "已配置" : "待配置"}</b></div><small>通过Tailscale可供课题组成员访问</small></div><button className="wb-user" onClick={async () => { await api.logout(); setUser(null); }}><span>{user.display_name.slice(0, 1)}</span><div><b>{user.display_name}</b><small>{user.role === "owner" ? "负责人" : "贡献者"}</small></div><LogOut size={16} /></button></aside><main className="wb-main"><header className="wb-topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button><div><p className="wb-overline">REAL / {page.toUpperCase()}</p><h1>{meta.title}</h1><span>{meta.subtitle}</span></div><div className="wb-top-status"><div><small>数据库版本</small><b>{health?.version || "载入中"}</b></div><div><small>审计日期</small><b>{health?.audited_on || "—"}</b></div><button className="icon-button" onClick={loadAll} aria-label="刷新"><RefreshCw size={17} /></button></div></header><div className="wb-content">{dashboard && page === "dashboard" && <DashboardPage data={dashboard} go={setPage} />}{page === "inbox" && <InboxPage documents={documents} reload={loadAll} />}{dashboard && page === "review" && <ReviewPage jobs={dashboard.jobs} />}{health && page === "database" && <DatabasePage health={health} />}{page === "literature" && <LiteraturePage items={priorities.items} rule={priorities.rule} />}</div></main></div>;
}
