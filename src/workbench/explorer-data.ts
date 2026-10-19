export type ExplorerRecord = {
  sample_id: string; doi: string; family: string; formula: string; material_form: string;
  emission_nm: number | null; available_fields: number; total_fields: number;
  coverage_fraction: number; status: string;
};
export type ExplorerPoint = ExplorerRecord & {
  plot_family: string; PC1: number; PC2: number; PC3: number; coincident_count: number;
};
export type ExplorerScope = { version: string; family: string; material_form: string; status: string };
export type ExplorerData = {
  source_hash?: string; candidate_jobs?: { job_id: number; samples: number; matched_samples?: number }[];
  status_counts?: { formal: number; candidate: number };
  version: string; scope: Omit<ExplorerScope, 'version'>;
  options: { families: string[]; material_forms: string[]; versions: string[] };
  summary: { samples: number; doi: number; families: number; projected: number };
  points: ExplorerPoint[]; records: ExplorerRecord[]; family_colors: Record<string, string>;
  axes: { key: string; min: number; max: number; explained_variance_ratio: number; top_loadings: { feature: string; weight: number }[] }[];
  charts: {
    emission: { grid: number[]; groups: { name: string; color: string; n: number; median: number; min: number; max: number; density: number[]; points: { sample_id: string; x: number }[] }[]; histogram: { left: number; right: number; count: number }[]; ecdf: { x: number; y: number }[] };
    relationship: { x_label: string; y_label: string; points: { sample_id: string; x: number; y: number; family: string; color: string }[]; x_grid: number[]; y_grid: number[]; groups: { family: string; color: string; density_x: number[]; density_y: number[] }[] };
    quality: { fields: string[]; rows: { sample_id: string; family: string; available: boolean[] }[]; coverage: { field: string; count: number; total: number }[]; sources: { source: string; count: number }[] };
    evidence: { families: { family: string; samples: number; doi: number; series: number }[]; papers: { doi: string; samples: number }[] };
    correlation: { labels: string[]; values: { i: number; j: number; r: number | null; n: number }[] };
    readiness: { model: string; ready: number; total: number }[];
  };
};

type PublicManifest = {
  database_version: string;
  scopes: Record<string, string>;
};

let publicManifestPromise: Promise<{ manifest: PublicManifest; root: string }> | null = null;

async function publicManifest() {
  if (!publicManifestPromise) {
    const root = `${import.meta.env.BASE_URL}workbench/public-data/`;
    publicManifestPromise = fetch(`${root}latest.json`).then(async response => {
      if (!response.ok) throw new Error(`公开数据索引读取失败 (${response.status})`);
      const latest = await response.json();
      const manifestResponse = await fetch(`${root}${latest.release}`);
      if (!manifestResponse.ok) throw new Error(`公开数据清单读取失败 (${manifestResponse.status})`);
      return { manifest: await manifestResponse.json() as PublicManifest, root: `${root}releases/${latest.database_version}/` };
    }).catch(reason => { publicManifestPromise = null; throw reason; });
  }
  return publicManifestPromise;
}

