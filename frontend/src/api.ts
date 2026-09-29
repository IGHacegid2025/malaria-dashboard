// Author: Khadim Gueye

const API_BASE = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}/api`;

export type SourceType = "publication" | "sequencing";
export type WhoStatus = "validated" | "candidate" | "none";

export interface TeamMember {
  id: number;
  name: string;
  title: string | null;
  affiliation: string | null;
  bio: string | null;
  photo_url: string | null;
  email: string | null;
  linkedin_url: string | null;
  is_alumni: number;
  is_lead: number;
}

export interface Activity {
  id: number;
  title: string;
  category: string | null;
  description: string | null;
  activity_date: string | null;
  image_url: string | null;
  link_url: string | null;
  is_featured: number;
}

export interface GeneFlowNode {
  id: string;
  samples: number;
  outdegree: number;
  indegree: number;
  out_flow: number;
  in_flow: number;
  betweenness: number;
  closeness: number;
  source_hub_ratio: number;
}

export interface GeneFlowLink {
  source: string;
  target: string;
  weight: number;
}

export interface GeneFlow {
  year: number;
  nodes: GeneFlowNode[];
  links: GeneFlowLink[];
  tips: number;
  matched_tips: number;
  transitions: number;
  method: string;
}

export interface ReportRequest {
  name: string;
  email: string;
  organization?: string;
  page?: string;
}

export interface StateInfo {
  code: string;
  name: string;
}

export interface MutationInfo {
  id: number;
  mutation_code: string;
  gene: string;
}

export interface Observation {
  state: string;
  state_name: string;
  year: number;
  gene: string;
  mutation: string;
  prevalence: number;
  sample_count: number | null;
  source_type: SourceType;
  city: string | null;
  author: string | null;
  year_of_publication: number | null;
  doi: string | null;
}

export interface SpeciesRow {
  state: string;
  state_name: string;
  year: number;
  species_combination: string;
  sample_count: number;
  source_type: SourceType;
}

export interface HrpRow {
  state: string;
  state_name: string;
  year: number;
  deletion_type: "hrp2" | "hrp3" | "dual" | "none";
  any_hrp_mutation: number | null;
  location: string | null;
  sample_count: number;
  source_type: SourceType;
  author: string | null;
  year_of_publication: number | null;
}

export interface MoiRow {
  state: string;
  state_name: string;
  year: number;
  moi_value: number;
  sample_count: number;
}

export interface MisRow {
  state: string;
  state_name: string;
  year: number;
  prevalence: number;
}

export interface Publication {
  id: number;
  author: string;
  year_of_publication: number;
  doi: string | null;
  title: string | null;
  observation_count: number;
}

export interface AlertLevel {
  level_order: number;
  max_prevalence: number;
  classification: "low" | "intermediate" | "high";
  message: string | null;
  summary: string | null;
}

export interface AlertRule {
  id: number;
  gene: string;
  mutation_pattern: string;
  who_status: WhoStatus;
  antimalarial: string | null;
  resistance_level: string | null;
  reference_text: string | null;
  levels: AlertLevel[];
}

export interface TimelinePoint {
  state: string;
  state_name: string;
  year: number;
  prevalence: number;
  sample_count: number | null;
  source_type: SourceType;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Request failed: ${path} (${res.status})`);
  }
  return res.json();
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });
  if (!res.ok) {
    const detail = await res.json().then((d) => d?.detail, () => null);
    throw new Error(typeof detail === "string" ? detail : `Request failed (${res.status})`);
  }
}

export const api = {
  states: () => get<StateInfo[]>("/states"),
  genes: () => get<{ id: number; name: string }[]>("/genes"),
  mutations: (gene?: string) =>
    get<MutationInfo[]>(`/mutations${gene ? `?gene=${encodeURIComponent(gene)}` : ""}`),
  observations: () => get<Observation[]>("/observations"),
  species: () => get<SpeciesRow[]>("/species"),
  hrpDeletions: () => get<HrpRow[]>("/hrp-deletions"),
  moi: () => get<MoiRow[]>("/moi"),
  misCases: () => get<MisRow[]>("/mis-cases"),
  publications: () => get<Publication[]>("/publications"),
  alerts: () => get<AlertRule[]>("/alerts"),
  team: () => get<TeamMember[]>("/team"),
  activities: () => get<Activity[]>("/activities"),
  partners: () => get<Partner[]>("/partners"),
  geneFlowYears: () => get<number[]>("/genomics/gene-flow/years"),
  geneFlow: (year: number) => get<GeneFlow>(`/genomics/gene-flow/${year}`),
  track: (body: { visitor_id: string; path: string; referrer?: string }) => post("/track", body),
  requestReport: (body: ReportRequest) => post("/report-requests", body),
  mutationTimeline: (gene: string, mutation: string, state?: string) => {
    const query = new URLSearchParams({ gene, mutation });
    if (state) query.set("state", state);
    return get<TimelinePoint[]>(`/mutation-timeline?${query.toString()}`);
  },
};

export interface Partner {
  id: number;
  kind: "project" | "partner";
  name: string;
  description: string | null;
  logo_url: string | null;
  link_url: string | null;
}
