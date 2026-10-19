import type { ExplorerRecord } from './explorer-data';

export type GalaxyNodeKind = 'database' | 'family' | 'doi' | 'sample';
export type GalaxyEdgeKind = 'database-family' | 'family-doi' | 'doi-sample';
export type Vec3Tuple = [number, number, number];

export type GalaxyNode = {
  id: string;
  kind: GalaxyNodeKind;
  label: string;
  position: Vec3Tuple;
  count: number;
  family?: string;
  doi?: string;
  sample_id?: string;
  unresolved?: boolean;
  record?: ExplorerRecord;
};

export type GalaxyEdge = {
  id: string;
  kind: GalaxyEdgeKind;
  source: string;
  target: string;
  family?: string;
};

export type EvidenceGalaxy = {
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
  counts: { samples: number; dois: number; families: number; unresolved: number };
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const normaliseDoi = (value: string) => value.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/^doi:\s*/, '');
const familyOf = (record: ExplorerRecord) => record.family.trim() || '未分类家族';
const add = (a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3Tuple, value: number): Vec3Tuple => [a[0] * value, a[1] * value, a[2] * value];
const cross = (a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vec3Tuple) => Math.hypot(...a);
const unit = (a: Vec3Tuple, fallback: Vec3Tuple = [0, 1, 0]): Vec3Tuple => {
  const magnitude = length(a);
  return magnitude > 1e-8 ? scale(a, 1 / magnitude) : fallback;
};

function hash32(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function spherePoint(index: number, total: number, key: string): Vec3Tuple {
  const y = total <= 1 ? 0 : 1 - 2 * ((index + 0.5) / total);
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const phase = (hash32(key) % 4096) / 4096 * Math.PI * 2;
  const theta = index * GOLDEN_ANGLE + phase;
  return [Math.cos(theta) * radius, y, Math.sin(theta) * radius];
}

function tangentBasis(direction: Vec3Tuple): [Vec3Tuple, Vec3Tuple] {
  const reference: Vec3Tuple = Math.abs(direction[1]) < 0.82 ? [0, 1, 0] : [1, 0, 0];
  const u = unit(cross(direction, reference), [1, 0, 0]);
  return [u, unit(cross(direction, u), [0, 0, 1])];
}

function branchPosition(direction: Vec3Tuple, index: number, total: number, radius: number, key: string, spread: number): Vec3Tuple {
  const [u, v] = tangentBasis(direction);
  const phase = (hash32(key) % 8192) / 8192 * Math.PI * 2;
  const theta = phase + index * GOLDEN_ANGLE;
  const radialSpread = spread * Math.sqrt((index + 0.65) / Math.max(total, 1));
  const offset = add(scale(u, Math.cos(theta) * radialSpread), scale(v, Math.sin(theta) * radialSpread));
  return scale(unit(add(direction, offset), direction), radius);
}

export function buildEvidenceGalaxy(input: ExplorerRecord[], version: string): EvidenceGalaxy {
  const records = [...input].sort((a, b) => a.sample_id.localeCompare(b.sample_id));
  const families = [...new Set(records.map(familyOf))].sort((a, b) => a.localeCompare(b));
  const familyDirections = new Map<string, Vec3Tuple>();
  families.forEach((family, index) => familyDirections.set(family, spherePoint(index, families.length, `${version}:${family}`)));

  const doiRecords = new Map<string, ExplorerRecord[]>();
  for (const record of records) {
    const doi = normaliseDoi(record.doi);
    const key = doi ? `doi:${doi}` : `missing:${familyOf(record)}`;
    doiRecords.set(key, [...(doiRecords.get(key) ?? []), record]);
  }

  const nodes: GalaxyNode[] = [{ id: 'database', kind: 'database', label: `REAL · ${version}`, position: [0, 0, 0], count: records.length }];
  const edges: GalaxyEdge[] = [];
  for (const family of families) {
    const familyRecords = records.filter(record => familyOf(record) === family);
    const id = `family:${family}`;
    nodes.push({ id, kind: 'family', label: family, position: scale(familyDirections.get(family)!, 4.2), count: familyRecords.length, family });
    edges.push({ id: `database>${id}`, kind: 'database-family', source: 'database', target: id, family });
  }

  const doiEntries = [...doiRecords.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [doiKey, group] of doiEntries) {
    const groupFamilies = [...new Set(group.map(familyOf))].sort((a, b) => a.localeCompare(b));
    const familyDirection = unit(groupFamilies.reduce<Vec3Tuple>((sum, family) => add(sum, familyDirections.get(family)!), [0, 0, 0]), spherePoint(0, 1, doiKey));
    const doiDirection = branchPosition(familyDirection, hash32(doiKey) % 29, 29, 1, doiKey, 0.28);
    const unresolved = doiKey.startsWith('missing:');
    const doi = unresolved ? '' : doiKey.slice(4);
    const doiId = doiKey;
    nodes.push({ id: doiId, kind: 'doi', label: unresolved ? 'DOI待确认' : doi, position: scale(unit(doiDirection), 7.1), count: group.length, doi, unresolved });
    for (const family of groupFamilies) {
      edges.push({ id: `family:${family}>${doiId}`, kind: 'family-doi', source: `family:${family}`, target: doiId, family });
    }
    const direction = unit(doiDirection);
    group.forEach((record, index) => {
      const sampleId = `sample:${record.sample_id}`;
      nodes.push({ id: sampleId, kind: 'sample', label: record.sample_id, position: branchPosition(direction, index, group.length, 10.25 + (hash32(record.sample_id) % 100) / 210, record.sample_id, 0.34), count: 1, family: familyOf(record), doi, sample_id: record.sample_id, unresolved, record });
      edges.push({ id: `${doiId}>${sampleId}`, kind: 'doi-sample', source: doiId, target: sampleId, family: familyOf(record) });
    });
  }

  return {
    nodes,
    edges,
    counts: {
      samples: records.length,
      dois: new Set(records.map(record => normaliseDoi(record.doi)).filter(Boolean)).size,
      families: families.length,
      unresolved: records.filter(record => !normaliseDoi(record.doi)).length,
    },
  };
}
