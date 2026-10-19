export type Summary = {
  version: string;
  options: { families: string[]; material_forms: string[] };
  summary: { samples: number; doi: number; families: number };
  aggregates: {
    family_counts: { family: string; count: number }[];
    emission_histogram: { lower_nm: number; upper_nm: number; count: number }[];
    field_coverage: { available: number; possible: number };
  };
};

export async function fetchPublicSummary(signal?: AbortSignal): Promise<Summary> {
  const root = `${import.meta.env.BASE_URL}workbench/public-data/`;
  async function read(url: string) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('公开汇总读取失败，请重试。');
    return response.json();
  }
  const latest = await read(root + 'latest.json');
  const manifest = await read(root + latest.release);
  const data = await read(root + latest.release.replace(/manifest\.json$/, '') + manifest.scopes['formal||']);
  if (!data.aggregates || 'records' in data || 'points' in data) throw new Error('公开数据须为汇总格式。');
  return data;
}
