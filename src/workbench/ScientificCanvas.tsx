import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { downloadBlob, exportChartStatistics, numberLabel, SCIENTIFIC_STYLE_VERSION, type ExplorerData } from './explorer-data';

export type ChartKind = 'emission' | 'relationship' | 'quality' | 'correlation' | 'evidence' | 'readiness';
type Hit = { x: number; y: number; radius: number; text: string; sample?: string };
const W = 1600, H = 590, ink = '#233f50', muted = '#536977';
const extent = (values: number[]): [number, number] => {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1];
  const lo = Math.min(...finite), hi = Math.max(...finite);
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
};
const scale = ([lo, hi]: [number, number], a: number, b: number) => (value: number) => a + (value - lo) / (hi - lo) * (b - a);

/** The same scientific marks are redrawn at display and export resolution.
 * Inputs are backend statistics; no KDE, correlation, jitter or PCA is computed here. */
function drawFigure(ctx: CanvasRenderingContext2D, kind: ChartKind, data: ExplorerData, selected: string | null): Hit[] {
  const hits: Hit[] = [];
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.font = '15px "Noto Sans SC", sans-serif'; ctx.lineWidth = 1;
  const text = (value: string, x: number, y: number, color = muted, align: CanvasTextAlign = 'left') => { ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y); };
  const line = (x: number, y: number, x2: number, y2: number, color = '#dfe7eb') => { ctx.beginPath(); ctx.strokeStyle = color; ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); };
  const dot = (x: number, y: number, color: string, sample: string, label: string, radius = 3.5) => {
    ctx.beginPath(); ctx.arc(x, y, selected === sample ? radius + 2.5 : radius, 0, Math.PI * 2);
    ctx.globalAlpha = selected === sample ? 0.9 : 0.24; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 0.85; ctx.strokeStyle = color; ctx.lineWidth = selected === sample ? 1.8 : 0.85; ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
    hits.push({ x, y, radius: 9, text: label, sample });
  };
  const axes = (xd: [number, number], yd: [number, number], left: number, top: number, right: number, bottom: number, xlabel: string, ylabel: string, labelOffset = 53) => {
    const x = scale(xd, left, right), y = scale(yd, bottom, top);
    for (let i = 0; i <= 5; i++) {
      const vx = xd[0] + (xd[1] - xd[0]) * i / 5, vy = yd[0] + (yd[1] - yd[0]) * i / 5;
      line(left, y(vy), right, y(vy), '#edf1f3'); line(x(vx), bottom, x(vx), bottom - 6, ink); line(left, y(vy), left + 6, y(vy), ink);
      text(numberLabel(vx), x(vx), bottom + 23, muted, 'center'); text(numberLabel(vy), left - 12, y(vy) + 4, muted, 'right');
    }
    line(left, top, left, bottom, ink); line(left, bottom, right, bottom, ink);
    text(xlabel, (left + right) / 2, bottom + labelOffset, ink, 'center');
    ctx.save(); ctx.translate(left - 57, (top + bottom) / 2); ctx.rotate(-Math.PI / 2); text(ylabel, 0, 0, ink, 'center'); ctx.restore();
    return { x, y };
  };
  const density = (grid: number[], values: number[], x: (n: number) => number, y: (n: number) => number, baseline: number, color: string, sideways = false) => {
    if (grid.length < 2 || !values.length) return;
    ctx.beginPath();
    if (sideways) ctx.moveTo(baseline, y(grid[0])); else ctx.moveTo(x(grid[0]), baseline);
    grid.forEach((v, i) => { if (sideways) ctx.lineTo(x(values[i] || 0), y(v)); else ctx.lineTo(x(v), y(values[i] || 0)); });
    if (sideways) ctx.lineTo(baseline, y(grid[grid.length - 1])); else ctx.lineTo(x(grid[grid.length - 1]), baseline);
    ctx.closePath(); ctx.globalAlpha = 0.17; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 0.85; ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
  };
  if (kind === 'emission') {
    const chart = data.charts.emission;
    if (!chart.groups.length) { text('当前范围没有可绘制的发射峰记录', W / 2, H / 2, muted, 'center'); return hits; }
    const ymax = Math.max(0.01, ...chart.groups.flatMap(g => g.density));
    const { x, y } = axes(extent(chart.grid), [0, ymax * 1.08], 85, 32, W - 40, 418, '发射波长 / nm', '核密度', 132);
    chart.groups.forEach((g, i) => {
      density(chart.grid, g.density, x, y, 418, g.color);
      const row = 461 + i * Math.min(5, 52 / chart.groups.length);
      g.points.forEach(p => dot(x(p.x), row, g.color, p.sample_id, `${p.sample_id} · ${g.name} · ${numberLabel(p.x)} nm`, 2.3));
    });
    text('下方短点列为真实观测值；曲线为后端核密度估计，不代表新增样品。', 85, 583);
  } else if (kind === 'relationship') {
    const c = data.charts.relationship;
    if (!c.points.length) { text('当前范围缺少成对有效字段', W / 2, H / 2, muted, 'center'); return hits; }
    const xd = extent(c.x_grid.length ? c.x_grid : c.points.map(p => p.x)), yd = extent(c.y_grid.length ? c.y_grid : c.points.map(p => p.y));
    const { x, y } = axes(xd, yd, 90, 122, W - 160, 492, c.x_label, c.y_label);
    const dx = Math.max(0.001, ...c.groups.flatMap(g => g.density_x)), dy = Math.max(0.001, ...c.groups.flatMap(g => g.density_y));
    c.groups.forEach(g => { density(c.x_grid, g.density_x, x, scale([0, dx], 106, 22), 106, g.color); density(c.y_grid, g.density_y, scale([0, dy], W - 143, W - 35), y, W - 143, g.color, true); });
    c.points.forEach(p => dot(x(p.x), y(p.y), p.color, p.sample_id, `${p.sample_id} · ${p.family} · ${numberLabel(p.x)}, ${numberLabel(p.y)}`));
    ctx.font = '11px "Noto Sans SC", sans-serif';
    c.groups.forEach((g,i) => { const gx=100+i*((W-240)/Math.max(c.groups.length,1)); ctx.fillStyle=g.color; ctx.fillRect(gx,132,10,3); text(g.family,gx+16,138,g.color); });
    text(`n = ${c.points.length}`,W-180,161,muted,'right');
    ctx.font = '13px "Noto Sans SC", sans-serif';
    text('一粒点对应一个真实样品；重合坐标不做抖动。', 90, 573);
  } else if (kind === 'quality') {
    const c = data.charts.quality;
    if (!c.rows.length || !c.fields.length) { text('当前范围没有字段覆盖数据', 550, 290, muted, 'center'); return hits; }
    const left = 110, top = 40, cw = (W - 180) / c.fields.length, ch = 380 / c.rows.length;
    c.rows.forEach((row, i) => row.available.forEach((available, j) => {
      ctx.fillStyle = available ? '#6da3bf' : '#eef2f4'; ctx.fillRect(left + j * cw + 0.6, top + i * ch, Math.max(1, cw - 1.2), Math.max(0.5, ch - 0.3));
      hits.push({ x: left + (j + 0.5) * cw, y: top + (i + 0.5) * ch, radius: Math.max(ch / 2, 2), text: `${row.sample_id} · ${c.fields[j]} · ${available ? '有值' : '缺失'}`, sample: row.sample_id });
    }));
    c.fields.forEach((field, j) => { ctx.save(); ctx.translate(left + (j + 0.5) * cw, 435); ctx.rotate(-Math.PI / 4); text(field, 0, 0, ink, 'right'); ctx.restore(); });
    text(`${c.rows.length} 个样品`, 16, 35, ink); text('每行一个样品；蓝色为有值，浅灰为缺失。有值不等于证据合格。', 110, 578);
  } else if (kind === 'correlation') {
    const c = data.charts.correlation;
    if (!c.labels.length) { text('当前范围不足以估计相关性', 550, 290, muted, 'center'); return hits; }
    const side = 400, cell = side / c.labels.length, left = 430, top = 35;
    const maxN = Math.max(1, ...c.values.map(v => v.n));
    c.values.forEach(v => {
      const x = left + (v.j + 0.5) * cell, y = top + (v.i + 0.5) * cell;
      ctx.strokeStyle = '#edf1f3'; ctx.strokeRect(x - cell / 2, y - cell / 2, cell, cell);
      const size = Math.max(3, Math.sqrt(v.n / maxN) * cell * 0.86);
      if (v.r !== null && v.n >= 15) { ctx.fillStyle = v.r >= 0 ? '#cc744e' : '#4c8fb7'; ctx.globalAlpha = 0.14 + Math.abs(v.r) * 0.8; ctx.fillRect(x - size / 2, y - size / 2, size, size); ctx.globalAlpha = 1; }
      else { ctx.strokeStyle = '#aeb6bb'; ctx.strokeRect(x - size / 2, y - size / 2, size, size); }
      hits.push({ x, y, radius: cell / 2, text: `${c.labels[v.i]} × ${c.labels[v.j]} · ρ=${v.r === null ? '不可估计' : numberLabel(v.r)} · n=${v.n}` });
    });
    c.labels.forEach((label, i) => { text(label, left - 12, top + (i + 0.6) * cell, ink, 'right'); ctx.save(); ctx.translate(left + (i + 0.5) * cell, top + side + 12); ctx.rotate(-Math.PI / 4); text(label, 0, 0, ink, 'right'); ctx.restore(); });
    text('Spearman ρ', 960, 100, ink); text('蓝色：负相关', 960, 132, '#39789c'); text('橙色：正相关', 960, 160, '#a64f2b'); text(`方块面积 ∝ 有效配对数 n（最大 ${maxN}）`, 960, 204); text('灰色空心：n < 15 或无法估计；悬停查看 ρ 与 n', 960, 232);
    text('相关性不是因果关系；样品配对数不是独立 DOI 证据数。', 120, 580);
  } else if (kind === 'evidence') {
    const rows = data.charts.evidence.families;
    if (!rows.length) { text('当前范围暂无可用统计', W / 2, H / 2, muted, 'center'); return hits; }
    const columns = [{ key: 'samples' as const, label: '样品数', color: '#4c8fb7' }, { key: 'doi' as const, label: 'DOI 数', color: '#76b4ac' }, { key: 'series' as const, label: '连续系列数', color: '#b399c6' }];
    const left = 205, panelWidth = (W - left - 40) / 3, rowHeight = Math.min(25, 450 / rows.length);
    rows.forEach((row, i) => text(row.family, left - 20, 62 + i * rowHeight, ink, 'right'));
    columns.forEach((column, j) => {
      const panelLeft = left + j * panelWidth, panelRight = panelLeft + panelWidth - 58;
      const max = Math.max(1, ...rows.map(row => row[column.key]));
      const x = scale([0, max], panelLeft, panelRight);
      text(column.label, panelLeft, 28, ink);
      rows.forEach((row, i) => {
        const y = 57 + i * rowHeight, value = row[column.key];
        ctx.fillStyle = column.color; ctx.globalAlpha = 0.82; ctx.fillRect(panelLeft, y - 5, x(value) - panelLeft, 8); ctx.globalAlpha = 1;
        text(String(value), x(value) + 8, y + 5);
        hits.push({ x: (panelLeft + x(value)) / 2, y, radius: 9, text: `${row.family} · ${column.label} ${value}` });
      });
      line(panelLeft, 40, panelLeft, 63 + (rows.length - 1) * rowHeight, '#ccd8df');
    });
    text('三列分别使用各自计数轴；样品、DOI 和连续系列是不同证据层级，不能互相替代。', left, 578);
  } else {
    const readiness = kind === 'readiness';
    const rows = readiness ? data.charts.readiness.map(r => ({ label: r.model, values: [r.ready, r.total], labels: ['符合字段要求', '当前样品总数'] })) : data.charts.evidence.families.map(r => ({ label: r.family, values: [r.samples, r.doi, r.series], labels: ['样品', 'DOI', '连续系列'] }));
    if (!rows.length) { text('当前范围暂无可用统计', 550, 290, muted, 'center'); return hits; }
    const colors = ['#4c8fb7', '#76b4ac', '#b399c6'], max = Math.max(1, ...rows.flatMap(r => r.values));
    const left = 175, right = W - 170, top = 40, rowH = Math.min(72, 450 / rows.length), x = scale([0, max], left, right);
    rows.forEach((r, i) => {
      const y = top + i * rowH; text(r.label, left - 15, y + rowH / 2 + 4, ink, 'right');
      r.values.forEach((v, j) => { const h = Math.max(2, Math.min(13, (rowH - 9) / r.values.length)), by = y + j * (h + 2); ctx.fillStyle = colors[j]; ctx.globalAlpha = 0.75; ctx.fillRect(left, by, x(v) - left, h); ctx.globalAlpha = 1; text(String(v), x(v) + 7, by + h, muted); hits.push({ x: (left + x(v)) / 2, y: by + h / 2, radius: h, text: `${r.label} · ${r.labels[j]} ${v}` }); });
    });
    rows[0].labels.forEach((label, i) => { ctx.fillStyle = colors[i]; ctx.fillRect(180 + i * 220, 532, 18, 9); text(label, 207 + i * 220, 541); });
    text(readiness ? '字段资格不等于可训练结论，更不等于模型已通过严格分组验证。' : '样品、DOI 和连续系列是不同证据层级，不能互相替代。', 175, 578);
  }
  return hits;
}

