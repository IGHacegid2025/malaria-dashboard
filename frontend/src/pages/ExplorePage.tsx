// Author: Khadim Gueye

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import HeroBackdrop from "../components/HeroBackdrop";
import { StateRanking } from "../components/InsightPanels";
import NigeriaMap from "../components/NigeriaMap";
import { EmptyState, Panel } from "../components/Panels";
import StatusBadge, { PLAIN_LABELS } from "../components/StatusBadge";
import WhoBadge from "../components/WhoBadge";
import { StatePicker } from "../components/SelectionBar";
import { placeLabel, useFilters } from "../filters";
import { useSettings } from "../settings";
import { useDashboardData } from "../hooks/useDashboardData";
import type { WhoStatus } from "../api";
import {
  classify,
  findRule,
  formatPercent,
  markerByState,
  weightedPrevalence,
  type Classification,
} from "../lib/analysis";
import { geneLabel, markerLabel, mutationLabel } from "../lib/markers";

const MS_PER_YEAR = 1600;
const BAND_COLORS: Record<Classification, string> = {
  low: "var(--status-good)",
  intermediate: "var(--status-warning)",
  high: "var(--status-critical)",
  none: "var(--text-muted)",
};
const MONTH = 1 / 12;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface TrendPoint {
  year: number;
  prevalence: number | null;
  samples: number;
  states: number;
  partial?: boolean;
}

function progressiveSeries(trend: TrendPoint[], t: number) {
  const known = trend.filter((p) => p.prevalence !== null);
  const shown: TrendPoint[] = known.filter((p) => p.year <= t + 1e-6);
  const next = known.find((p) => p.year > t + 1e-6);
  const prev = shown[shown.length - 1];
  if (prev && next && t > prev.year) {
    const ratio = (t - prev.year) / (next.year - prev.year);
    shown.push({
      year: t,
      prevalence: prev.prevalence! + (next.prevalence! - prev.prevalence!) * ratio,
      samples: 0,
      states: 0,
      partial: true,
    });
  }
  return shown;
}

