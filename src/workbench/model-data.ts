import type { ExplorerRecord } from './explorer-data';
export type Conditions = Record<'sample_thickness_mm' | 'sintering_temperature_c' | 'sintering_time_h' | 'annealing_temperature_c' | 'annealing_time_h', number | null>;
export type ModelRecord = ExplorerRecord & { conditions: Conditions; excitation_observed_ev: number | null };
export type ModelPrediction = { route: string; sample_id: string; seed: number; fold: number; actual_nm: number; predicted_nm: number; excitation_ev: number; latent_loss_ev: number; correction_ev: number; emission_ev: number; net_loss_ev: number };
export type ModelMetric = { route: string; name: string; mae: number; mae_sd: number; rmse: number; rmse_sd: number; r2: number; r2_sd: number };
export type ModelData = { schema_version: number; version: string; date: string; database_version: string; n: number; paired: number; seeds: number[]; metrics: ModelMetric[]; records: ModelRecord[]; predictions: ModelPrediction[]; validation: string; source_hashes: Record<string,string> };
export const modelAssets = `${import.meta.env.BASE_URL}workbench/`;
export const conditionLabels: [keyof Conditions, string, string][] = [['sample_thickness_mm','厚度','mm'],['sintering_temperature_c','烧结温度','°C'],['sintering_time_h','烧结时间','h'],['annealing_temperature_c','退火温度','°C'],['annealing_time_h','退火时间','h']];
export async function fetchModelData(signal: AbortSignal): Promise<ModelData> {
  const response = await fetch(`${modelAssets}public-data/research-20261029.json`, { signal });
  if (!response.ok) throw new Error(`模型结果读取失败（${response.status}）`);
  const body = await response.json() as ModelData;
  if (body.schema_version !== 2 || !body.metrics?.length || !body.records?.length || !body.predictions?.length || !body.seeds?.length) throw new Error('模型结果版本不完整');
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  const ids = new Set(body.records.map(r => r.sample_id)), keys = new Set<string>();
  for (const r of body.records) if (!r.conditions || conditionLabels.some(([key]) => r.conditions[key] !== null && !finite(r.conditions[key]))) throw new Error('样品条件记录不完整');
  for (const p of body.predictions) {
    const key = `${p.route}|${p.seed}|${p.sample_id}`;
    if (keys.has(key) || !ids.has(p.sample_id) || ![p.actual_nm,p.predicted_nm,p.excitation_ev,p.latent_loss_ev,p.correction_ev,p.emission_ev].every(finite) || p.emission_ev <= 0 || Math.abs(p.excitation_ev-p.latent_loss_ev+p.correction_ev-p.emission_ev)>1e-9) throw new Error('预测记录与物理分解不一致');
    keys.add(key);
  }
  if (body.metrics.some(m => body.seeds.some(seed => body.predictions.filter(p => p.route === m.route && p.seed === seed).length !== body.records.length))) throw new Error('模型验证覆盖不完整');
  return body;
}
