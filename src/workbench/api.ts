export type User = { id: number; username: string; display_name: string; role: "owner" | "contributor" };

export type DocumentRecord = {
  id: number;
  canonical_filename: string;
  sha256: string;
  sha256_short: string;
  size_bytes: number;
  doi_candidates: string[];
  doi_confirmed: string | null;
  target_family: string | null;
  target_fields: string[];
  workflow_status: string;
  owner_name: string;
  location_count: number;
  duplicate: boolean;
};

export type DatabaseHealth = {
  version: string;
  audited_on: string;
  metrics: Record<string, number>;
  family_counts: { family: string; samples: number }[];
  descriptor_coverage: { field: string; count: number; total: number; source: string }[];
  model_readiness: { model: string; ready: number; total: number; status: string }[];
  candidate_packages: number;
  authority_write_enabled: boolean;
};

export type Dashboard = {
  documents: {
    unique_pdf: number;
    locations: number;
    duplicate_groups: number;
    ready_for_extraction: number;
    candidate_ready: number;
  };
  database: DatabaseHealth;
  jobs: JobRecord[];
  weekly: {
    external_ce_rt_rows: number;
    external_deduplicated_rows: number;
    core_samples: number;
    exact_hosts: number;
    pdf_files: number;
    unique_pdfs: number;
    duplicate_groups: number;
    priority_dois: number;
    lee_tasks: { name: string; rows: number; hosts: number; r2: number }[];
  };
};

export type JobRecord = {
  id: number;
  canonical_filename?: string;
  status: string;
  stage: string;
  progress: number;
  message: string;
  updated_at: string;
  package_path?: string;
  error_message?: string;
};

export type CandidatePackage = {
  job: JobRecord;
  metadata: Record<string, string | string[]>;
  tables: Record<string, Record<string, string>[]>;
};

export type FigureRecord = {
  id: string; title: string; path: string; statistics: string;
  width_px: number; height_px: number; mode: string; sha256: string;
  phenomenon: string; judgment: string; next_step: string;
};

export type FigureRelease = {
  database_version: string; release_version: string; generated_at_utc: string;
  asset_base_url: string; figures: FigureRecord[];
  metrics: Record<string, number>; source_sha256: Record<string, string>;
};

export type FigureJob = {
  id: number; status: "queued" | "running" | "complete" | "failed";
  stage: string; progress: number; message: string; database_version: string;
  error_message?: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(body.detail || body.error?.message || `请求失败 ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<User>("/api/v1/session/me"),
  login: (username: string, password: string) =>
    request<User>("/api/v1/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/v1/session/logout", { method: "POST" }),
  health: () => request<{ openai_configured: boolean }>("/api/v1/health"),
  dashboard: () => request<Dashboard>("/api/v1/dashboard"),
  documents: () => request<{ items: DocumentRecord[] }>("/api/v1/documents"),
  upload: (files: File[]) => {
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    return request<{ items: unknown[] }>("/api/v1/documents", { method: "POST", body });
  },
  scan: () => request<{ scanned: number }>("/api/v1/documents/scan", { method: "POST" }),
  updateDocument: (id: number, doi: string, family: string, fields: string[]) =>
    request<DocumentRecord>(`/api/v1/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doi_confirmed: doi, target_family: family, target_fields: fields }),
    }),
  extract: (id: number) =>
    request<{ job_id: number }>(`/api/v1/documents/${id}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm_send_to_openai: true }),
    }),
  databaseHealth: () => request<DatabaseHealth>("/api/v1/database/health"),
  priorities: () => request<{ items: { doi: string; route: string; priority: string }[]; rule: string }>("/api/v1/literature/priorities"),
  candidatePackage: (jobId: number) => request<CandidatePackage>(`/api/v1/packages/${jobId}`),
  saveTable: (jobId: number, table: string, rows: Record<string, string>[]) =>
    request<{ ok: boolean }>(`/api/v1/packages/${jobId}/tables/${table}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    }),
  review: (jobId: number, decision: string, notes: string) =>
    request<{ decision: string }>(`/api/v1/packages/${jobId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, notes }),
    }),
  latestFigures: () => request<FigureRelease>("/api/v1/figures/releases/latest"),
  renderFigures: () => request<{ job_id: number; database_version: string }>("/api/v1/figures/render", { method: "POST" }),
  figureJob: (jobId: number) => request<FigureJob>(`/api/v1/figures/jobs/${jobId}`),
};
