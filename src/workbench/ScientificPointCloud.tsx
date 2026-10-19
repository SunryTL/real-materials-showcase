import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Download, Focus, RotateCcw } from 'lucide-react';
import { buildEvidenceGalaxy, type GalaxyEdge, type GalaxyNode } from './evidence-galaxy';
import { downloadBlob, numberLabel, type ExplorerData, type ExplorerPoint } from './explorer-data';

type ColorMode = 'family' | 'emission' | 'coverage';
type ViewMode = 'galaxy' | 'pca';
type HoverState = { node: GalaxyNode; x: number; y: number };
type SceneActions = { reset: () => void; export: () => void; clearFocus: () => void };

const COLOR_LOW = new THREE.Color('#4b91bd');
const COLOR_HIGH_PL = new THREE.Color('#ef9874');
const COLOR_HIGH_COVERAGE = new THREE.Color('#68d4b8');

function recordColor(node: GalaxyNode, data: ExplorerData, mode: ColorMode, minPL: number, maxPL: number) {
  const record = node.record;
  const family = node.family || record?.family || '';
  if (node.kind === 'database') return new THREE.Color('#eaffff');
  if (node.unresolved && node.kind === 'doi') return new THREE.Color('#8a939d');
  if (node.kind !== 'sample' || mode === 'family') {
    const base = new THREE.Color(data.family_colors[family] || '#81a4b5');
    return node.kind === 'doi' ? base.lerp(new THREE.Color('#f2fbff'), 0.38) : base;
  }
  if (mode === 'emission') {
    if (record?.emission_nm == null) return new THREE.Color('#7f8992');
    const ratio = maxPL === minPL ? 0.5 : (record.emission_nm - minPL) / (maxPL - minPL);
    return COLOR_LOW.clone().lerp(COLOR_HIGH_PL, THREE.MathUtils.clamp(ratio, 0, 1));
  }
  return COLOR_LOW.clone().lerp(COLOR_HIGH_COVERAGE, THREE.MathUtils.clamp(record?.coverage_fraction ?? 0, 0, 1));
}

function nodeSize(node: GalaxyNode, view: ViewMode) {
  if (view === 'pca') return 7;
  if (node.kind === 'database') return 34;
  if (node.kind === 'family') return 16 + Math.min(8, Math.sqrt(node.count));
  if (node.kind === 'doi') return 9 + Math.min(7, Math.sqrt(node.count) * 1.35);
  return 5.2;
}

function curvePoints(source: THREE.Vector3, target: THREE.Vector3, edge: GalaxyEdge, edgeIndex: number) {
  const midpoint = source.clone().add(target).multiplyScalar(0.5);
  const direction = target.clone().sub(source).normalize();
  const reference = Math.abs(direction.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3().crossVectors(direction, reference).normalize();
  const sign = edgeIndex % 2 ? -1 : 1;
  const bend = edge.kind === 'doi-sample' ? 0.22 : edge.kind === 'family-doi' ? 0.34 : 0.26;
  midpoint.addScaledVector(tangent, sign * bend).addScaledVector(midpoint.clone().normalize(), bend * 0.55);
  return new THREE.QuadraticBezierCurve3(source, midpoint, target).getPoints(edge.kind === 'doi-sample' ? 7 : 11);
}

function labelSprite(text: string, color: string, scale: number, emphasis = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 768; canvas.height = 128;
  const brush = canvas.getContext('2d')!;
  brush.font = `${emphasis ? 700 : 600} ${emphasis ? 43 : 34}px Inter, "PingFang SC", sans-serif`;
  brush.textAlign = 'center'; brush.textBaseline = 'middle';
  brush.shadowBlur = emphasis ? 20 : 11; brush.shadowColor = color; brush.fillStyle = color;
  brush.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, opacity: emphasis ? 1 : 0.88 });
  const sprite = new THREE.Sprite(material); sprite.scale.set(scale * 6, scale, 1); sprite.renderOrder = 8;
  return { sprite, texture, material };
}

