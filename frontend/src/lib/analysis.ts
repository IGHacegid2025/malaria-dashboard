// Author: Khadim Gueye

import type {
  AlertRule,
  HrpRow,
  MisRow,
  MoiRow,
  Observation,
  Publication,
  SpeciesRow,
  WhoStatus,
} from "../api";

export type Classification = "low" | "intermediate" | "high" | "none";

export interface Selection {
  year: number;
  states: string[];
}

export interface MarkerSummary {
  key: string;
  gene: string;
  mutation: string;
  prevalence: number;
  samples: number;
  statesTested: number;
  statesDetected: number;
  antimalarial: string;
  classification: Classification;
  message: string | null;
  summary: string | null;
  lowerBound: number;
  upperBound: number;
  thresholds: number[];
  whoStatus: WhoStatus;
}

export const SEQUENCING_SOURCE = "Aniebo I., unpublished data";

export const SPECIES_LABELS: Record<string, string> = {
  pf: "P. falciparum",
  pm: "P. malariae",
  po: "P. ovale",
  pv: "P. vivax",
  pk: "P. knowlesi",
};

export function inSelection<T extends { year: number; state: string }>(row: T, sel: Selection) {
  return row.year === sel.year && (sel.states.length === 0 || sel.states.includes(row.state));
}

export function weightedPrevalence(rows: { prevalence: number; sample_count: number | null }[]) {
  let weighted = 0;
  let total = 0;
  for (const row of rows) {
    const n = row.sample_count ?? 1;
    weighted += Number(row.prevalence) * n;
    total += n;
  }
  return total > 0 ? weighted / total : 0;
}

export function findRule(alerts: AlertRule[], gene: string, pattern: string) {
  return (
    alerts.find((r) => r.gene === gene && r.mutation_pattern === pattern) ??
    alerts.find((r) => r.gene === gene && r.mutation_pattern === "*") ??
    null
  );
}

export function classify(rule: AlertRule | null, prevalence: number) {
  if (!rule || rule.levels.length === 0) {
    return { classification: "none" as Classification, message: null, summary: null, lower: 0, upper: 1 };
  }
  const levels = [...rule.levels].sort((a, b) => a.level_order - b.level_order);
  let lower = 0;
  for (const level of levels) {
    const upper = Number(level.max_prevalence);
    if (prevalence <= upper + 1e-9) {
      return {
        classification: level.classification as Classification,
        message: level.message,
        summary: level.summary,
        lower,
        upper,
      };
    }
    lower = upper;
  }
  const last = levels[levels.length - 1];
  return {
    classification: last.classification as Classification,
    message: last.message,
    summary: last.summary,
    lower,
    upper: 1,
  };
}

