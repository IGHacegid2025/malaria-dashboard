// Author: Khadim Gueye

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { HrpRow, Observation } from "../api";
import HeroBackdrop from "../components/HeroBackdrop";
import InfoTip, { GLOSSARY } from "../components/InfoTip";
import { CountUp } from "../components/Motion";
import NigeriaMap from "../components/NigeriaMap";
import { EmptyState } from "../components/Panels";
import StatusBadge from "../components/StatusBadge";
import { useFilters } from "../filters";
import SurveySource from "../components/SurveySource";
import { surveyName } from "../lib/surveys";
import { useDashboardData, type DashboardData } from "../hooks/useDashboardData";
import {
  DRUG_ORDER,
  classify,
  findRule,
  formatPercent,
  misByState,
  titleCase,
  weightedPrevalence,
  type Classification,
} from "../lib/analysis";

const PLAY_MS = 1400;

type Theme = "drug" | "diagnostic" | "children";

interface ClassDef {
  label: string;
  color: string;
  test: (v: number) => boolean;
}

interface StateValue {
  value: number;
  samples: number;
  year: number;
}

const CLASSES: Record<Theme, ClassDef[]> = {
  drug: [
    { label: "Not detected", color: "var(--seq-1)", test: (v) => v <= 0 },
    { label: "Up to 10%", color: "var(--seq-4)", test: (v) => v <= 0.1 },
    { label: "10% to 30%", color: "var(--seq-5)", test: (v) => v <= 0.3 },
    { label: "30% to 60%", color: "var(--seq-6)", test: (v) => v <= 0.6 },
    { label: "Above 60%", color: "var(--seq-7)", test: () => true },
  ],
  diagnostic: [
    { label: "No deletion found", color: "var(--seq-1)", test: (v) => v <= 0 },
    { label: "Below 2%", color: "var(--seq-3)", test: (v) => v < 0.02 },
    { label: "2% to 5%", color: "var(--seq-5)", test: (v) => v < 0.05 },
    { label: "5% and above (WHO action)", color: "var(--status-critical)", test: () => true },
  ],
  children: [
    { label: "Below 10%", color: "var(--seq-2)", test: (v) => v < 0.1 },
    { label: "10% to 20%", color: "var(--seq-3)", test: (v) => v < 0.2 },
    { label: "20% to 30%", color: "var(--seq-4)", test: (v) => v < 0.3 },
    { label: "30% to 40%", color: "var(--seq-6)", test: (v) => v < 0.4 },
    { label: "40% and above", color: "var(--seq-7)", test: () => true },
  ],
};

const THEMES: { key: Theme; label: string; sub: string }[] = [
  { key: "drug", label: "Drug resistance", sub: "Resistance markers" },
  { key: "diagnostic", label: "Diagnostics", sub: "hrp2 / hrp3 deletions" },
  { key: "children", label: "Malaria burden", sub: "Children testing positive" },
];

function classIndex(theme: Theme, v: number) {
  return CLASSES[theme].findIndex((c) => c.test(v));
}

function latestByState<T extends { state: string; year: number }>(rows: T[], year: number | "latest") {
  const byState = new Map<string, T[]>();
  for (const r of rows) {
    const list = byState.get(r.state);
    if (list) list.push(r);
    else byState.set(r.state, [r]);
  }
  const out = new Map<string, { year: number; rows: T[] }>();
  for (const [state, list] of byState) {
    const target = year === "latest" ? Math.max(...list.map((r) => r.year)) : year;
    const chosen = list.filter((r) => r.year === target);
    if (chosen.length) out.set(state, { year: target, rows: chosen });
  }
  return out;
}

function markerValues(obs: Observation[], key: string, year: number | "latest") {
  const [gene, mutation] = key.split("|");
  const rows = obs.filter((o) => o.gene === gene && o.mutation === mutation);
  const out = new Map<string, StateValue>();
  for (const [state, { year: y, rows: list }] of latestByState(rows, year)) {
    out.set(state, { value: weightedPrevalence(list), samples: list.reduce((s, r) => s + (r.sample_count ?? 0), 0), year: y });
  }
  return out;
}

