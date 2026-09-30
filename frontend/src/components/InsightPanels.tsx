// Author: Khadim Gueye

import { useState } from "react";
import type { AlertRule } from "../api";
import {
  SPECIES_LABELS,
  classify,
  findRule,
  formatPercent,
  type HrpSummary,
  type SourceEntry,
} from "../lib/analysis";
import type { MapValue } from "./NigeriaMap";
import { stepFor } from "./NigeriaMap";
import { CountUp } from "./Motion";
import StatusBadge from "./StatusBadge";
import { TooltipLayer, useTooltip } from "./Tooltip";
import { LOW_SAMPLES } from "../lib/stats";

const WHO_HRP_THRESHOLD = 0.05;

export function HrpPanelBody({ summary, alerts }: { summary: HrpSummary; alerts: AlertRule[] }) {
  const { tip, show, hide } = useTooltip();
  if (summary.tested === 0) {
    return <div className="empty-state">No hrp2/hrp3 deletion data for this selection.</div>;
  }
  const rows = [
    { gene: "hrp2", label: "hrp2 deletion", prevalence: summary.hrp2Prevalence, count: summary.hrp2 + summary.dual },
    { gene: "hrp3", label: "hrp3 deletion", prevalence: summary.hrp3Prevalence, count: summary.hrp3 + summary.dual },
  ];
  const scaleMax = Math.max(0.1, ...rows.map((r) => r.prevalence * 1.25));

  return (
    <div className="hrp-body">
      {rows.map((row) => {
        const level = classify(findRule(alerts, row.gene, "deletion"), row.prevalence);
        return (
          <div className="hrp-row" key={row.gene}>
            <div className="hrp-head">
              <span className="hrp-label">{row.label}</span>
              <span className="hrp-value">{formatPercent(row.prevalence, 2)}</span>
              <StatusBadge level={row.prevalence > 0 ? level.classification : "low"} />
            </div>
            <div
              className="hrp-track"
              onMouseMove={(e) =>
                show(
                  e,
                  <>
                    <div className="tooltip-title">{row.label}</div>
                    <div className="tooltip-row">
                      <span>Deleted samples</span>
                      <strong>
                        {row.count} of {summary.tested.toLocaleString()}
                      </strong>
                    </div>
                    <div className="tooltip-row">
                      <span>WHO action threshold</span>
                      <strong>5%</strong>
                    </div>
                  </>,
                )
              }
              onMouseLeave={hide}
            >
              <div className={`hrp-fill level-${row.prevalence > 0 ? level.classification : "low"}`} style={{ width: `${Math.max((row.prevalence / scaleMax) * 100, row.prevalence > 0 ? 1 : 0)}%` }} />
              <span className="hrp-threshold" style={{ left: `${(WHO_HRP_THRESHOLD / scaleMax) * 100}%` }}>
                <span>WHO 5%</span>
              </span>
            </div>
            <p className="hrp-message">{level.summary ?? ""} {level.message ? <span className="muted">{level.message}</span> : null}</p>
          </div>
        );
      })}
      <div className="hrp-foot">
        {summary.tested.toLocaleString()} samples tested
        {summary.dual > 0 && <>, including {summary.dual} with both hrp2 and hrp3 deleted</>}
      </div>
      <TooltipLayer tip={tip} />
    </div>
  );
}

export function MoiPanelBody({
  moi,
}: {
  moi: {
    total: number;
    undetermined: number;
    mean: number;
    polyclonalShare: number;
    histogram: { moi: number; samples: number }[];
  };
}) {
  const { tip, show, hide } = useTooltip();
  if (moi.total === 0) {
    return <div className="empty-state">No sequencing data for this selection.</div>;
  }
  const max = Math.max(...moi.histogram.map((h) => h.samples), 1);
  return (
    <div className="moi-body">
      <div className="moi-stats">
        <div>
          <div className="hero-number"><CountUp value={moi.mean} format={(v) => v.toFixed(2)} /></div>
          <div className="stat-detail">average clones per infection</div>
        </div>
        <div>
          <div className="hero-number small"><CountUp value={moi.polyclonalShare} format={(v) => formatPercent(v, 0)} /></div>
          <div className="stat-detail">polyclonal infections</div>
        </div>
      </div>
      <div className="histogram" role="img" aria-label="Distribution of multiplicity of infection">
        {moi.histogram.map((h) => (
          <div
            className="histogram-col"
            key={h.moi}
            onMouseMove={(e) =>
              show(
                e,
                <>
                  <div className="tooltip-title">
                    {h.moi} clone{h.moi > 1 ? "s" : ""}
                  </div>
                  <div className="tooltip-row">
                    <span>Samples</span>
                    <strong>{h.samples}</strong>
                  </div>
                  <div className="tooltip-row">
                    <span>Share</span>
                    <strong>{formatPercent(h.samples / moi.total, 1)}</strong>
                  </div>
                </>,
              )
            }
            onMouseLeave={hide}
          >
            <div className="histogram-bar-area">
              <div className="histogram-bar" style={{ height: `${(h.samples / max) * 100}%` }} />
            </div>
            <span className="histogram-label">{h.moi}</span>
          </div>
        ))}
      </div>
      <div className="axis-caption">
        Clones per infection (MOI), {moi.total.toLocaleString()} samples
        {moi.undetermined > 0 && `. ${moi.undetermined} samples without a MOI call are excluded.`}
      </div>
      <TooltipLayer tip={tip} />
    </div>
  );
}

