import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEvidenceGalaxy } from '../src/workbench/evidence-galaxy.ts';

const records = [
  { sample_id: 'S-01', doi: '10.1000/shared', family: 'YAG', formula: 'YAG:Ce', material_form: 'ceramic', emission_nm: 550, available_fields: 9, total_fields: 12, coverage_fraction: 0.75, status: 'formal' },
  { sample_id: 'S-02', doi: '10.1000/shared', family: 'YAG', formula: 'YAG:Ce', material_form: 'ceramic', emission_nm: 555, available_fields: 8, total_fields: 12, coverage_fraction: 0.67, status: 'formal' },
  { sample_id: 'S-03', doi: '10.1000/shared', family: 'LuAG', formula: 'LuAG:Ce', material_form: 'ceramic', emission_nm: 510, available_fields: 10, total_fields: 12, coverage_fraction: 0.83, status: 'formal' },
  { sample_id: 'S-04', doi: '', family: 'LuAG', formula: 'LuAG:Ce', material_form: 'ceramic', emission_nm: null, available_fields: 5, total_fields: 12, coverage_fraction: 0.42, status: 'formal' },
];

test('evidence galaxy preserves one leaf per record and only auditable membership edges', () => {
  const graph = buildEvidenceGalaxy(records, 'fixture-v1');
  assert.deepEqual(graph.counts, { samples: 4, dois: 1, families: 2, unresolved: 1 });
  assert.equal(graph.nodes.filter(node => node.kind === 'database').length, 1);
  assert.equal(graph.nodes.filter(node => node.kind === 'family').length, 2);
  assert.equal(graph.nodes.filter(node => node.kind === 'doi').length, 2);
  assert.deepEqual(graph.nodes.filter(node => node.kind === 'sample').map(node => node.sample_id).sort(), ['S-01', 'S-02', 'S-03', 'S-04']);
  assert.equal(graph.edges.filter(edge => edge.kind === 'database-family').length, 2);
  assert.equal(graph.edges.filter(edge => edge.kind === 'family-doi').length, 3);
  assert.equal(graph.edges.filter(edge => edge.kind === 'doi-sample').length, 4);
  const shared = graph.nodes.find(node => node.kind === 'doi' && node.doi === '10.1000/shared');
  assert.equal(graph.edges.filter(edge => edge.target === shared?.id && edge.kind === 'family-doi').length, 2);
});

test('evidence galaxy layout is deterministic and finite', () => {
  const first = buildEvidenceGalaxy(records, 'fixture-v1');
  const second = buildEvidenceGalaxy([...records].reverse(), 'fixture-v1');
  assert.deepEqual(first, second);
  for (const node of first.nodes) assert.ok(node.position.every(Number.isFinite), `${node.id} has a non-finite coordinate`);
});