function pcaNodes(points: ExplorerPoint[]): GalaxyNode[] {
  return points.map(point => ({ id: `sample:${point.sample_id}`, kind: 'sample', label: point.sample_id, position: [point.PC1, point.PC2, point.PC3], count: 1, family: point.plot_family || point.family, doi: point.doi, sample_id: point.sample_id, record: point }));
}

export function ScientificPointCloud({ data, selected, onSelect }: { data: ExplorerData; selected: string | null; onSelect: (sample: string) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const selectionRing = useRef<THREE.Sprite | null>(null);
  const samplePositions = useRef<Map<string, THREE.Vector3>>(new Map());
  const actions = useRef<SceneActions | null>(null);
  const [view, setView] = useState<ViewMode>('galaxy');
  const [colorMode, setColorMode] = useState<ColorMode>('family');
  const [failure, setFailure] = useState('');
  const [hover, setHover] = useState<HoverState | null>(null);
  const [focused, setFocused] = useState<GalaxyNode | null>(null);
  const galaxy = useMemo(() => buildEvidenceGalaxy(data.records, data.version), [data.records, data.version]);
  const emission = data.records.map(record => record.emission_nm).filter((value): value is number => value !== null && Number.isFinite(value));
  const minPL = Math.min(...emission), maxPL = Math.max(...emission);

  useEffect(() => {
    const host = mount.current;
    const sourceNodes = view === 'galaxy' ? galaxy.nodes : pcaNodes(data.points);
    if (!host || !sourceNodes.length) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
    catch { queueMicrotask(() => setFailure('此浏览器未提供WebGL。三维视图不可用；二维图和真实样品表仍可查看与导出。')); return; }
    queueMicrotask(() => { setFailure(''); setHover(null); setFocused(null); });
    renderer.setClearColor('#02070e'); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.86;
    renderer.domElement.setAttribute('aria-label', `可旋转三维材料点云：${view === 'galaxy' ? '数据库证据星系' : 'PCA化学空间'}`); renderer.domElement.setAttribute('role', 'img'); renderer.domElement.dataset.sceneMode = view; renderer.domElement.dataset.sampleNodes = String(view === 'galaxy' ? galaxy.counts.samples : data.points.length); renderer.domElement.dataset.doiNodes = String(view === 'galaxy' ? galaxy.counts.dois : new Set(data.points.map(point => point.doi).filter(Boolean)).size);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene(); scene.background = new THREE.Color('#02070e'); scene.fog = new THREE.FogExp2('#02070e', view === 'galaxy' ? 0.027 : 0.012);
    const group = new THREE.Group(); scene.add(group);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(sourceNodes.flatMap(node => node.position), 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(sourceNodes.flatMap(node => recordColor(node, data, colorMode, minPL, maxPL).toArray()), 3));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sourceNodes.map(node => nodeSize(node, view)), 1));
    geometry.setAttribute('aOpacity', new THREE.Float32BufferAttribute(sourceNodes.map(() => 1), 1));
    geometry.computeBoundingSphere();
    const center = view === 'galaxy' ? new THREE.Vector3() : geometry.boundingSphere!.center.clone();
    const radius = Math.max(geometry.boundingSphere!.radius, 1);
    const material = new THREE.ShaderMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: `attribute float aSize; attribute float aOpacity; uniform float uPixelRatio; varying vec3 vColor; varying float vOpacity; void main(){vColor=color;vOpacity=aOpacity;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(aSize*uPixelRatio*(52.0/max(3.0,-mv.z)),2.4,34.0);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vColor; varying float vOpacity; void main(){vec2 uv=gl_PointCoord-vec2(.5);float r=length(uv);if(r>.5)discard;float core=smoothstep(.31,.035,r);float halo=smoothstep(.5,.22,r)*.16;float rim=smoothstep(.48,.4,r)-smoothstep(.4,.32,r);vec3 c=mix(vColor,vec3(1.0),core*.22+rim*.12);gl_FragColor=vec4(c,(core*.88+halo+rim*.12)*vOpacity);}`,
    });
    const points = new THREE.Points(geometry, material); points.renderOrder = 4; group.add(points);
    const resources: { dispose: () => void }[] = [geometry, material];
    const nodeById = new Map(sourceNodes.map(node => [node.id, node]));
    samplePositions.current = new Map(sourceNodes.filter(node => node.sample_id).map(node => [node.sample_id!, new THREE.Vector3(...node.position)]));

    let edgeGeometry: THREE.BufferGeometry | null = null;
    const edgeVertexIds: string[] = [];
    if (view === 'galaxy') {
      const edgePositions: number[] = [], edgeColors: number[] = [], edgeOpacity: number[] = [];
      galaxy.edges.forEach((edge, edgeIndex) => {
        const source = nodeById.get(edge.source), target = nodeById.get(edge.target); if (!source || !target) return;
        const familyColor = new THREE.Color(data.family_colors[edge.family || target.family || ''] || '#7698aa');
        const curve = curvePoints(new THREE.Vector3(...source.position), new THREE.Vector3(...target.position), edge, edgeIndex);
        const baseOpacity = edge.kind === 'database-family' ? 0.34 : edge.kind === 'family-doi' ? 0.24 : 0.15;
        for (let index = 0; index < curve.length - 1; index += 1) {
          edgePositions.push(...curve[index].toArray(), ...curve[index + 1].toArray()); edgeColors.push(...familyColor.toArray(), ...familyColor.toArray()); edgeOpacity.push(baseOpacity, baseOpacity); edgeVertexIds.push(edge.id, edge.id);
        }
      });
      edgeGeometry = new THREE.BufferGeometry(); edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3)); edgeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(edgeColors, 3)); edgeGeometry.setAttribute('aOpacity', new THREE.Float32BufferAttribute(edgeOpacity, 1));
      const edgeMaterial = new THREE.ShaderMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute float aOpacity;varying vec3 vColor;varying float vOpacity;void main(){vColor=color;vOpacity=aOpacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec3 vColor;varying float vOpacity;void main(){gl_FragColor=vec4(vColor,vOpacity);}` });
      const lines = new THREE.LineSegments(edgeGeometry, edgeMaterial); lines.renderOrder = 1; group.add(lines); resources.push(edgeGeometry, edgeMaterial);
    }

    const labels = new Map<string, THREE.Sprite>();
    if (view === 'galaxy') {
      sourceNodes.filter(node => node.kind === 'database' || node.kind === 'family').forEach(node => {
        const color = node.kind === 'database' ? '#efffff' : (data.family_colors[node.family || ''] || '#a9d4df');
        const asset = labelSprite(node.label, color, node.kind === 'database' ? 1.2 : 0.88, node.kind === 'database');
        asset.sprite.position.set(...node.position).add(new THREE.Vector3(0, node.kind === 'database' ? -1.25 : -0.68, 0)); group.add(asset.sprite); labels.set(node.id, asset.sprite); resources.push(asset.texture, asset.material);
      });
    } else if (data.axes.length >= 3) {
      const lo = data.axes.map(axis => axis.min), hi = data.axes.map(axis => axis.max);
      data.axes.slice(0, 3).forEach((axis, index) => {
        const start = new THREE.Vector3(lo[0], lo[1], lo[2]), end = start.clone(); end.setComponent(index, hi[index]);
        const axisGeometry = new THREE.BufferGeometry().setFromPoints([start, end]); const axisMaterial = new THREE.LineBasicMaterial({ color: '#5f879b', transparent: true, opacity: 0.7 }); group.add(new THREE.Line(axisGeometry, axisMaterial)); resources.push(axisGeometry, axisMaterial);
        const asset = labelSprite(`${axis.key} · ${(axis.explained_variance_ratio * 100).toFixed(1)}%`, '#a4c1ce', Math.max(radius * 0.11, 0.25)); asset.sprite.position.copy(end); group.add(asset.sprite); resources.push(asset.texture, asset.material);
      });
    }

    const ringCanvas = document.createElement('canvas'); ringCanvas.width = ringCanvas.height = 128;
    const ringBrush = ringCanvas.getContext('2d')!; ringBrush.beginPath(); ringBrush.arc(64, 64, 43, 0, Math.PI * 2); ringBrush.shadowBlur = 25; ringBrush.shadowColor = '#71fff0'; ringBrush.strokeStyle = '#e8fffd'; ringBrush.lineWidth = 7; ringBrush.stroke();
    const ringTexture = new THREE.CanvasTexture(ringCanvas), ringMaterial = new THREE.SpriteMaterial({ map: ringTexture, transparent: true, depthTest: false, depthWrite: false });
    const ring = new THREE.Sprite(ringMaterial); ring.scale.setScalar(view === 'galaxy' ? 0.78 : radius * 0.13); ring.visible = false; ring.renderOrder = 10; group.add(ring); selectionRing.current = ring; resources.push(ringTexture, ringMaterial);

    const camera = new THREE.PerspectiveCamera(view === 'galaxy' ? 42 : 40, 1, radius / 1000, radius * 120);
    camera.position.copy(center).add(view === 'galaxy' ? new THREE.Vector3(14, 7.5, 27) : new THREE.Vector3(radius * 1.6, radius * 0.9, radius * 2.5));
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.copy(center); controls.enableDamping = true; controls.dampingFactor = 0.065; controls.minDistance = radius * 0.45; controls.maxDistance = radius * 8; controls.update(); controls.saveState();
    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), view === 'galaxy' ? 0.34 : 0.2, 0.32, 0.38); composer.addPass(bloom);
    let userInteracted = false, activeFocus: string | null = null; const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; const interruptRotation = () => { userInteracted = true; }; controls.addEventListener('start', interruptRotation);

    const relevantFor = (focusId: string | null) => {
      if (!focusId || view !== 'galaxy') return new Set(sourceNodes.map(node => node.id));
      const focus = nodeById.get(focusId); if (!focus) return new Set(sourceNodes.map(node => node.id));
      const relevant = new Set<string>(['database', focusId]);
      if (focus.kind === 'family') galaxy.edges.filter(edge => edge.source === focusId).forEach(edge => { relevant.add(edge.target); galaxy.edges.filter(child => child.source === edge.target).forEach(child => relevant.add(child.target)); });
      else if (focus.kind === 'doi') galaxy.edges.filter(edge => edge.target === focusId || edge.source === focusId).forEach(edge => { relevant.add(edge.source); relevant.add(edge.target); });
      return relevant;
    };
    const applyFocus = (focusId: string | null) => {
      activeFocus = focusId;
      const relevant = relevantFor(focusId); const opacity = geometry.getAttribute('aOpacity') as THREE.BufferAttribute;
      sourceNodes.forEach((node, index) => opacity.setX(index, relevant.has(node.id) ? 1 : 0.07)); opacity.needsUpdate = true;
      if (edgeGeometry) { const edgeAlpha = edgeGeometry.getAttribute('aOpacity') as THREE.BufferAttribute; edgeVertexIds.forEach((edgeId, index) => { const edge = galaxy.edges.find(item => item.id === edgeId); const active = edge && relevant.has(edge.source) && relevant.has(edge.target); edgeAlpha.setX(index, active ? (edge?.kind === 'database-family' ? 0.52 : edge?.kind === 'family-doi' ? 0.4 : 0.3) : 0.012); }); edgeAlpha.needsUpdate = true; }
      labels.forEach((sprite, id) => { sprite.material.opacity = relevant.has(id) ? 0.94 : 0.08; }); setFocused(focusId ? nodeById.get(focusId) ?? null : null);
    };

    const resize = () => { const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1); renderer.setSize(width, height); composer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(host);
    const raycaster = new THREE.Raycaster(); raycaster.params.Points!.threshold = view === 'galaxy' ? 0.24 : radius * 0.025;
    const pick = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera); const hit = raycaster.intersectObject(points)[0]; return hit?.index === undefined ? null : sourceNodes[hit.index]; };
    const move = (event: PointerEvent) => { const node = pick(event); const rect = host.getBoundingClientRect(); setHover(node ? { node, x: Math.max(0, Math.min(event.clientX - rect.left + 14, rect.width - 285)), y: Math.max(8, Math.min(event.clientY - rect.top + 14, rect.height - 130)) } : null); host.style.cursor = node ? 'pointer' : 'grab'; };
    let downX = 0, downY = 0; const down = (event: PointerEvent) => { downX = event.clientX; downY = event.clientY; };
    const up = (event: PointerEvent) => { if (Math.hypot(event.clientX - downX, event.clientY - downY) >= 5) return; const node = pick(event); if (!node) { applyFocus(null); return; } if (node.kind === 'sample' && node.sample_id) onSelect(node.sample_id); else if (view === 'galaxy' && (node.kind === 'family' || node.kind === 'doi')) applyFocus(node.id); };
    const leave = () => setHover(null); const lost = (event: Event) => { event.preventDefault(); setFailure('WebGL上下文已丢失。请重新载入页面恢复三维图；二维图与样品表仍可使用。'); }; const key = (event: KeyboardEvent) => { if (event.key === 'Escape') applyFocus(null); };
    renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointerleave', leave); renderer.domElement.addEventListener('webglcontextlost', lost); window.addEventListener('keydown', key);
    let frame = 0; const render = () => { if (view === 'galaxy' && !reducedMotion && !userInteracted && !activeFocus) group.rotation.y += 0.00042; controls.update(); composer.render(); frame = requestAnimationFrame(render); }; render();
    actions.current = { reset: () => { controls.reset(); group.rotation.set(0, 0, 0); userInteracted = false; applyFocus(null); }, clearFocus: () => applyFocus(null), export: () => {
      const ratio = renderer.getPixelRatio(), size = renderer.getSize(new THREE.Vector2()), screenPointRatio = material.uniforms.uPixelRatio.value;
      const exportHeight = Math.round(4200 * size.y / size.x), exportPointRatio = 4200 / size.x;
      renderer.setPixelRatio(1); renderer.setSize(4200, exportHeight, false); composer.setSize(4200, exportHeight);
      material.uniforms.uPixelRatio.value = exportPointRatio; camera.aspect = 4200 / exportHeight; camera.updateProjectionMatrix(); composer.render();
      renderer.domElement.toBlob(blob => { if (blob) downloadBlob(blob, `REAL-${data.version}-${view === 'galaxy' ? 'evidence-galaxy' : 'PCA'}-${colorMode}.png`); }, 'image/png');
      renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false); composer.setSize(size.x, size.y); material.uniforms.uPixelRatio.value = screenPointRatio;
      camera.aspect = size.x / size.y; camera.updateProjectionMatrix(); composer.render();
    } };
    return () => { cancelAnimationFrame(frame); observer.disconnect(); controls.removeEventListener('start', interruptRotation); controls.dispose(); resources.forEach(resource => resource.dispose()); composer.dispose(); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointerleave', leave); renderer.domElement.removeEventListener('webglcontextlost', lost); window.removeEventListener('keydown', key); renderer.dispose(); renderer.domElement.remove(); actions.current = null; selectionRing.current = null; samplePositions.current.clear(); };
  }, [data, galaxy, view, colorMode, minPL, maxPL, onSelect]);

  useEffect(() => { const ring = selectionRing.current, position = selected ? samplePositions.current.get(selected) : undefined; if (!ring) return; ring.visible = Boolean(position); if (position) ring.position.copy(position); }, [selected, data, view, colorMode]);

  const focusLabel = focused?.kind === 'family' ? `${focused.label} · ${focused.count}个样品` : focused?.kind === 'doi' ? `${focused.label} · ${focused.count}个样品` : '';
  return <section className="science-cloud" aria-labelledby="science-cloud-title">
    <header><div><h3 id="science-cloud-title">{view === 'galaxy' ? '数据库证据星系' : '材料描述符PCA空间'} · {view === 'galaxy' ? `${galaxy.counts.samples} samples · ${galaxy.counts.dois} DOI · ${galaxy.counts.families} families` : `${data.summary.projected} projected samples`}</h3><p>{view === 'galaxy' ? '中心→材料家族→独立DOI→正式样品；每条曲线都对应可审计的归属关系。' : '真实PC1 / PC2 / PC3坐标；空间距离只表示标准化组成描述符的投影关系。'}</p></div><div className="science-cloud-actions"><div className="science-view-switch" aria-label="三维视图"><button aria-pressed={view === 'galaxy'} onClick={() => setView('galaxy')}>证据星系</button><button aria-pressed={view === 'pca'} onClick={() => setView('pca')}>PCA化学空间</button></div><label>节点着色<select value={colorMode} onChange={event => setColorMode(event.target.value as ColorMode)}><option value="family">材料家族</option><option value="emission">发射峰PL</option><option value="coverage">字段完整度</option></select></label>{focused && <button className="science-action" onClick={() => actions.current?.clearFocus()}><Focus size={15} />退出聚焦</button>}<button className="science-action" onClick={() => actions.current?.reset()} disabled={!!failure}><RotateCcw size={15} />重置视角</button><button className="science-action" onClick={() => actions.current?.export()} disabled={!!failure}><Download size={15} />点云截图</button></div></header>
    <div className="science-cloud-frame"><div className="science-webgl" ref={mount} />{failure && <p className="science-cloud-fallback" role="status">{failure}</p>}{view === 'galaxy' && !data.records.length && <p className="science-cloud-fallback">当前范围没有正式样品；不会用模拟节点填充。</p>}{view === 'pca' && !data.points.length && <p className="science-cloud-fallback">当前范围没有可投影样品；不会用模拟点填充。</p>}{hover && <div className="science-tooltip science-galaxy-tooltip" style={{ left: hover.x, top: hover.y }}><strong>{hover.node.kind === 'database' ? '数据库版本' : hover.node.kind === 'family' ? '材料家族' : hover.node.kind === 'doi' ? '独立论文证据' : '正式样品'} · {hover.node.label}</strong>{hover.node.kind !== 'sample' && <span>{hover.node.count}个样品</span>}{hover.node.record && <><span>{hover.node.record.formula || '组成未提供'}</span><span>PL {hover.node.record.emission_nm ?? '缺失'} nm · {hover.node.record.available_fields}/{hover.node.record.total_fields}字段</span><span>{hover.node.record.doi || 'DOI待确认'}</span></>}</div>}</div>
    <div className="science-cloud-note"><span>{view === 'galaxy' ? '星系位置呈现证据归属结构，不代表物理距离。' : `可投影${data.summary.projected}/${data.summary.samples}个样品；坐标由当前版本后端计算。`}</span><span>{focusLabel || (colorMode === 'coverage' ? '蓝→绿：字段覆盖度0→100%' : colorMode === 'emission' ? `蓝→珊瑚：${Number.isFinite(minPL) ? numberLabel(minPL) : '—'}→${Number.isFinite(maxPL) ? numberLabel(maxPL) : '—'} nm；灰色为缺失` : view === 'galaxy' ? `发光层级：1个数据库 · ${galaxy.counts.families}个家族 · ${galaxy.counts.dois}个DOI · ${galaxy.counts.samples}个样品` : '颜色表示材料家族')}</span></div>
    {view === 'galaxy' ? <details className="science-method"><summary>节点与连线如何读取</summary><p><b>节点：</b>中心为数据库版本，大节点为材料家族，中节点为独立DOI，小节点为样品。<b>连线：</b>只表示数据库中的家族归属、论文来源和样品贡献。{galaxy.counts.unresolved ? ` 当前有${galaxy.counts.unresolved}条记录进入灰色“DOI待确认”分支。` : ''}</p></details> : <details className="science-method"><summary>投影轴与主要载荷</summary>{data.axes.map(axis => <p key={axis.key}><b>{axis.key} · {(axis.explained_variance_ratio * 100).toFixed(1)}%</b>{' · '}{axis.top_loadings.map(value => `${value.feature} (${numberLabel(value.weight)})`).join(' · ') || '当前响应未提供载荷'}</p>)}</details>}
  </section>;
}