const SPECIES_COLORS: Record<string, string> = {
  pf: "#d9485f",
  pm: "#2a78d6",
  po: "#1baf7a",
  pv: "#f2a93b",
  pk: "#8b5cf6",
};

function Parasite({ species, color }: { species: string; color: string }) {
  const oval = species === "po" || species === "pv";
  const cell = { fill: "currentColor", fillOpacity: 0.14, stroke: "currentColor", strokeOpacity: 0.5, strokeWidth: 1.2 };
  return (
    <svg className="species-parasite" viewBox="0 0 24 24" style={{ color }}>
      {oval ? <ellipse cx="12" cy="12" rx="10.8" ry="8.6" {...cell} /> : <circle cx="12" cy="12" r="9.6" {...cell} />}
      <g className="parasite-body">
        {species === "pm" ? (
          <>
            <rect x="5.6" y="10.3" width="12.8" height="3.4" rx="1.7" fill="currentColor" />
            <circle cx="15.8" cy="12" r="1.2" fill="#fff" fillOpacity="0.8" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12.4" r="3.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="14.9" cy="9.8" r="1.6" fill="currentColor" />
            {species === "pf" && <circle cx="9.1" cy="9.8" r="1.3" fill="currentColor" />}
          </>
        )}
      </g>
    </svg>
  );
}

function SpeciesDots({ combo }: { combo: string }) {
  return (
    <span className="species-dots" aria-hidden="true">
      {combo.split(",").map((s) => (
        <Parasite key={s} species={s} color={SPECIES_COLORS[s] ?? "var(--text-muted)"} />
      ))}
    </span>
  );
}

function speciesLabel(combo: string) {
  return combo
    .split(",")
    .map((s) => SPECIES_LABELS[s] ?? s)
    .join(" + ");
}