export default function ExplorePage() {
  const { data, error } = useDashboardData();
  const { settings: siteSettings } = useSettings();
  const { states: selected, setStates, toggleState, marker, setMarker } = useFilters();
  const [gene, setGene] = useState("");
  const [mutation, setMutation] = useState("");
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);

  const genes = useMemo(
    () => [...new Set((data?.observations ?? []).map((o) => o.gene))].sort(),
    [data],
  );

  const mutations = useMemo(() => {
    if (!data || !gene) return [];
    const stats = new Map<string, number>();
    for (const o of data.observations) {
      if (o.gene !== gene) continue;
      stats.set(o.mutation, Math.max(stats.get(o.mutation) ?? 0, Number(o.prevalence)));
    }
    return [...stats.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([m]) => m);
  }, [data, gene]);

  useEffect(() => {
    if (!data || gene) return;
    if (marker) {
      const [g, m] = marker.split("|");
      setGene(g);
      setMutation(m);
    } else {
      const years = new Map<string, Set<number>>();
      for (const o of data.observations) {
        if (Number(o.prevalence) <= 0) continue;
        const key = `${o.gene}|${o.mutation}`;
        if (!years.has(key)) years.set(key, new Set());
        years.get(key)!.add(o.year);
      }
      const best = [...years.entries()].sort((a, b) => b[1].size - a[1].size)[0]?.[0] ?? "kelch13|C580Y";
      const [g, m] = best.split("|");
      setGene(g);
      setMutation(m);
    }
  }, [data, gene, marker]);

  useEffect(() => {
    if (gene && mutations.length && !mutations.includes(mutation)) setMutation(mutations[0]);
  }, [gene, mutations, mutation]);

  const rows = useMemo(
    () => (data ? data.observations.filter((o) => o.gene === gene && o.mutation === mutation) : []),
    [data, gene, mutation],
  );

  const trend: TrendPoint[] = useMemo(() => {
    const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
    return years.map((year) => {
      const subset = rows.filter((r) => r.year === year && (selected.length === 0 || selected.includes(r.state)));
      return {
        year,
        prevalence: subset.length ? Number((weightedPrevalence(subset) * 100).toFixed(3)) : null,
        samples: subset.reduce((s, r) => s + (r.sample_count ?? 0), 0),
        states: new Set(subset.map((r) => r.state)).size,
      };
    });
  }, [rows, selected]);

  const years = useMemo(() => trend.map((t) => t.year), [trend]);
  const tMin = years[0] ?? 0;
  const tMax = years[years.length - 1] ?? 0;

  useEffect(() => {
    if (years.length && (time === null || time < tMin || time > tMax)) setTime(tMax);
  }, [years, time, tMin, tMax]);

  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    const step = (now: number) => {
      const dt = last === null ? 0 : now - last;
      last = now;
      let done = false;
      setTime((current) => {
        const nextTime = (current ?? tMin) + dt / MS_PER_YEAR;
        if (nextTime >= tMax) {
          done = true;
          return tMax;
        }
        return nextTime;
      });
      if (done) setPlaying(false);
      else frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [playing, tMin, tMax]);

  const playYear = time === null ? null : [...years].reverse().find((y) => y <= time + 1e-6) ?? null;

  const names = useMemo(() => Object.fromEntries((data?.states ?? []).map((s) => [s.code, s.name])), [data]);

  if (error) return <EmptyState>Cannot reach the API ({error}).</EmptyState>;
  if (!data) return <div className="loading">Loading surveillance data...</div>;

  const togglePlay = () => {
    if (!playing && (time === null || time >= tMax - 1e-6)) setTime(tMin);
    setPlaying((p) => !p);
  };

  const visible = time === null ? trend : progressiveSeries(trend, time);
  const clockYear = time === null ? null : Math.floor(time + 1e-6);
  const clockMonth = time === null ? 0 : Math.min(11, Math.floor((time - Math.floor(time + 1e-6)) * 12 + 1e-6));
  const current = trend.find((t) => t.year === playYear);
  const stateValues = playYear !== null ? markerByState(data.observations, gene, mutation, playYear) : new Map();
  const rule = findRule(data.alerts, gene, mutation);
  const whoStatus: WhoStatus = rule && rule.mutation_pattern === mutation ? rule.who_status ?? "none" : "none";
  const whoRule = Boolean(rule && rule.who_status && rule.who_status !== "none");
  const currentLevel = current?.prevalence != null ? classify(rule, current.prevalence / 100) : null;
  const thresholds = (rule?.levels ?? []).map((l) => Number(l.max_prevalence)).filter((t) => t > 0 && t < 1);
  const sortedLevels = [...(rule?.levels ?? [])].sort((a, b) => a.level_order - b.level_order);
  const aboveLabel = (t: number) => {
    const next = sortedLevels.find((l) => Number(l.max_prevalence) > t + 1e-9);
    return next ? PLAIN_LABELS[next.classification] : "";
  };
  const bands: { y1: number; y2: number; level: Classification }[] = [];
  let lower = 0;
  for (const l of sortedLevels) {
    const upper = Number(l.max_prevalence) * 100;
    const last = bands[bands.length - 1];
    if (last && last.level === l.classification) last.y2 = upper;
    else bands.push({ y1: lower, y2: upper, level: l.classification });
    lower = upper;
  }
  const bandLevels = [...new Set(bands.map((b) => b.level))];
  const ruleScope = !rule
    ? "No threshold defined for this marker"
    : rule.mutation_pattern === mutation
      ? sortedLevels.length === 1
        ? `${whoStatus === "validated" ? "WHO validated marker: a" : "A"}ny detection of ${mutationLabel(gene, mutation)} is a ${PLAIN_LABELS[sortedLevels[0].classification].toLowerCase()}`
        : `${whoRule ? "WHO thresholds" : "Thresholds"} specific to ${mutationLabel(gene, mutation)}`
      : `General ${geneLabel(gene)} thresholds (no specific rule for ${mutationLabel(gene, mutation)} yet)`;
  const rawMax = Math.max(5, ...trend.map((t) => t.prevalence ?? 0), ...thresholds.map((t) => (t * 100 <= 70 ? t * 100 : 0))) * 1.1;
  const tickStep = rawMax <= 10 ? 2 : rawMax <= 25 ? 5 : rawMax <= 60 ? 10 : 20;
  const yMax = Math.min(100, Math.ceil(rawMax / tickStep) * tickStep);
  const yTicks = Array.from({ length: Math.floor(yMax / tickStep) + 1 }, (_, i) => i * tickStep);
  const place = placeLabel(selected, names);

  return (
    <div className="page">
      <div className="page-hero compact">
        <HeroBackdrop />
        <div>
          <p className="eyebrow">Trends over time</p>
          <h1 className="page-title">
            {geneLabel(gene)} <span>{mutationLabel(gene, mutation)}</span>
          </h1>
          <p className="page-lede">
            Press play to watch how this marker evolved across {place}, step by step. Values come from yearly
            sampling; the line moves smoothly between years.
            {rule?.antimalarial && rule.antimalarial !== "general" ? ` Linked to ${rule.antimalarial} resistance.` : ""}
          </p>
        </div>
      </div>

      <div className="filters-row">
        <div className="field">
          <label htmlFor="gene-select">Gene</label>
          <select
            id="gene-select"
            value={gene}
            onChange={(e) => {
              setGene(e.target.value);
              setMutation("");
              setPlaying(false);
            }}
          >
            {genes.map((g) => (
              <option key={g} value={g}>
                {geneLabel(g)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mutation-select">Mutation</label>
          <select
            id="mutation-select"
            value={mutation}
            onChange={(e) => {
              setMutation(e.target.value);
              setMarker(`${gene}|${e.target.value}`);
              setPlaying(false);
            }}
          >
            {mutations.map((m) => (
              <option key={m} value={m}>
                {mutationLabel(gene, m)}
              </option>
            ))}
          </select>
        </div>
        <StatePicker
          states={data.states}
          selected={selected}
          onToggle={toggleState}
          onClear={() => setStates([])}
          label="States"
        />
        <div className="player">
          <button className="play-button" onClick={togglePlay} disabled={years.length < 2} aria-label={playing ? "Pause" : "Play"}>
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
          <div className="player-track">
            <input
              type="range"
              min={tMin}
              max={tMax}
              step={MONTH}
              value={time ?? tMax}
              onChange={(e) => {
                setPlaying(false);
                setTime(Number(e.target.value));
              }}
              aria-label="Timeline, month by month"
              aria-valuetext={clockYear ? `${MONTHS[clockMonth]} ${clockYear}` : undefined}
              disabled={years.length < 2}
            />
            <div className="player-ticks" aria-hidden="true">
              {years.map((y) => (
                <span key={y} style={{ left: `${tMax > tMin ? ((y - tMin) / (tMax - tMin)) * 100 : 0}%` }}>
                  {y}
                </span>
              ))}
            </div>
          </div>
          <div className="player-clock">
            <span className="player-year">{clockYear ?? "-"}</span>
            <span className="player-months" aria-hidden="true">
              {MONTHS.map((m, i) => (
                <i key={m} className={i <= clockMonth ? "on" : ""} />
              ))}
            </span>
            {playYear !== null && clockYear !== playYear && <span className="player-note">showing {playYear} data</span>}
          </div>
        </div>
      </div>

      <div className="grid-trend">
        <Panel
          className="trend-chart-panel"
          title={`${markerLabel(gene, mutation)} prevalence, ${place}`}
          badge={mutation ? <WhoBadge status={whoStatus} showOther large /> : undefined}
          subtitle={`Sample-weighted prevalence per year across all sources · ${ruleScope}`}
          actions={
            current && current.prevalence !== null && currentLevel ? (
              <div className="trend-current">
                <span className="trend-current-value">{current.prevalence.toFixed(2)}%</span>
                <StatusBadge level={current.prevalence > 0 ? currentLevel.classification : "low"} />
              </div>
            ) : null
          }
        >
          {trend.every((t) => t.prevalence === null) ? (
            <EmptyState>No observations for this marker in {place}.</EmptyState>
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={siteSettings?.["size.trend_chart"] ?? 270}>
                <LineChart data={visible} margin={{ top: 16, right: 28, left: 4, bottom: 4 }}>
                  {bands.map((b) => (
                    <ReferenceArea
                      key={`band-${b.y1}`}
                      y1={b.y1}
                      y2={Math.min(b.y2, yMax)}
                      ifOverflow="hidden"
                      fill={BAND_COLORS[b.level]}
                      fillOpacity={0.11}
                      stroke="none"
                    />
                  ))}
                  <CartesianGrid stroke="var(--gridline)" vertical={false} />
                  <XAxis
                    dataKey="year"
                    type="number"
                    domain={[years[0], years[years.length - 1]]}
                    ticks={years}
                    stroke="var(--baseline)"
                    tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, yMax]}
                    ticks={yTicks}
                    stroke="var(--baseline)"
                    tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                    width={48}
                  />
                  {thresholds
                    .filter((t) => t * 100 < yMax)
                    .map((t) => (
                      <ReferenceLine
                        key={t}
                        y={t * 100}
                        stroke="var(--text-muted)"
                        strokeDasharray="4 4"
                        label={{ value: `${whoRule ? "WHO " : ""}${Math.round(t * 100)}% · above: ${aboveLabel(t)}`, position: "insideTopRight", fill: "var(--text-muted)", fontSize: 11 }}
                      />
                    ))}
                  <Tooltip
                    cursor={{ stroke: "var(--baseline)", strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as TrendPoint;
                      if (p.partial) return null;
                      return (
                        <div className="tooltip static">
                          <div className="tooltip-title">{p.year}</div>
                          <div className="tooltip-row">
                            <span>Prevalence</span>
                            <strong>{p.prevalence === null ? "No data" : `${p.prevalence.toFixed(2)}%`}</strong>
                          </div>
                          <div className="tooltip-row">
                            <span>Samples</span>
                            <strong>{p.samples.toLocaleString()}</strong>
                          </div>
                          <div className="tooltip-row">
                            <span>States</span>
                            <strong>{p.states}</strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="linear"
                    dataKey="prevalence"
                    stroke="var(--series-1)"
                    strokeWidth={2}
                    connectNulls
                    dot={(props: { cx?: number; cy?: number; index?: number; payload?: TrendPoint }) =>
                      props.payload?.partial || props.cx === undefined || props.cy === undefined ? (
                        <g key={`dot-${props.index}`} />
                      ) : (
                        <circle
                          key={`dot-${props.index}`}
                          className="trend-dot"
                          cx={props.cx}
                          cy={props.cy}
                          r={4}
                          fill="var(--series-1)"
                          stroke="var(--surface-1)"
                          strokeWidth={2}
                        />
                      )
                    }
                    activeDot={{ r: 6, fill: "var(--series-1)", stroke: "var(--surface-1)", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              {bands.length > 0 && (
                <div className="band-legend">
                  {bandLevels.map((level) => (
                    <span key={level}>
                      <i style={{ background: BAND_COLORS[level] }} />
                      {PLAIN_LABELS[level]}
                    </span>
                  ))}
                  <span className="band-note">{whoRule ? "Zones follow the WHO rule of this marker" : "Zones follow the lab thresholds, no WHO rule for this marker"}</span>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel className="trend-map-panel" title={`Map, ${playYear ?? ""}`} subtitle="Click states to follow them on the curve">
          <div className="trend-map">
            <NigeriaMap
              values={stateValues}
              names={names}
              selected={selected}
              onToggle={toggleState}
              format={(v) => formatPercent(v, 2)}
              metricLabel={markerLabel(gene, mutation)}
              showSamples
            />
          </div>
        </Panel>

        <Panel className="trend-ranking-panel" title={`By state, ${playYear ?? ""}`} subtitle={`${stateValues.size} state${stateValues.size === 1 ? "" : "s"} with data`}>
          <StateRanking
            values={stateValues}
            names={names}
            selected={selected}
            onToggle={toggleState}
            format={(v) => formatPercent(v, 1)}
            showSamples
          />
        </Panel>
      </div>
    </div>
  );
}