export function summariseMarkers(observations: Observation[], alerts: AlertRule[], sel: Selection) {
  const groups = new Map<string, Observation[]>();
  for (const row of observations) {
    if (!inSelection(row, sel)) continue;
    const key = `${row.gene}|${row.mutation}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const markers: MarkerSummary[] = [];
  for (const [key, rows] of groups) {
    const { gene, mutation } = rows[0];
    const prevalence = weightedPrevalence(rows);
    const rule = findRule(alerts, gene, mutation);
    const level = classify(rule, prevalence);
    const tested = new Set(rows.map((r) => r.state));
    const detected = new Set(rows.filter((r) => Number(r.prevalence) > 0).map((r) => r.state));
    markers.push({
      key,
      gene,
      mutation,
      prevalence,
      samples: rows.reduce((sum, r) => sum + (r.sample_count ?? 0), 0),
      statesTested: tested.size,
      statesDetected: detected.size,
      antimalarial: rule?.antimalarial && rule.antimalarial !== "general" ? rule.antimalarial : "other markers",
      classification: prevalence > 0 ? level.classification : "none",
      message: prevalence > 0 ? level.message : null,
      summary: prevalence > 0 ? level.summary : null,
      lowerBound: level.lower,
      upperBound: level.upper,
      thresholds: (rule?.levels ?? []).map((l) => Number(l.max_prevalence)).filter((t) => t > 0 && t < 1),
      whoStatus: rule && rule.mutation_pattern === mutation ? rule.who_status ?? "none" : "none",
    });
  }
  return markers.sort((a, b) => b.prevalence - a.prevalence);
}

export interface DrugOutlook {
  drug: string;
  classification: Classification;
  topMarker: MarkerSummary | null;
  detected: number;
  tested: number;
  summary: string | null;
  validated: MarkerSummary[];
  candidates: MarkerSummary[];
  validatedTested: number;
  candidatesTested: number;
  others: MarkerSummary[];
}

const WHO_RANK: Record<WhoStatus, number> = { validated: 2, candidate: 1, none: 0 };

const SEVERITY: Record<Classification, number> = { none: 0, low: 1, intermediate: 2, high: 3 };

export const DRUG_CONTEXT: Record<string, string> = {
  artemisinin: "Core of every first-line malaria treatment (ACTs)",
  "artemether-lumefantrine": "Most widely used first-line treatment in Nigeria",
  "artesunate-amodiaquine": "Alternative first-line treatment",
  piperaquine: "Partner drug in dihydroartemisinin-piperaquine",
  chloroquine: "Former treatment, no longer recommended in Nigeria",
  "sulfadoxine/pyrimethamine": "Protects pregnant women (IPTp) and young children (SMC)",
  pyrimethamine: "Component of sulfadoxine-pyrimethamine",
};

export const DRUG_ORDER = [
  "artemisinin",
  "artemether-lumefantrine",
  "artesunate-amodiaquine",
  "sulfadoxine/pyrimethamine",
  "piperaquine",
  "chloroquine",
  "pyrimethamine",
];

export function summariseDrugs(markers: MarkerSummary[]): DrugOutlook[] {
  const groups = new Map<string, MarkerSummary[]>();
  for (const m of markers) {
    if (m.antimalarial === "other markers") continue;
    const list = groups.get(m.antimalarial);
    if (list) list.push(m);
    else groups.set(m.antimalarial, [m]);
  }
  const result: DrugOutlook[] = [];
  for (const [drug, list] of groups) {
    const detected = [...list.filter((m) => m.prevalence > 0)].sort(
      (a, b) =>
        WHO_RANK[b.whoStatus] - WHO_RANK[a.whoStatus] ||
        SEVERITY[b.classification] - SEVERITY[a.classification] ||
        b.prevalence - a.prevalence,
    );
    const top = detected[0];
    result.push({
      drug,
      classification: top ? top.classification : "none",
      topMarker: top ?? null,
      detected: detected.length,
      tested: list.length,
      summary: top?.summary ?? null,
      validated: detected.filter((m) => m.whoStatus === "validated").sort((a, b) => b.prevalence - a.prevalence),
      candidates: detected.filter((m) => m.whoStatus === "candidate").sort((a, b) => b.prevalence - a.prevalence),
      validatedTested: list.filter((m) => m.whoStatus === "validated").length,
      candidatesTested: list.filter((m) => m.whoStatus === "candidate").length,
      others: detected.slice(1),
    });
  }
  return result.sort((a, b) => {
    const ia = DRUG_ORDER.indexOf(a.drug);
    const ib = DRUG_ORDER.indexOf(b.drug);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export function markerByState(observations: Observation[], gene: string, mutation: string, year: number) {
  const groups = new Map<string, Observation[]>();
  for (const row of observations) {
    if (row.year !== year || row.gene !== gene || row.mutation !== mutation) continue;
    const list = groups.get(row.state);
    if (list) list.push(row);
    else groups.set(row.state, [row]);
  }
  const result = new Map<string, { value: number; samples: number }>();
  for (const [state, rows] of groups) {
    result.set(state, {
      value: weightedPrevalence(rows),
      samples: rows.reduce((sum, r) => sum + (r.sample_count ?? 0), 0),
    });
  }
  return result;
}

export function misByState(mis: MisRow[], year?: number) {
  const years = [...new Set(mis.map((r) => r.year))].sort((a, b) => a - b);
  const latestYear = year !== undefined ? year : years[years.length - 1] ?? 0;
  const result = new Map<string, { value: number; samples: number }>();
  for (const row of mis) {
    if (row.year === latestYear) result.set(row.state, { value: Number(row.prevalence), samples: 0 });
  }
  return { year: latestYear, values: result };
}

export interface HrpSummary {
  tested: number;
  hrp2: number;
  hrp3: number;
  dual: number;
  hrp2Prevalence: number;
  hrp3Prevalence: number;
}

export function summariseHrp(rows: HrpRow[], sel: Selection): HrpSummary {
  const counts = { hrp2: 0, hrp3: 0, dual: 0, none: 0 };
  for (const row of rows) {
    if (!inSelection(row, sel)) continue;
    counts[row.deletion_type] += row.sample_count;
  }
  const tested = counts.hrp2 + counts.hrp3 + counts.dual + counts.none;
  return {
    tested,
    hrp2: counts.hrp2,
    hrp3: counts.hrp3,
    dual: counts.dual,
    hrp2Prevalence: tested ? (counts.hrp2 + counts.dual) / tested : 0,
    hrp3Prevalence: tested ? (counts.hrp3 + counts.dual) / tested : 0,
  };
}

export function summariseMoi(rows: MoiRow[], sel: Selection) {
  const byValue = new Map<number, number>();
  for (const row of rows) {
    if (!inSelection(row, sel)) continue;
    byValue.set(row.moi_value, (byValue.get(row.moi_value) ?? 0) + row.sample_count);
  }
  let total = 0;
  let weighted = 0;
  let polyclonal = 0;
  const undetermined = byValue.get(0) ?? 0;
  for (const [value, n] of byValue) {
    if (value < 1) continue;
    total += n;
    weighted += value * n;
    if (value > 1) polyclonal += n;
  }
  const maxValue = Math.max(0, ...byValue.keys());
  const histogram = Array.from({ length: maxValue }, (_, i) => ({
    moi: i + 1,
    samples: byValue.get(i + 1) ?? 0,
  }));
  return {
    total,
    undetermined,
    sequenced: total + undetermined,
    mean: total ? weighted / total : 0,
    polyclonalShare: total ? polyclonal / total : 0,
    histogram,
  };
}

export function summariseSpecies(rows: SpeciesRow[], sel: Selection) {
  const combos = new Map<string, number>();
  const species = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    if (!inSelection(row, sel)) continue;
    combos.set(row.species_combination, (combos.get(row.species_combination) ?? 0) + row.sample_count);
    for (const sp of row.species_combination.split(",")) {
      species.set(sp, (species.get(sp) ?? 0) + row.sample_count);
    }
    total += row.sample_count;
  }
  const toList = (m: Map<string, number>) =>
    [...m.entries()].map(([name, samples]) => ({ name, samples })).sort((a, b) => b.samples - a.samples);
  return { total, species: toList(species), combinations: toList(combos) };
}

export interface SourceEntry {
  label: string;
  doi: string | null;
  title: string | null;
  kind: "sequencing" | "publication";
  dataPoints: number;
  states: string[];
  markers: string[];
}

export function collectSources(
  observations: Observation[],
  hrp: HrpRow[],
  publications: Publication[],
  sel: Selection,
): SourceEntry[] {
  const byKey = new Map(publications.map((p) => [`${p.author}|${p.year_of_publication}`, p]));
  const entries = new Map<string, SourceEntry & { stateSet: Set<string>; markerSet: Set<string> }>();
  const touch = (kind: "sequencing" | "publication", author: string | null, year: number | null) => {
    const key = kind === "sequencing" ? "sequencing" : `${author}|${year}`;
    let entry = entries.get(key);
    if (!entry) {
      const pub = kind === "publication" ? byKey.get(key) : undefined;
      entry = {
        label: kind === "sequencing" ? SEQUENCING_SOURCE : `${author}, ${year}`,
        doi: pub?.doi ?? null,
        title: kind === "sequencing" ? "IGH genomic surveillance, sequencing data" : pub?.title ?? null,
        kind,
        dataPoints: 0,
        states: [],
        markers: [],
        stateSet: new Set(),
        markerSet: new Set(),
      };
      entries.set(key, entry);
    }
    return entry;
  };
  for (const row of observations) {
    if (!inSelection(row, sel)) continue;
    if (row.source_type === "publication" && (!row.author || !row.year_of_publication)) continue;
    const entry = touch(row.source_type, row.author, row.year_of_publication);
    entry.dataPoints += 1;
    entry.stateSet.add(row.state);
    if (Number(row.prevalence) > 0) entry.markerSet.add(`${row.gene} ${row.mutation}`);
  }
  for (const row of hrp) {
    if (!inSelection(row, sel)) continue;
    if (row.source_type === "publication" && (!row.author || !row.year_of_publication)) continue;
    const entry = touch(row.source_type, row.author, row.year_of_publication);
    entry.dataPoints += 1;
    entry.stateSet.add(row.state);
    if (row.deletion_type !== "none") entry.markerSet.add(`${row.deletion_type} deletion`);
  }
  return [...entries.values()]
    .map(({ stateSet, markerSet, ...rest }) => ({ ...rest, states: [...stateSet].sort(), markers: [...markerSet].sort() }))
    .sort((a, b) => (a.kind === b.kind ? b.dataPoints - a.dataPoints : a.kind === "sequencing" ? -1 : 1));
}

export function availableYears(observations: Observation[], hrp: HrpRow[]) {
  const years = new Set<number>();
  observations.forEach((r) => years.add(r.year));
  hrp.forEach((r) => years.add(r.year));
  return [...years].sort((a, b) => a - b);
}

export function busiestYear(observations: Observation[]) {
  const counts = new Map<number, number>();
  observations.forEach((r) => counts.set(r.year, (counts.get(r.year) ?? 0) + 1));
  let best = 0;
  let bestCount = -1;
  for (const [year, count] of counts) {
    if (count > bestCount || (count === bestCount && year > best)) {
      best = year;
      bestCount = count;
    }
  }
  return best;
}

export function isWidespreadUnconfirmed(d: DrugOutlook) {
  const top = d.topMarker;
  return top !== null && top.whoStatus !== "validated" && d.classification === "intermediate" && top.prevalence > 0.6;
}

export function formatPercent(value: number, digits = 1) {
  const pct = value * 100;
  if (pct > 0 && pct < 0.1 && digits <= 1) return "<0.1%";
  return `${pct.toFixed(digits)}%`;
}

export function titleCase(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