export function SpeciesPanelBody({
  species,
}: {
  species: { total: number; species: { name: string; samples: number }[]; combinations: { name: string; samples: number }[] };
}) {
  if (species.total === 0) {
    return <div className="empty-state">No species data for this selection.</div>;
  }
  const max = Math.max(...species.species.map((s) => s.samples), 1);
  return (
    <div className="species-body">
      <div className="bar-list">
        {species.species.map((s) => (
          <div className="bar-list-row" key={s.name}>
            <span className="bar-list-label species-name">
              <SpeciesDots combo={s.name} />
              {SPECIES_LABELS[s.name] ?? s.name}
            </span>
            <div className="bar-list-track">
              <div className="bar-list-fill" style={{ width: `${Math.max((s.samples / max) * 100, 1)}%`, background: SPECIES_COLORS[s.name] }} />
            </div>
            <span className="bar-list-value">{s.samples.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <table className="compact-table">
        <thead>
          <tr>
            <th>Infection type</th>
            <th aria-label="Species" />
            <th className="num">Share</th>
          </tr>
        </thead>
        <tbody>
          {species.combinations.map((c) => (
            <tr key={c.name}>
              <td className="species-name">
                {speciesLabel(c.name)}
                {c.name.includes(",") && <span className="tag">mixed</span>}
              </td>
              <td className="species-dots-cell">
                <SpeciesDots combo={c.name} />
              </td>
              <td className="num">{formatPercent(c.samples / species.total, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SourcesList({ sources, names }: { sources: SourceEntry[]; names: Record<string, string> }) {
  const [filter, setFilter] = useState<"all" | "sequencing" | "publication">("all");
  const [open, setOpen] = useState<string | null>(null);
  if (sources.length === 0) {
    return <div className="empty-state">No sources for this selection.</div>;
  }
  const counts = {
    all: sources.length,
    sequencing: sources.filter((s) => s.kind === "sequencing").length,
    publication: sources.filter((s) => s.kind === "publication").length,
  };
  const total = sources.reduce((sum, s) => sum + s.dataPoints, 0);
  const shown = sources.filter((s) => filter === "all" || s.kind === filter);
  const maxPoints = Math.max(...sources.map((s) => s.dataPoints), 1);

  return (
    <div className="sources">
      <div className="source-filters" role="group" aria-label="Filter sources">
        {(["all", "sequencing", "publication"] as const).map((key) => (
          <button
            key={key}
            className={`source-filter${filter === key ? " active" : ""}`}
            onClick={() => setFilter(key)}
            disabled={counts[key] === 0}
          >
            {key === "all" ? "All" : key === "sequencing" ? "IGH sequencing" : "Publications"}
            <span>{counts[key]}</span>
          </button>
        ))}
      </div>
      <ul className="sources-list">
        {shown.map((s, i) => {
          const isOpen = open === s.label;
          return (
            <li key={s.label} className={`source-item source-${s.kind}${isOpen ? " open" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
              <button className="source-head" onClick={() => setOpen(isOpen ? null : s.label)} aria-expanded={isOpen}>
                <span className="source-dot" aria-hidden="true" />
                <span className="source-main">
                  <span className="source-label">{s.label}</span>
                  <span className="source-meta">
                    {s.kind === "sequencing" ? "Sequencing" : "Publication"} · {s.states.length} state{s.states.length === 1 ? "" : "s"} ·{" "}
                    {s.markers.length} marker{s.markers.length === 1 ? "" : "s"} found
                  </span>
                  <span className="source-share" aria-hidden="true">
                    <span style={{ width: `${(s.dataPoints / maxPoints) * 100}%` }} />
                  </span>
                </span>
                <span className="source-points">
                  <strong>{s.dataPoints}</strong>
                  <small>{formatPercent(s.dataPoints / total, 0)}</small>
                </span>
                <svg className="source-chevron" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                </svg>
              </button>
              {isOpen && (
                <div className="source-detail">
                  {s.title && <p className="source-title">{s.title}</p>}
                  {s.doi && (
                    <a href={`https://doi.org/${s.doi}`} target="_blank" rel="noreferrer" className="source-link">
                      Open the publication (doi.org/{s.doi})
                    </a>
                  )}
                  <div className="source-tags">
                    {s.states.map((code) => (
                      <span key={code} className="tag">
                        {names[code] ?? code}
                      </span>
                    ))}
                  </div>
                  {s.markers.length > 0 && (
                    <div className="source-tags">
                      {s.markers.slice(0, 12).map((m) => (
                        <span key={m} className="mutation-chip">
                          {m}
                        </span>
                      ))}
                      {s.markers.length > 12 && <span className="tag">+{s.markers.length - 12} more</span>}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StateRanking({
  values,
  names,
  selected,
  onToggle,
  format,
  showSamples = false,
}: {
  values: Map<string, MapValue>;
  names: Record<string, string>;
  selected: string[];
  onToggle: (code: string) => void;
  format: (v: number) => string;
  showSamples?: boolean;
}) {
  const rows = [...values.entries()].sort((a, b) => b[1].value - a[1].value);
  const lowN = (v: MapValue) => showSamples && v.samples > 0 && v.samples < LOW_SAMPLES;
  const anyLow = rows.some(([, v]) => lowN(v));
  const max = rows.length ? rows[0][1].value : 0;
  if (rows.length === 0) {
    return <div className="empty-state">No state-level data.</div>;
  }
  return (
    <>
    <ol className="ranking">
      {rows.map(([code, v], i) => (
        <li key={code}>
          <button
            className={`ranking-row${selected.includes(code) ? " selected" : ""}`}
            onClick={() => onToggle(code)}
            aria-pressed={selected.includes(code)}
          >
            <span className="ranking-index">{selected.includes(code) ? "✓" : i + 1}</span>
            <span className="ranking-name">
              {names[code] ?? code}
              {lowN(v) && (
                <span className="ranking-lown" title={`Only ${v.samples} samples: interpret with care`}>
                  n={v.samples}
                </span>
              )}
            </span>
            <span className="ranking-track" aria-hidden="true">
              <span
                className="ranking-fill"
                style={{
                  width: `${Math.max(v.value * 100, v.value > 0 ? 1 : 0)}%`,
                  background: `var(--seq-${Math.max(stepFor(v.value, max), 1)})`,
                }}
              />
            </span>
            <span className="ranking-value">{format(v.value)}</span>
          </button>
        </li>
      ))}
    </ol>
    {anyLow && (
      <p className="ranking-note">
        <span className="no-print">n = fewer than {LOW_SAMPLES} samples in the state, interpret with care.</span>
        <span className="print-inline">* fewer than {LOW_SAMPLES} samples in the state, interpret with care.</span>
      </p>
    )}
    </>
  );
}