export function ScientificCanvas({ kind, title, description, data, selected, onSelect }: { kind: ChartKind; title: string; description: string; data: ExplorerData; selected: string | null; onSelect: (sample: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), hits = useRef<Hit[]>([]);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [exportError, setExportError] = useState('');
  const [exportPreview, setExportPreview] = useState('');
  useEffect(() => {
    const target = canvas.current; if (!target) return;
    const draw = () => { const ratio = Math.min(window.devicePixelRatio || 1, 2); target.width = Math.round(W * ratio); target.height = Math.round(H * ratio); const ctx = target.getContext('2d'); if (!ctx) return; ctx.scale(ratio, ratio); hits.current = drawFigure(ctx, kind, data, selected); };
    draw(); const observer = new ResizeObserver(draw); observer.observe(target); return () => observer.disconnect();
  }, [kind, data, selected]);
  function hitAt(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - rect.left) / rect.width * W, y = (e.clientY - rect.top) / rect.height * H;
    if (kind === 'quality') { const c = data.charts.quality; const j = Math.floor((x - 110) / ((W - 180) / c.fields.length)), i = Math.floor((y - 40) / (380 / c.rows.length)); return x >= 110 && x < W - 70 && y >= 40 && y < 420 ? hits.current[i * c.fields.length + j] : undefined; }
    for (let i = hits.current.length - 1; i >= 0; i--) { const point = hits.current[i]; if (Math.hypot(point.x - x, point.y - y) <= point.radius) return point; }
    return undefined;
  }
  function exportPng() {
    setExportError('');
    try {
      const target = document.createElement('canvas'); target.width = 4200; target.height = Math.round(H / W * 4200) + 150;
      const ctx = target.getContext('2d'); if (!ctx) throw new Error('当前浏览器无法导出图像');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, target.width, target.height); ctx.save(); ctx.scale(4200 / W, 4200 / W); drawFigure(ctx, kind, data, selected); ctx.restore();
      ctx.fillStyle = ink; ctx.font = '24px sans-serif';
      ctx.fillText(`${title} | ${data.version} | ${data.scope.status} | ${data.scope.family || '全部家族'} | ${data.scope.material_form || '全部形态'}`, 100, target.height - 90);
      ctx.fillText(`Source SHA-256: ${data.source_hash || 'not-provided'} | Style: ${SCIENTIFIC_STYLE_VERSION}`, 100, target.height - 45);
      setExportPreview(target.toDataURL('image/png'));
      target.toBlob(blob => { if (blob) downloadBlob(blob, `REAL-${data.version}-${kind}-${SCIENTIFIC_STYLE_VERSION}.png`); else setExportError('图像生成失败，请重试'); }, 'image/png');
    } catch (error) { setExportError(error instanceof Error ? error.message : '导出失败'); }
  }
  return <figure className={`science-chart science-chart-${kind}`}>
    <figcaption><div><h3>{title}</h3><p>{description}</p></div><div className="science-figure-downloads"><button className="science-action" onClick={() => exportChartStatistics(data, kind)} aria-label={`下载${title}统计 CSV`}><Download size={15} />统计 CSV</button><button className="science-action" onClick={exportPng} aria-label={`下载${title} PNG`}><Download size={15} />高清 PNG</button></div></figcaption>
    <div className="science-canvas-wrap"><canvas ref={canvas} role="img" aria-label={title} onPointerMove={e => { const hit = hitAt(e); const rect = e.currentTarget.getBoundingClientRect(); setTooltip(hit ? { text: hit.text, x: Math.min(e.clientX - rect.left + 12, rect.width - 250), y: e.clientY - rect.top + 12 } : null); }} onPointerLeave={() => setTooltip(null)} onClick={e => { const hit = hitAt(e); if (hit?.sample) onSelect(hit.sample); }} />{tooltip && <div className="science-tooltip" style={{ left: Math.max(0, tooltip.x), top: tooltip.y }}>{tooltip.text}</div>}</div>
    {exportError && <p role="alert">{exportError}</p>}
    {exportPreview && <details><summary>查看已生成的高清 PNG（浏览器未下载时可打开保存）</summary><a href={exportPreview} target="_blank" rel="noreferrer" download={`REAL-${kind}.png`}>打开原始 PNG</a><img src={exportPreview} alt={`${title}高清导出预览`} style={{width:'100%',height:'auto'}} /></details>}
  </figure>;
}