function hrpValues(hrp: HrpRow[], gene: "hrp2" | "hrp3", year: number | "latest") {
  const out = new Map<string, StateValue>();
  for (const [state, { year: y, rows }] of latestByState(hrp, year)) {
    let deleted = 0;
    let total = 0;
    for (const r of rows) {
      total += r.sample_count;
      if (r.deletion_type === gene || r.deletion_type === "dual") deleted += r.sample_count;
    }
    if (total > 0) out.set(state, { value: deleted / total, samples: total, year: y });
  }
  return out;
}

function markerCatalog(data: DashboardData) {
  const stats = new Map<
    string,
    { gene: string; mutation: string; drug: string; specific: boolean; detectedStates: Set<string>; max: number }
  >();
  for (const o of data.observations) {
    const key = `${o.gene}|${o.mutation}`;
    let s = stats.get(key);
    if (!s) {
      const rule = findRule(data.alerts, o.gene, o.mutation);
      const drug = rule?.antimalarial && rule.antimalarial !== "general" ? rule.antimalarial : "other markers";
      const specific = Boolean(rule && rule.mutation_pattern !== "*" && rule.levels.length === 1);
      s = { gene: o.gene, mutation: o.mutation, drug, specific, detectedStates: new Set(), max: 0 };
      stats.set(key, s);
    }
    if (Number(o.prevalence) > 0) s.detectedStates.add(o.state);
    s.max = Math.max(s.max, Number(o.prevalence));
  }
  return stats;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MapExplorer() {
  const { data, error } = useDashboardData();
  const { setStates } = useFilters();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [theme, setTheme] = useState<Theme>((params.get("theme") as Theme) ?? "drug");
  const [drug, setDrug] = useState(params.get("drug") ?? "artemisinin");
  const [markerKey, setMarkerKey] = useState(params.get("marker") ?? "");
  const [hrpGene, setHrpGene] = useState<"hrp2" | "hrp3">("hrp2");
  const [year, setYear] = useState<number | "latest">("latest");
  const [focus, setFocus] = useState<string | null>(params.get("state"));
  const [activeClass, setActiveClass] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const catalog = useMemo(() => (data ? markerCatalog(data) : new Map()), [data]);

  const drugs = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((m) => set.add(m.drug));
    return [...set].sort((a, b) => {
      const ia = DRUG_ORDER.indexOf(a);
      const ib = DRUG_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [catalog]);

  const markersForDrug = useMemo(
    () =>
      [...catalog.entries()]
        .filter(([, m]) => m.drug === drug)
        .sort(
          (a, b) =>
            Number(b[1].specific && b[1].max > 0) - Number(a[1].specific && a[1].max > 0) ||
            b[1].detectedStates.size - a[1].detectedStates.size ||
            b[1].max - a[1].max,
        ),
    [catalog, drug],
  );

  const activeMarker = markersForDrug.some(([k]) => k === markerKey) ? markerKey : markersForDrug[0]?.[0] ?? "";

  const names = useMemo(() => Object.fromEntries((data?.states ?? []).map((s) => [s.code, s.name])), [data]);

  const themeYears = useMemo(() => {
    if (!data) return [];
    if (theme === "drug") {
      const [g, m] = activeMarker.split("|");
      return [...new Set(data.observations.filter((o) => o.gene === g && o.mutation === m).map((o) => o.year))].sort();
    }
    if (theme === "diagnostic") return [...new Set(data.hrp.map((r) => r.year))].sort();
    return [...new Set(data.mis.map((r) => r.year))].sort();
  }, [data, theme, activeMarker]);

  const [playing, setPlaying] = useState(false);
  const playRef = useRef({ years: themeYears, year });
  playRef.current = { years: themeYears, year };

  useEffect(() => {
    setPlaying(false);
  }, [theme, activeMarker, hrpGene]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const { years, year: current } = playRef.current;
      const idx = current === "latest" ? -1 : years.indexOf(current);
      if (idx >= years.length - 1) {
        setPlaying(false);
        return;
      }
      setYear(years[idx + 1]);
    }, PLAY_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const last = themeYears[themeYears.length - 1];
    if (year === "latest" || year === last || !themeYears.includes(year as number)) setYear(themeYears[0]);
    setPlaying(true);
  };

  const effectiveYear = year !== "latest" && themeYears.includes(year) ? year : "latest";

  const values = useMemo(() => {
    if (!data) return new Map<string, StateValue>();
    if (theme === "drug") return activeMarker ? markerValues(data.observations, activeMarker, effectiveYear) : new Map();
    if (theme === "diagnostic") return hrpValues(data.hrp, hrpGene, effectiveYear);
    const mis = misByState(data.mis, effectiveYear === "latest" ? undefined : effectiveYear);
    const out = new Map<string, StateValue>();
    mis.values.forEach((v, k) => out.set(k, { value: v.value, samples: 0, year: mis.year }));
    return out;
  }, [data, theme, activeMarker, effectiveYear, hrpGene]);

  const classes = CLASSES[theme];
  const classCounts = useMemo(() => {
    const counts = classes.map(() => 0);
    values.forEach((v) => {
      const i = classIndex(theme, v.value);
      if (i >= 0) counts[i] += 1;
    });
    return counts;
  }, [values, classes, theme]);

  const highlight = useMemo(() => {
    if (activeClass === null) return null;
    const set = new Set<string>();
    values.forEach((v, k) => {
      if (classIndex(theme, v.value) === activeClass) set.add(k);
    });
    return set;
  }, [activeClass, values, theme]);

  if (error) return <EmptyState>Cannot reach the API ({error}).</EmptyState>;
  if (!data) return <div className="loading">Loading map...</div>;

  const [mGene, mMutation] = activeMarker.split("|");
  const metricLabel =
    theme === "drug" ? `${mGene} ${mMutation}` : theme === "diagnostic" ? `${hrpGene} deletion` : "Malaria in children";
  const yearLabel = effectiveYear === "latest" ? "latest year available per state" : String(effectiveYear);
  const missing = data.states.length - values.size;

  const switchTheme = (t: Theme) => {
    setTheme(t);
    setYear("latest");
    setActiveClass(null);
  };

  const shareLink = () => {
    const q = new URLSearchParams({ theme });
    if (theme === "drug") {
      q.set("drug", drug);
      q.set("marker", activeMarker);
    }
    const url = `${window.location.origin}/map?${q.toString()}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => undefined,
    );
  };

  const exportCsv = () => {
    const header = ["state", "code", metricLabel, "year", "samples", "class"];
    const rows = data.states.map((s) => {
      const v = values.get(s.code);
      return v
        ? [s.name, s.code, (v.value * 100).toFixed(2) + "%", v.year, v.samples, classes[classIndex(theme, v.value)]?.label ?? ""]
        : [s.name, s.code, "no data", "", "", ""];
    });
    downloadCsv(`malaria_${metricLabel.replace(/\W+/g, "_")}_${effectiveYear}.csv`, [header, ...rows]);
  };

  return (
    <div className="page">
      <div className="page-hero compact slim">
        <HeroBackdrop />
        <p className="eyebrow">Interactive map</p>
        <h1 className="page-title">
          Malaria threats <span>in Nigeria</span>
        </h1>
        <p className="page-lede">Choose a theme, pick what to show, then click a state to open its profile.</p>
      </div>

      <div className={`explorer${focus ? " with-drawer" : ""}`}>
        <aside className="explorer-panel" aria-label="Map filters">
          <div className="theme-tabs" role="tablist">
            {THEMES.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={theme === t.key}
                className={`theme-tab${theme === t.key ? " active" : ""}`}
                onClick={() => switchTheme(t.key)}
              >
                <strong>{t.label}</strong>
                <span>{t.sub}</span>
              </button>
            ))}
          </div>

          {theme === "drug" && (
            <>
              <label className="control">
                <span>Antimalarial</span>
                <select
                  value={drug}
                  onChange={(e) => {
                    setDrug(e.target.value);
                    setMarkerKey("");
                    setActiveClass(null);
                  }}
                >
                  {drugs.map((d) => (
                    <option key={d} value={d}>
                      {titleCase(d)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="control">
                <span>
                  Resistance marker <InfoTip>{GLOSSARY.marker}</InfoTip>
                </span>
                <select
                  value={activeMarker}
                  onChange={(e) => {
                    setMarkerKey(e.target.value);
                    setActiveClass(null);
                  }}
                >
                  {markersForDrug.map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.gene} {m.mutation} ({m.detectedStates.size} states)
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {theme === "diagnostic" && (
            <div className="control">
              <span>
                Gene deletion <InfoTip>{GLOSSARY.hrp}</InfoTip>
              </span>
              <div className="segmented full">
                {(["hrp2", "hrp3"] as const).map((g) => (
                  <button key={g} className={hrpGene === g ? "active" : ""} onClick={() => setHrpGene(g)}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {themeYears.length > 0 && (
            <div className="control">
              <span>Year</span>
              <div className="year-player">
                <button
                  className="play-button small"
                  onClick={togglePlay}
                  disabled={themeYears.length < 2}
                  aria-label={playing ? "Pause" : "Play the years"}
                  title={themeYears.length < 2 ? "Only one year of data for this selection" : playing ? "Pause" : "Play the years"}
                >
                  {playing ? (
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" />
                      <rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
                    </svg>
                  )}
                </button>
                <span className="year-player-hint">
                  {themeYears.length < 2 ? "Only one year of data" : playing ? `Playing ${effectiveYear}...` : `Play ${themeYears[0]} to ${themeYears[themeYears.length - 1]}`}
                </span>
              </div>
              <div className="chip-row">
                <button className={`chip${effectiveYear === "latest" ? " active" : ""}`} onClick={() => { setPlaying(false); setYear("latest"); }}>
                  Latest
                </button>
                {themeYears.map((y) => (
                  <button key={y} className={`chip${effectiveYear === y ? " active" : ""}`} onClick={() => { setPlaying(false); setYear(y); }}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="control">
            <span>Legend</span>
            <ul className="class-legend">
              {classes.map((c, i) => (
                <li key={c.label}>
                  <button
                    className={`class-row${activeClass === i ? " active" : ""}${activeClass !== null && activeClass !== i ? " faded" : ""}`}
                    onClick={() => setActiveClass(activeClass === i ? null : i)}
                    disabled={classCounts[i] === 0}
                  >
                    <span className="class-swatch" style={{ background: c.color }} />
                    <span className="class-label">{c.label}</span>
                    <span className="class-count">{classCounts[i]}</span>
                  </button>
                </li>
              ))}
              <li>
                <div className="class-row static">
                  <span className="class-swatch hatch" />
                  <span className="class-label">No data</span>
                  <span className="class-count">{missing}</span>
                </div>
              </li>
            </ul>
            <p className="control-hint">Click a class to highlight its states.</p>
          </div>
        </aside>

        <section className="explorer-map" aria-label="Map">
          <div className="explorer-toolbar">
            <div className="explorer-title">
              <strong>{metricLabel}</strong>
              <span>{theme === "children" ? surveyName([...values.values()][0]?.year) : yearLabel}</span>
            </div>
            <div className="toolbar-actions">
              <button className="tool-button" onClick={exportCsv}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 13h10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download data
              </button>
              <button className="tool-button" onClick={shareLink}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="4" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="4" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5.8 7l4.4-2M5.8 9l4.4 2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                {copied ? "Link copied" : "Share"}
              </button>
            </div>
          </div>
          {effectiveYear !== "latest" && (
            <div className={`map-year-badge${playing ? " live" : ""}`} key={effectiveYear}>
              {effectiveYear}
            </div>
          )}
          <NigeriaMap
            values={values}
            names={names}
            selected={focus ? [focus] : []}
            onToggle={(code) => setFocus(focus === code ? null : code)}
            format={(v) => formatPercent(v, theme === "children" ? 1 : 2)}
            metricLabel={metricLabel}
            showSamples={theme !== "children"}
            colorFor={(v) => classes[classIndex(theme, v)]?.color ?? "var(--seq-1)"}
            showLegend={false}
            zoomOnSelect={false}
            greyUnselected={false}
            highlight={highlight}
            hint="Click to open the state profile"
          />
          {theme === "children" && [...values.values()][0]?.year !== undefined && <SurveySource year={[...values.values()][0].year} />}
        </section>

        {focus && <StateDrawer code={focus} data={data} names={names} onClose={() => setFocus(null)} onOpen={() => {
          setStates([focus]);
          navigate(`/dashboard?states=${focus}`);
        }} />}
      </div>
    </div>
  );
}

const SEVERITY: Record<Classification, number> = { high: 3, intermediate: 2, low: 1, none: 0 };

function StateDrawer({
  code,
  data,
  names,
  onClose,
  onOpen,
}: {
  code: string;
  data: DashboardData;
  names: Record<string, string>;
  onClose: () => void;
  onOpen: () => void;
}) {
  const profile = useMemo(() => {
    const obs = data.observations.filter((o) => o.state === code);
    const byMarker = new Map<string, Observation[]>();
    for (const o of obs) {
      const k = `${o.gene}|${o.mutation}`;
      const list = byMarker.get(k);
      if (list) list.push(o);
      else byMarker.set(k, [o]);
    }
    const markers = [...byMarker.entries()]
      .map(([k, list]) => {
        const latest = Math.max(...list.map((r) => r.year));
        const rows = list.filter((r) => r.year === latest);
        const prevalence = weightedPrevalence(rows);
        const [gene, mutation] = k.split("|");
        const level = classify(findRule(data.alerts, gene, mutation), prevalence);
        return { key: k, gene, mutation, prevalence, year: latest, level: prevalence > 0 ? level.classification : ("none" as Classification) };
      })
      .filter((m) => m.prevalence > 0)
      .sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level] || b.prevalence - a.prevalence);
    const mis = data.mis.find((m) => m.state === code);
    const hrp2 = hrpValues(data.hrp.filter((r) => r.state === code), "hrp2", "latest").get(code);
    const hrp3 = hrpValues(data.hrp.filter((r) => r.state === code), "hrp3", "latest").get(code);
    const moiRows = data.moi.filter((r) => r.state === code);
    const sequenced = moiRows.reduce((s, r) => s + r.sample_count, 0);
    const studies = new Set(obs.filter((o) => o.source_type === "publication").map((o) => `${o.author}, ${o.year_of_publication}`));
    return { markers, mis, hrp2, hrp3, sequenced, studies: [...studies].sort() };
  }, [code, data]);

  return (
    <aside className="explorer-drawer" aria-label={`${names[code]} profile`}>
      <div className="drawer-head">
        <div>
          <span className="drawer-eyebrow">State profile</span>
          <h2>{names[code] ?? code}</h2>
        </div>
        <button className="drawer-close" onClick={onClose} aria-label="Close profile">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="drawer-stats">
        <div>
          <strong>{profile.mis ? <CountUp value={Number(profile.mis.prevalence)} format={(v) => formatPercent(v, 1)} /> : "No data"}</strong>
          <span>children with malaria ({surveyName(profile.mis?.year)})</span>
        </div>
        <div>
          <strong>{profile.sequenced ? <CountUp value={profile.sequenced} /> : "None"}</strong>
          <span>samples sequenced by IGH</span>
        </div>
      </div>

      <h3>Resistance markers found</h3>
      {profile.markers.length === 0 ? (
        <p className="drawer-empty">No resistance marker detected in the available data.</p>
      ) : (
        <ul className="drawer-markers">
          {profile.markers.slice(0, 8).map((m) => (
            <li key={m.key}>
              <div className="drawer-marker-head">
                <span className="mutation-chip">{m.mutation}</span>
                <span className="drawer-gene">{m.gene}</span>
                <span className="drawer-value">{formatPercent(m.prevalence, 1)}</span>
              </div>
              <div className="drawer-bar">
                <span className={`fill-${m.level}`} style={{ width: `${Math.max(m.prevalence * 100, 1.5)}%` }} />
              </div>
              <div className="drawer-marker-foot">
                <StatusBadge level={m.level} plain />
                <span>{m.year}</span>
              </div>
            </li>
          ))}
          {profile.markers.length > 8 && <li className="drawer-more">+{profile.markers.length - 8} more markers</li>}
        </ul>
      )}

      <h3>Rapid diagnostic tests</h3>
      {profile.hrp2 || profile.hrp3 ? (
        <div className="drawer-hrp">
          <span>
            hrp2 deletion <strong>{profile.hrp2 ? formatPercent(profile.hrp2.value, 1) : "n/a"}</strong>
          </span>
          <span>
            hrp3 deletion <strong>{profile.hrp3 ? formatPercent(profile.hrp3.value, 1) : "n/a"}</strong>
          </span>
        </div>
      ) : (
        <p className="drawer-empty">No hrp2/hrp3 data for this state.</p>
      )}

      <h3>Sources</h3>
      <p className="drawer-sources">
        {profile.sequenced ? "IGH sequencing" : ""}
        {profile.sequenced && profile.studies.length ? " · " : ""}
        {profile.studies.join(" · ") || (profile.sequenced ? "" : "No published study")}
      </p>

      <button className="drawer-cta" onClick={onOpen}>
        Open {names[code]} in the overview
      </button>
    </aside>
  );
}
