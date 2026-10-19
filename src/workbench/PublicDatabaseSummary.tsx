import { useEffect, useState } from 'react';
import './scientific-explorer.css';

type Summary = {
  version: string;
  options: { families: string[]; material_forms: string[] };
  summary: { samples: number; doi: number; families: number };
  aggregates: {
    family_counts: { family: string; count: number }[];
    emission_histogram: { lower_nm: number; upper_nm: number; count: number }[];
    field_coverage: { available: number; possible: number };
  };
};

export function PublicDatabaseSummary() {
  const [family, setFamily] = useState('');
  const [form, setForm] = useState('');
  const [data, setData] = useState<Summary | null>(null);
  const [options, setOptions] = useState<Summary['options']>({ families: [], material_forms: [] });
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function read(url: string) {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`公开汇总读取失败（${response.status}），请重试。`);
      return response.json();
    }
    async function load() {
      const root = `${import.meta.env.BASE_URL}workbench/public-data/`;
      const latest = await read(`${root}latest.json`);
      const manifest = await read(`${root}${latest.release}`);
      const scope = manifest.scopes[`formal|${family}|${form}`];
      if (!scope) throw new Error('这个家族与材料形态的组合没有公开汇总，请更换筛选条件。');
      const next = await read(`${root}${latest.release.replace(/manifest\.json$/, '')}${scope}`);
      if (!next.aggregates || 'records' in next || 'points' in next) throw new Error('数据格式不是汇总版，请联系维护者更新发布包。');
      if (!controller.signal.aborted) { setData(next); setOptions(next.options); }
    }
    load().catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [family, form, revision]);
  function reset() { setData(null); setError(''); }
  const bins = data?.aggregates.emission_histogram ?? [];
  const max = Math.max(1, ...bins.map(bin => bin.count));
  const lower = bins.length ? Math.min(...bins.map(bin => bin.lower_nm)) : 0;
  const span = bins.length ? Math.max(...bins.map(bin => bin.upper_nm)) - lower : 10;
  return <section className="science-explorer" aria-label="公开数据库汇总">
    <header className="science-intro"><div><h2>数据库覆盖与分布</h2><p>公开页展示汇总；样品证据、逐条误差和审核编辑在本地工作台使用。</p></div></header>
    <div className="science-filters">
      <label>材料家族<select aria-label="材料家族" value={family} onChange={e => { reset(); setFamily(e.target.value); }}><option value="">全部家族</option>{options.families.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>材料形态<select aria-label="材料形态" value={form} onChange={e => { reset(); setForm(e.target.value); }}><option value="">全部形态</option>{options.material_forms.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    {error ? <div className="science-state" role="alert"><p>{error}</p><button onClick={() => { reset(); setRevision(value => value + 1); }}>重新读取</button></div> : !data ? <p role="status">正在读取汇总统计…</p> : <>
      <div className="science-scope" role="status"><span>{data.summary.samples} 个样品 · {data.summary.doi} 个 DOI · {data.summary.families} 个家族</span><span>{data.version}</span></div>
      <h3>发射波长分布</h3><p>每条柱表示一个 10 nm 区间，柱高表示记录数。</p>
      {bins.length ? <div className="science-table-scroll" tabIndex={0} aria-label="发射分布图，可横向滚动"><svg role="img" aria-label="发射波长分布" viewBox="0 0 800 280" style={{ width: '100%', minWidth: 600, maxHeight: 340 }}>
        <line x1="45" y1="230" x2="780" y2="230" stroke="currentColor" />
        {bins.map((bin, index) => {
          const width = 720 * (bin.upper_nm - bin.lower_nm) / span;
          const left = 50 + 720 * (bin.lower_nm - lower) / span;
          const height = 180 * bin.count / max;
          return <g key={bin.lower_nm}><rect x={left} y={230 - height} width={Math.max(1, width - 3)} height={height} fill="#457b8d"><title>{bin.lower_nm}–{bin.upper_nm} nm：{bin.count} 条</title></rect><text x={left + width / 2} y={223 - height} textAnchor="middle" fontSize="13">{bin.count}</text>{(index % Math.max(1, Math.ceil(bins.length / 10)) === 0) && <text x={left + width / 2} y="250" textAnchor="middle" fontSize="13">{bin.lower_nm}</text>}</g>;
        })}<text x="410" y="277" textAnchor="middle" fontSize="14">发射峰区间下限 / nm</text>
      </svg></div> : <p>当前范围没有合格的发射峰统计。</p>}
      <h3>家族覆盖</h3><div className="science-table-scroll"><table><thead><tr><th>材料家族</th><th>记录数</th></tr></thead><tbody>{data.aggregates.family_counts.map(row => <tr key={row.family}><td>{row.family}</td><td>{row.count}</td></tr>)}</tbody></table></div>
      <p className="science-note">已填写字段 {data.aggregates.field_coverage.available} / {data.aggregates.field_coverage.possible}。字段完整度用于描述数据覆盖，不代表测量精度或模型准确率。</p>
    </>}
  </section>;
}
