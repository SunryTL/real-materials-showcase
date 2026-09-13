import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { ScientificCanvas } from './ScientificCanvas';
import { exportRecords, fetchExplorer, type ExplorerData, type ExplorerScope } from './explorer-data';
import './scientific-explorer.css';
const ScientificPointCloud = lazy(() => import('./ScientificPointCloud').then(module => ({ default: module.ScientificPointCloud })));

type View = 'content' | 'quality' | 'evidence';
const statusNames: Record<string, string> = { formal: '正式快照', candidate: '候选预览', all: '混合预览（非正式统计）' };
export function ScientificExplorer({ owner = false, publicMode = false }: { owner?: boolean; publicMode?: boolean }) {
  const [scope, setScope] = useState<ExplorerScope>({ version: 'latest', family: '', material_form: '', status: 'formal' });
  const [view, setView] = useState<View>('content');
  const [data, setData] = useState<ExplorerData | null>(null);
  const [options, setOptions] = useState<ExplorerData['options']>({ families: [], material_forms: [], versions: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [jobIds, setJobIds] = useState<number[]>([]), [confirmPublish, setConfirmPublish] = useState(false), [publishing, setPublishing] = useState(false), [publishMessage, setPublishMessage] = useState('');
  const onSelect = useCallback((id: string) => setSelected(id), []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    fetchExplorer(scope, controller.signal, publicMode).then(next => { if (!active) return; setData(next); setOptions(next.options); setLoading(false); }).catch(reason => { if (!active || controller.signal.aborted) return; setError(reason instanceof Error ? reason.message : '数据载入失败'); setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [scope, revision, publicMode]);
  function changeScope(key: keyof ExplorerScope, value: string) { setLoading(true); setError(''); setData(null); setSelected(null); setJobIds([]); setConfirmPublish(false); setScope(current => ({ ...current, [key]: value })); }
  function retry() { setLoading(true); setError(''); setData(null); setRevision(n => n + 1); }
  async function publish() {
    setPublishing(true); setPublishMessage('');
    try { const response = await fetch('/api/v1/database/publish', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_ids: jobIds, confirm: true }) }); const body = await response.json(); if (!response.ok) throw new Error(body.detail || '发布失败'); setPublishMessage(`新快照已生成：${body.version}。已切换到最新正式版本。`); setConfirmPublish(false); setJobIds([]); setSelected(null); setData(null); setLoading(true); setScope({ version: 'latest', family: '', material_form: '', status: 'formal' }); setRevision(n => n + 1); }
    catch (reason) { setPublishMessage(reason instanceof Error ? reason.message : '发布失败，请检查候选包的校验和审核结果'); }
    finally { setPublishing(false); }
  }
  const record = data?.records.find(row => row.sample_id === selected);
  return <section className="science-explorer" aria-busy={loading} aria-label="交互科研数据探索">
    <header className="science-intro"><div><h2>从样品到证据</h2><p>探索真实分布，检查数据缺口，辨认模型能够得到的支持。</p></div><button className="science-action" onClick={retry} disabled={loading}><RefreshCw size={15} />重新读取数据</button></header>
    <div className="science-filters">
      <label>材料家族<select aria-label="材料家族" value={scope.family} onChange={e => changeScope('family', e.target.value)}><option value="">全部家族</option>{options.families.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
      <label>材料形态<select value={scope.material_form} onChange={e => changeScope('material_form', e.target.value)}><option value="">全部形态</option>{options.material_forms.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
      {!publicMode && <label>数据范围<select value={scope.status} onChange={e => changeScope('status', e.target.value)}>{Object.entries(statusNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}
      <label className="science-version-select">数据库版本<select value={scope.version} onChange={e => changeScope('version', e.target.value)}><option value="latest">最新版本</option>{options.versions.filter(v => v !== 'latest').map(v => <option key={v} value={v}>{v}</option>)}</select></label>
      <button className="science-action" disabled={!data || loading} onClick={() => data && exportRecords(data)}><Download size={15} />导出当前样品 CSV</button>
    </div>
    <div className="science-scope" role="status">{loading ? '正在读取当前筛选范围…' : data ? <><strong>{statusNames[data.scope.status] || data.scope.status}</strong><span>{data.summary.samples} 个样品 · {data.summary.doi} 个 DOI · {data.summary.families} 个家族</span><span className="science-version">{data.version}</span></> : '数据未载入'}</div>
    {scope.status !== 'formal' && <p className="science-candidate-note">{scope.status === 'all' ? <>混合预览统计，不是正式统计。图中合并展示正式与候选记录，不能作为正式数据库结论。{data?.status_counts && <> 当前正式 {data.status_counts.formal} 条、候选 {data.status_counts.candidate} 条。</>}</> : '候选预览不是正式入库。只有负责人核验后才能发布新快照。'}</p>}
    {owner && scope.status !== 'formal' && data && <section className="science-publish">
      <h3>将已审核候选整包发布为新快照</h3>
      {data.candidate_jobs?.length ? <>
        <p>发布单位是完整候选包，不是当前筛选命中的样品。整包发布包含筛选外记录。后端将再次检查完整校验、最新审核结论及表格哈希；不符合条件会拒绝发布。</p>
        <div>{data.candidate_jobs.map(job => <label key={job.job_id}><input type="checkbox" checked={jobIds.includes(job.job_id)} disabled={publishing} onChange={e => { setConfirmPublish(false); setJobIds(ids => e.target.checked ? [...ids, job.job_id] : ids.filter(id => id !== job.job_id)); }} />候选包 #{job.job_id} · 整包 {job.samples} 个样品 · 当前筛选命中 {job.matched_samples ?? '未提供'} 个</label>)}</div>
        {confirmPublish ? <div className="science-publish-confirm">
          <p>确认将选中的 {jobIds.length} 个候选包整包发布为新的正式快照？整包共 {data.candidate_jobs.filter(job => jobIds.includes(job.job_id)).reduce((sum, job) => sum + job.samples, 0)} 个样品，包含当前筛选范围以外的记录。此操作不会覆盖原始权威 Excel。</p>
          <button className="science-action" disabled={publishing} onClick={publish}>{publishing ? '正在验证并发布…' : '确认发布新快照'}</button><button className="science-action" disabled={publishing} onClick={() => setConfirmPublish(false)}>取消</button>
        </div> : <button className="science-action" disabled={!jobIds.length} onClick={() => { setPublishMessage(''); setConfirmPublish(true); }}>审核后发布新快照</button>}
      </> : <p>当前范围没有可选择的候选包。</p>}
    </section>}
    {publishMessage && <p role="status" className="science-candidate-note">{publishMessage}</p>}
    <div className="science-tabs" role="tablist" aria-label="科研问题">{([['content', '数据里有什么'], ['quality', '数据质量如何'], ['evidence', '数据能支持什么']] as const).map(([key, title]) => <button key={key} id={`science-tab-${key}`} role="tab" aria-selected={view === key} aria-controls="science-panel" onClick={() => setView(key)}>{title}</button>)}</div>
    {error && <div className="science-state" role="alert"><h3>科研数据暂时不可用</h3><p>{error}</p><button className="science-action" onClick={retry}>重试加载</button></div>}
    {loading && <div className="science-state" role="status"><div className="science-loading-line" /><p>正在取得版本化样品与预计算统计，不使用模拟数据填充。</p></div>}
    {!loading && data && <div id="science-panel" role="tabpanel" aria-labelledby={`science-tab-${view}`}>
      {!data.records.length ? <div className="science-state"><h3>当前范围没有样品</h3><p>请更换家族、材料形态或数据范围。</p></div> : <>
        {view === 'content' && <>
          <ScientificCanvas kind="emission" title="发射波长分布" description={`按家族查看发射范围与真实观测值 · 当前图 ${data.charts.emission.groups.reduce((sum, group) => sum + group.n, 0)} 条有效记录`} data={data} selected={selected} onSelect={onSelect} />
          <div className="science-legend">{data.charts.emission.groups.map(group => <span key={group.name}><i style={{ backgroundColor: group.color }} />{group.name}<small>n={group.n} · 中位数 {group.median == null ? '—' : Number(group.median.toFixed(1))} nm</small></span>)}</div>
          <Suspense fallback={<p className="science-state">正在载入三维绘图模块…</p>}><ScientificPointCloud data={data} selected={selected} onSelect={onSelect} /></Suspense>
          <div className="science-legend">{Object.entries(data.family_colors).map(([family, color]) => <span key={family}><i style={{ backgroundColor: color }} />{family}</span>)}</div>
          <ScientificCanvas kind="relationship" title="字段关系与边缘分布" description={`${data.charts.relationship.x_label} × ${data.charts.relationship.y_label} · ${data.charts.relationship.points.length} 对有效观测；半透明小点保持真实坐标`} data={data} selected={selected} onSelect={onSelect} />
        </>}
        {view === 'quality' && <>
          <ScientificCanvas kind="quality" title="字段完整度矩阵" description="从样品行追溯字段是否存在；点击矩阵定位记录。" data={data} selected={selected} onSelect={onSelect} />
          <div className="science-coverage"><h3>各字段覆盖</h3><div>{data.charts.quality.coverage.map(field => <p key={field.field}><span>{field.field}</span><b>{field.count} / {field.total}</b></p>)}</div><p className="science-note">来源类型：{data.charts.quality.sources.map(s => `${s.source} ${s.count}`).join(' · ') || '当前响应未提供来源统计'}</p></div>
          <ScientificCanvas kind="correlation" title="描述符相关性" description="颜色表示 Spearman 相关方向与强度，方块面积表示有效配对数。悬停查看具体数值。" data={data} selected={selected} onSelect={onSelect} />
        </>}
        {view === 'evidence' && <>
          <ScientificCanvas kind="evidence" title="独立证据分布" description="分别计数样品、DOI 和连续系列；同一论文中的近重复记录不等于独立证据。" data={data} selected={selected} onSelect={onSelect} />
          <ScientificCanvas kind="readiness" title="分层模型字段资格" description="只报告当前版本的字段资格，不把字段齐全解释为模型已验证。" data={data} selected={selected} onSelect={onSelect} />
          <details className="science-method"><summary>按论文查看样品数量</summary><div className="science-paper-list">{data.charts.evidence.papers.map(p => <p key={p.doi}><a href={`https://doi.org/${encodeURI(p.doi)}`} target="_blank" rel="noreferrer">{p.doi || '未确认 DOI'}</a><span>{p.samples} 个样品</span></p>)}</div></details>
        </>}
        <details className="science-records" open={!!selected}><summary>当前范围样品表 · {data.records.length} 条（也可用键盘选择样品）</summary><div className="science-table-scroll"><table><thead><tr><th>样品</th><th>材料家族</th><th>组成</th><th>PL / nm</th><th>状态</th></tr></thead><tbody>{data.records.map(row => <tr key={row.sample_id} className={selected === row.sample_id ? 'is-selected' : ''}><td><button onClick={() => onSelect(row.sample_id)} aria-label={`查看样品 ${row.sample_id}`}>{row.sample_id}</button></td><td>{row.family}</td><td>{row.formula}</td><td>{row.emission_nm ?? '缺失'}</td><td>{statusNames[row.status] || row.status}</td></tr>)}</tbody></table></div></details>
        <p className="science-provenance">统计与坐标来自当前{publicMode ? 'GitHub正式脱敏快照' : '后端版本'} · {data.version}{data.source_hash && <> · 源哈希 {data.source_hash.slice(0, 16)}</>}。各图仅使用该图所需字段有效的记录，样品数可能不同。</p>
      </>}
    </div>}
    {record && <aside className="science-record-drawer" aria-label="样品证据详情"><header><h3>{record.sample_id}</h3><button className="science-action" aria-label="关闭样品详情" onClick={() => setSelected(null)}><X size={18} /></button></header><dl><div><dt>组成</dt><dd>{record.formula || '未提供'}</dd></div><div><dt>材料家族 / 形态</dt><dd>{record.family} / {record.material_form || '未提供'}</dd></div><div><dt>发射峰</dt><dd>{record.emission_nm === null ? '缺失' : `${record.emission_nm} nm`}</dd></div><div><dt>字段覆盖</dt><dd>{record.available_fields} / {record.total_fields}</dd></div><div><dt>证据状态</dt><dd>{statusNames[record.status] || record.status}</dd></div><div><dt>DOI</dt><dd>{record.doi ? <a href={`https://doi.org/${encodeURI(record.doi)}`} target="_blank" rel="noreferrer">{record.doi}</a> : '尚未确认'}</dd></div><div><dt>数据库版本</dt><dd>{data?.version}</dd></div></dl><p>样品记录是文献证据，不是模型预测。</p></aside>}
  </section>;
}