export async function fetchExplorer(scope: ExplorerScope, signal: AbortSignal, publicMode = false): Promise<ExplorerData> {
  let response: Response;
  if (publicMode) {
    const { manifest, root } = await publicManifest();
    const version = scope.version === 'latest' ? manifest.database_version : scope.version;
    if (version !== manifest.database_version || scope.status !== 'formal') throw new Error('公开页面只提供当前正式脱敏快照。');
    const key = `formal|${scope.family}|${scope.material_form}`;
    const relative = manifest.scopes[key];
    if (!relative) throw new Error('当前筛选范围没有已发布的正式数据。');
    response = await fetch(`${root}${relative}`, { signal });
  } else {
    response = await fetch(`/api/v1/explorer?${new URLSearchParams(scope)}`, { credentials: 'include', signal });
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || `数据载入失败 (${response.status})`);
  if (!body.charts || !Array.isArray(body.records)) throw new Error('科研数据响应不完整，请重试或检查后端服务。');
  return body;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename;
  link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportRecords(data: ExplorerData) {
  const keys: (keyof ExplorerRecord)[] = ['sample_id', 'doi', 'family', 'formula', 'material_form', 'emission_nm', 'status', 'available_fields', 'total_fields', 'coverage_fraction'];
  const escape = (value: unknown) => { let text = value == null ? '' : String(value); if (/^[=+@\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  const rows = data.records.map(record => keys.map(key => escape(record[key])).join(','));
  downloadBlob(new Blob(['\uFEFF', keys.join(','), '\r\n', rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `REAL-${data.version}-${data.scope.status}-${data.scope.family || 'all'}-samples.csv`);
}

export const numberLabel = (n: number) => Number.isFinite(n) ? Number(n.toPrecision(3)).toString() : '—';
export const SCIENTIFIC_STYLE_VERSION = 'scientific-canvas-v1';

/** Flatten the precomputed chart payload, never reconstruct its statistics in the browser. */
export function exportChartStatistics(data: ExplorerData, kind: keyof ExplorerData['charts']) {
  type Row = Record<string, string | number | boolean | null>;
  const rows: Row[] = [];
  if (kind === 'emission') {
    const c = data.charts.emission;
    c.groups.forEach(g => { c.grid.forEach((x, i) => rows.push({ type: 'density', family: g.name, x, density: g.density[i] ?? null, n: g.n, median: g.median })); g.points.forEach(p => rows.push({ type: 'observation', family: g.name, sample_id: p.sample_id, x: p.x })); });
    c.histogram.forEach(bin => rows.push({ type: 'histogram', ...bin })); c.ecdf.forEach(p => rows.push({ type: 'ecdf', ...p }));
  } else if (kind === 'relationship') {
    const c = data.charts.relationship; c.points.forEach(p => rows.push({ type: 'pair', ...p, x_label: c.x_label, y_label: c.y_label }));
    c.groups.forEach(g => { c.x_grid.forEach((x, i) => rows.push({ type: 'marginal_x', family: g.family, x, density: g.density_x[i] ?? null })); c.y_grid.forEach((y, i) => rows.push({ type: 'marginal_y', family: g.family, y, density: g.density_y[i] ?? null })); });
  } else if (kind === 'quality') {
    const c = data.charts.quality; c.rows.forEach(row => c.fields.forEach((field, i) => rows.push({ type: 'availability', sample_id: row.sample_id, family: row.family, field, available: row.available[i] ?? false })));
    c.coverage.forEach(r => rows.push({ type: 'coverage', ...r })); c.sources.forEach(r => rows.push({ type: 'source', ...r }));
  } else if (kind === 'correlation') {
    const c = data.charts.correlation; c.values.forEach(v => rows.push({ type: 'pair', ...v, field_i: c.labels[v.i], field_j: c.labels[v.j], supported: v.r !== null && v.n >= 15 }));
  } else if (kind === 'evidence') {
    data.charts.evidence.families.forEach(r => rows.push({ type: 'family', ...r })); data.charts.evidence.papers.forEach(r => rows.push({ type: 'paper', ...r }));
  } else data.charts.readiness.forEach(r => rows.push({ type: 'readiness', ...r }));
  const metadata = { version: data.version, source_hash: data.source_hash || 'not-provided', style_version: SCIENTIFIC_STYLE_VERSION, scope_status: data.scope.status, scope_family: data.scope.family, scope_material_form: data.scope.material_form };
  const all = (rows.length ? rows : [{ type: 'empty' }]).map(row => ({ ...metadata, ...row }) as Row);
  const columns = Array.from(new Set(all.flatMap(row => Object.keys(row))));
  const escape = (value: unknown) => { let text = value == null ? '' : String(value); if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  const csv = [columns.join(','), ...all.map(row => columns.map(key => escape(row[key])).join(','))].join('\r\n');
  downloadBlob(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), `REAL-${data.version}-${kind}-${SCIENTIFIC_STYLE_VERSION}-statistics.csv`);
}
