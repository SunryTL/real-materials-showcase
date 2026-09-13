import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Download, RotateCcw } from 'lucide-react';
import { downloadBlob, numberLabel, type ExplorerData, type ExplorerPoint } from './explorer-data';

type ColorMode = 'family' | 'emission' | 'coverage';
export function ScientificPointCloud({ data, selected, onSelect }: { data: ExplorerData; selected: string | null; onSelect: (sample: string) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const selectionRing = useRef<THREE.Sprite | null>(null);
  const actions = useRef<{ reset: () => void; export: () => void } | null>(null);
  const [mode, setMode] = useState<ColorMode>('family');
  const [failure, setFailure] = useState('');
  const [hover, setHover] = useState<{ point: ExplorerPoint; x: number; y: number } | null>(null);
  const emission = data.points.map(p => p.emission_nm).filter((v): v is number => v !== null && Number.isFinite(v));
  const minPL = Math.min(...emission), maxPL = Math.max(...emission);
  useEffect(() => {
    const host = mount.current; if (!host || !data.points.length) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true }); }
    catch { queueMicrotask(() => setFailure('此浏览器未提供 WebGL。三维点云不可用；二维图和下方真实样品表仍可查看与导出。')); return; }
    queueMicrotask(() => { setFailure(''); setHover(null); });
    renderer.setClearColor('#061824'); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', '可旋转三维材料点云'); renderer.domElement.setAttribute('role', 'img');
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const geometry = new THREE.BufferGeometry();
    const positions = data.points.flatMap(p => [p.PC1, p.PC2, p.PC3]);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    const center = geometry.boundingSphere!.center.clone(), radius = Math.max(geometry.boundingSphere!.radius, 1);
    const colors = data.points.flatMap(p => {
      let color: THREE.Color;
      if (mode === 'family') color = new THREE.Color(data.family_colors[p.plot_family] || data.family_colors[p.family] || '#738491');
      else if (mode === 'emission' && p.emission_nm === null) color = new THREE.Color('#a1aab0');
      else { const ratio = mode === 'coverage' ? p.coverage_fraction : maxPL === minPL ? 0.5 : (p.emission_nm! - minPL) / (maxPL - minPL); color = new THREE.Color('#4787b3').lerp(new THREE.Color(mode === 'coverage' ? '#78b7a5' : '#d48464'), Math.max(0, Math.min(1, ratio))); }
      return color.toArray();
    });
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // One observation per vertex: the shader changes only the glyph, never the measured PCA coordinates.
    const material = new THREE.ShaderMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: 20.0 } },
      vertexShader: `
        uniform float uSize;
        varying vec3 vColor;
        varying float vDepth;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vDepth = clamp(1.0 - abs(mvPosition.z) / 24.0, 0.35, 1.0);
          gl_PointSize = clamp(uSize * (10.0 / max(1.0, -mvPosition.z)), 8.0, 22.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vDepth;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float r = length(uv);
          if (r > 0.5) discard;
          float core = smoothstep(0.34, 0.03, r);
          float halo = smoothstep(0.50, 0.16, r) * 0.18;
          float rim = smoothstep(0.49, 0.41, r) - smoothstep(0.41, 0.33, r);
          vec3 color = mix(vColor, vec3(0.90, 1.0, 1.0), core * 0.42 + rim * 0.28);
          gl_FragColor = vec4(color, (core * 0.88 + halo + rim * 0.22) * vDepth);
        }
      `,
    });
    const points = new THREE.Points(geometry, material); scene.add(points);
    const camera = new THREE.PerspectiveCamera(40, 1, radius / 1000, radius * 100);
    camera.position.copy(center).add(new THREE.Vector3(radius * 1.6, radius * 0.9, radius * 2.5));
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.copy(center); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = radius * 0.4; controls.maxDistance = radius * 12; controls.update(); controls.saveState();
    const resources: { dispose: () => void }[] = [];
    const ringCanvas = document.createElement('canvas'); ringCanvas.width = ringCanvas.height = 64;
    const ringBrush = ringCanvas.getContext('2d')!; ringBrush.beginPath(); ringBrush.arc(32, 32, 25, 0, Math.PI * 2); ringBrush.shadowBlur = 12; ringBrush.shadowColor = '#7ff7e9'; ringBrush.strokeStyle = '#d9fffb'; ringBrush.lineWidth = 4; ringBrush.stroke();
    const ringTexture = new THREE.CanvasTexture(ringCanvas), ringMaterial = new THREE.SpriteMaterial({ map: ringTexture, transparent: true, depthTest: false, depthWrite: false });
    const ring = new THREE.Sprite(ringMaterial); ring.scale.setScalar(radius * 0.13); ring.visible = false; ring.renderOrder = 10; scene.add(ring); selectionRing.current = ring; resources.push(ringTexture, ringMaterial);
    const label = (value: string, position: THREE.Vector3) => {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 64;
      const c = canvas.getContext('2d')!; c.fillStyle = '#b8d0da'; c.font = '25px DM Sans, sans-serif'; c.textAlign = 'center'; c.fillText(value, 160, 42);
      const texture = new THREE.CanvasTexture(canvas), material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(material); sprite.position.copy(position); sprite.scale.set(radius * 0.72, radius * 0.144, 1); scene.add(sprite); resources.push(texture, material);
    };
    const lo = data.axes.map(a => a.min), hi = data.axes.map(a => a.max);
    if (lo.length >= 3) {
      // Projection planes reveal depth without changing or jittering overlapping observations.
      const planeMaterial = new THREE.MeshBasicMaterial({ color: '#20546c', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
      const xSpan = Math.max(hi[0] - lo[0], 0.1), ySpan = Math.max(hi[1] - lo[1], 0.1), zSpan = Math.max(hi[2] - lo[2], 0.1);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(xSpan, zSpan), planeMaterial.clone()); floor.rotation.x = -Math.PI / 2; floor.position.set((lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2); scene.add(floor); resources.push(floor.geometry, floor.material);
      const rear = new THREE.Mesh(new THREE.PlaneGeometry(xSpan, ySpan), planeMaterial.clone()); rear.position.set((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]); scene.add(rear); resources.push(rear.geometry, rear.material);
      const grid = new THREE.GridHelper(Math.max(xSpan, zSpan), 10, '#2e7d8f', '#123b50'); grid.position.set((lo[0] + hi[0]) / 2, lo[1] + radius * 0.002, (lo[2] + hi[2]) / 2); (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.32; scene.add(grid); resources.push(grid.geometry, grid.material as THREE.Material);
      data.axes.slice(0, 3).forEach((axis, i) => {
        const start = new THREE.Vector3(lo[0], lo[1], lo[2]), end = start.clone(); end.setComponent(i, hi[i]);
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]), mat = new THREE.LineBasicMaterial({ color: '#7aa3b2', transparent: true, opacity: 0.72 }); scene.add(new THREE.Line(geo, mat)); resources.push(geo, mat);
        label(`${axis.key} (${(axis.explained_variance_ratio * 100).toFixed(1)}%)`, end.clone().addScaledVector(new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0), radius * 0.15));
        for (let k = 1; k <= 4; k++) { const value = lo[i] + (hi[i] - lo[i]) * k / 4; const position = start.clone(); position.setComponent(i, value); if (i === 1) position.x -= radius * 0.09; else position.y -= radius * 0.09; label(numberLabel(value), position); }
      });
    }
    const resize = () => { const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1); renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(host);
    const raycaster = new THREE.Raycaster(); raycaster.params.Points!.threshold = radius * 0.023;
    const pick = (e: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera); const hit = raycaster.intersectObject(points)[0]; return hit?.index === undefined ? null : data.points[hit.index]; };
    const move = (e: PointerEvent) => { const p = pick(e); const rect = host.getBoundingClientRect(); setHover(p ? { point: p, x: Math.max(0, Math.min(e.clientX - rect.left + 14, rect.width - 250)), y: e.clientY - rect.top + 14 } : null); host.style.cursor = p ? 'pointer' : 'grab'; };
    let downX = 0, downY = 0;
    const down = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; };
    const up = (e: PointerEvent) => { if (Math.hypot(e.clientX - downX, e.clientY - downY) < 5) { const p = pick(e); if (p) onSelect(p.sample_id); } };
    const leave = () => setHover(null);
    const lost = (e: Event) => { e.preventDefault(); setFailure('WebGL 上下文已丢失。请重新载入页面恢复点云；二维图与样品表仍可使用。'); };
    renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointerleave', leave); renderer.domElement.addEventListener('webglcontextlost', lost);
    let frame = 0;
    const render = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render); }; render();
    actions.current = { reset: () => controls.reset(), export: () => {
      const ratio=renderer.getPixelRatio(), size=renderer.getSize(new THREE.Vector2());
      renderer.setPixelRatio(1); renderer.setSize(4200,Math.round(4200*size.y/size.x),false);
      renderer.render(scene,camera);
      renderer.domElement.toBlob(blob => { if(blob) downloadBlob(blob,`REAL-${data.version}-PCA-${mode}.png`); },'image/png');
      renderer.setPixelRatio(ratio); renderer.setSize(size.x,size.y,false); renderer.render(scene,camera);
    } };
    return () => { cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); geometry.dispose(); material.dispose(); resources.forEach(r => r.dispose()); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointerleave', leave); renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.dispose(); renderer.domElement.remove(); actions.current = null; selectionRing.current = null; };
  }, [data, mode, minPL, maxPL, onSelect]);
  useEffect(() => {
    const ring = selectionRing.current; if (!ring) return;
    const point = data.points.find(p => p.sample_id === selected);
    ring.visible = Boolean(point);
    if (point) ring.position.set(point.PC1, point.PC2, point.PC3);
  }, [selected, data, mode]);
  return <section className="science-cloud" aria-labelledby="science-cloud-title">
    <header><div><h3 id="science-cloud-title">材料描述符空间 · {data.summary.projected} 个可投影样品</h3><p>当前 {data.summary.samples} 条记录中的有效子集。真实 PC1 / PC2 / PC3；拖动旋转、滚轮缩放、点击追溯。</p></div><div className="science-cloud-actions"><label>点云着色<select value={mode} onChange={e => setMode(e.target.value as ColorMode)}><option value="family">材料家族</option><option value="emission">发射峰 PL</option><option value="coverage">字段覆盖度</option></select></label><button className="science-action" onClick={() => actions.current?.reset()} disabled={!!failure || !data.points.length}><RotateCcw size={15} />重置视角</button><button className="science-action" onClick={() => actions.current?.export()} disabled={!!failure || !data.points.length}><Download size={15} />点云截图</button></div></header>
    <div className="science-cloud-frame"><div className="science-webgl" ref={mount} />{failure && <p className="science-cloud-fallback" role="status">{failure}</p>}{!data.points.length && <p className="science-cloud-fallback">当前范围没有可投影样品；不会以模拟点填充。</p>}{hover && <div className="science-tooltip" style={{left:hover.x,top:hover.y}}><strong>{hover.point.sample_id} · {hover.point.family}</strong><span>{hover.point.formula}</span><span>PL {hover.point.emission_nm ?? '缺失'} nm · {hover.point.available_fields}/{hover.point.total_fields} 字段</span><span>同坐标 {hover.point.coincident_count} 条记录（未抖动）</span></div>}</div>
    <div className="science-cloud-note"><span>可投影 {data.summary.projected} / 当前 {data.summary.samples} 个样品。坐标由后端计算，不代表预测结果。</span>{mode !== 'family' && <span>{mode === 'coverage' ? '蓝 → 绿：覆盖度 0 → 100%' : `蓝 → 橙：${Number.isFinite(minPL) ? numberLabel(minPL) : '—'} → ${Number.isFinite(maxPL) ? numberLabel(maxPL) : '—'} nm；灰色为缺失`}</span>}</div>
    <details className="science-method"><summary>投影轴与主要载荷</summary>{data.axes.map(axis => <p key={axis.key}><b>{axis.key} · {(axis.explained_variance_ratio * 100).toFixed(1)}%</b>{' · '}{axis.top_loadings.map(v => `${v.feature} (${numberLabel(v.weight)})`).join(' · ') || '当前响应未提供载荷'}</p>)}</details>
  </section>;
}
