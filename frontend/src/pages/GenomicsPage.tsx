// Author: Khadim Gueye

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type GeneFlow, type StateInfo } from "../api";
import GeneFlowGraph, { type Metric } from "../components/GeneFlowGraph";
import HeroBackdrop from "../components/HeroBackdrop";
import { EmptyState } from "../components/Panels";
import { prefersReducedMotion } from "../lib/motion";

const METRICS: { key: Metric; label: string; help: string }[] = [
  { key: "outdegree", label: "Outdegree", help: "Number of states with gene flow going out from this state. High values mark source states." },
  { key: "indegree", label: "Indegree", help: "Number of states with gene flow coming into this state. High values mark sink states." },
  { key: "betweenness", label: "Betweenness", help: "How often a state sits on the shortest path between two others. High values mark states that connect the network." },
  { key: "closeness", label: "Closeness", help: "How closely a state is connected by gene flow to all the others." },
  { key: "source_hub_ratio", label: "Source hub ratio", help: "Outdegree divided by all links. Above 0.5 the state sends more than it receives." },
  { key: "samples", label: "Samples", help: "Number of sequenced samples from the state in this analysis." },
];

const COMING = [
  { title: "Genetic diversity", sub: "Nucleotide diversity (π)" },
  { title: "Differentiation", sub: "FST between states" },
  { title: "Neutrality tests", sub: "Tajima's D" },
  { title: "Population structure", sub: "PCA and admixture" },
];

const SPEEDS = [
  { label: "Slow", ms: 40000 },
  { label: "Normal", ms: 22000 },
  { label: "Fast", ms: 9000 },
];

function palette(ids: string[]) {
  return new Map(ids.map((id, i) => [id, `hsl(${Math.round((i * 360) / ids.length + 200) % 360} 68% ${i % 2 ? 52 : 44}%)`]));
}

export default function GenomicsPage() {
  const [years, setYears] = useState<number[] | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [data, setData] = useState<GeneFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [states, setStates] = useState<StateInfo[]>([]);
  const [metric, setMetric] = useState<Metric>("outdegree");
  const [minWeight, setMinWeight] = useState(2);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [tour, setTour] = useState(false);
  const [speed, setSpeed] = useState(1);
  const buildMs = SPEEDS[speed].ms;
  const frame = useRef<number | null>(null);

  useEffect(() => {
    api.geneFlowYears().then(
      (ys) => {
        setYears(ys);
        setYear(ys.length ? ys[ys.length - 1] : null);
      },
      (err: Error) => setError(err.message),
    );
    api.states().then(setStates, () => undefined);
  }, []);

  useEffect(() => {
    if (year === null) return;
    let live = true;
    api.geneFlow(year).then(
      (d) => live && (setData(d), setError(null)),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, [year]);

  const links = useMemo(() => (data ? data.links.filter((l) => l.weight >= minWeight) : []), [data, minWeight]);
  const colors = useMemo(() => palette((data?.nodes ?? []).map((n) => n.id)), [data]);
  const codes = useMemo(() => Object.fromEntries(states.map((s) => [s.name, s.code])), [states]);
  const maxWeight = data ? Math.max(1, ...data.links.map((l) => l.weight)) : 1;

  const play = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (years && year !== null && progress >= 1 && years.indexOf(year) === years.length - 1 && years.length > 1) setYear(years[0]);
    if (progress >= 1) setProgress(0);
    setTour(true);
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing || !data) return;
    if (prefersReducedMotion()) {
      setProgress(1);
      setPlaying(false);
      return;
    }
    const start = performance.now() - progress * buildMs;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / buildMs);
      setProgress(k);
      if (k < 1) frame.current = requestAnimationFrame(step);
      else if (tour && years && year !== null && years.indexOf(year) < years.length - 1) {
        window.setTimeout(() => {
          setYear(years[years.indexOf(year) + 1]);
          setProgress(0);
        }, 1200);
      } else {
        setPlaying(false);
        setTour(false);
      }
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [playing, data, buildMs]);

  if (error && !data) return <EmptyState>Cannot load the gene flow analysis ({error}).</EmptyState>;
  if (!years) return <div className="loading">Loading population genomics...</div>;

  const info = METRICS.find((m) => m.key === metric)!;
  const visible = Math.round(links.length * (playing || progress < 1 ? progress : 1));
  const pick = selected ? data?.nodes.find((n) => n.id === selected) : null;
  const outgoing = selected ? (data?.links ?? []).filter((l) => l.source === selected) : [];
  const incoming = selected ? (data?.links ?? []).filter((l) => l.target === selected) : [];

  return (
    <div className="page">
      <div className="page-hero compact">
        <HeroBackdrop />
        <p className="eyebrow">Population genomics</p>
        <h1 className="page-title">
          Gene flow <span>between states</span>
        </h1>
        <p className="page-lede">
          Results of the lab's genomic analyses. Gene flow networks are built from the phylogenetic tree of the sequenced parasites: each arrow
          shows the direction of gene flow between two states.
        </p>
      </div>

      <div className="genomics-tabs" role="tablist">
        <button role="tab" aria-selected="true" className="active">
          Gene flow
        </button>
        {COMING.map((c) => (
          <button key={c.title} role="tab" aria-selected="false" disabled title="Coming soon">
            {c.sub}
            <span>Soon</span>
          </button>
        ))}
      </div>

      {years.length === 0 ? (
        <EmptyState>No gene flow analysis has been published yet.</EmptyState>
      ) : (
        <>
          <div className="gf-toolbar">
            <button className={`play-button gf-play${playing ? " playing" : ""}`} onClick={play} aria-label={playing ? "Pause" : "Play the gene flow"}>
              {playing ? (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />
                </svg>
              )}
              {playing ? "Pause" : "Play"}
            </button>
            <div className="gf-speed" role="group" aria-label="Speed">
              {SPEEDS.map((s, i) => (
                <button key={s.label} className={i === speed ? "active" : ""} onClick={() => setSpeed(i)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="gf-years" role="group" aria-label="Year">
              {years.map((y) => (
                <button key={y} className={y === year ? "active" : ""} onClick={() => { setPlaying(false); setTour(false); setProgress(1); setYear(y); }}>
                  {y}
                </button>
              ))}
            </div>
            <label className="gf-select">
              <span>Centrality</span>
              <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
                {METRICS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="gf-select">
              <span>State</span>
              <select value={selected ?? ""} onChange={(e) => setSelected(e.target.value || null)}>
                <option value="">All states</option>
                {[...(data?.nodes ?? [])]
                  .sort((a, b) => a.id.localeCompare(b.id))
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.id}
                    </option>
                  ))}
              </select>
            </label>
            <label className="gf-range">
              <span>
                Links with at least <strong>{minWeight}</strong> transition{minWeight === 1 ? "" : "s"}
              </span>
              <input type="range" min={1} max={Math.min(maxWeight, 15)} value={minWeight} onChange={(e) => setMinWeight(Number(e.target.value))} />
            </label>
          </div>

          {data && (
            <section className="panel gf-main">
              <div className="gf-head">
                <div>
                  <h2>
                    {info.label} centrality, {data.year}
                  </h2>
                  <p>{info.help}</p>
                </div>
              </div>
              <div className="gf-pair">
                {(["network", "map"] as const).map((m) => (
                  <div key={m} className="gf-pane">
                    <span className="gf-pane-label">{m === "network" ? "Network" : "Map of Nigeria"}</span>
                    <GeneFlowGraph
                      nodes={data.nodes}
                      links={links}
                      metric={metric}
                      colors={colors}
                      visible={visible}
                      selected={selected}
                      onSelect={setSelected}
                      mode={m}
                      codes={codes}
                      metricLabel={info.label}
                    />
                  </div>
                ))}
              </div>
              <p className="gf-hint">
                Node size shows {info.label.toLowerCase()}. Arrow width shows the number of transitions. Click a state to focus it in both views, drag
                it in the network, Ctrl + scroll to zoom.
              </p>
              {pick && (
                <div className="gf-detail">
                  <div className="gf-detail-head">
                    <span className="gf-dot" style={{ background: colors.get(pick.id) }} />
                    <h3>{pick.id}</h3>
                    <button className="link-button" onClick={() => setSelected(null)}>
                      Clear
                    </button>
                  </div>
                  <div className="gf-detail-body">
                    <div className="gf-detail-grid">
                      <span>Samples<strong>{pick.samples}</strong></span>
                      <span>Outdegree<strong>{pick.outdegree}</strong></span>
                      <span>Indegree<strong>{pick.indegree}</strong></span>
                      <span>Source hub ratio<strong>{pick.source_hub_ratio.toFixed(2)}</strong></span>
                    </div>
                    <div>
                      <h4>Sends most to</h4>
                      <ul className="gf-flow-list">
                        {outgoing.slice(0, 5).map((l) => (
                          <li key={l.target}>
                            <button onClick={() => setSelected(l.target)}>{l.target}</button>
                            <span>{l.weight}</span>
                          </li>
                        ))}
                        {!outgoing.length && <li className="muted">No outgoing link</li>}
                      </ul>
                    </div>
                    <div>
                      <h4>Receives most from</h4>
                      <ul className="gf-flow-list">
                        {incoming.slice(0, 5).map((l) => (
                          <li key={l.source}>
                            <button onClick={() => setSelected(l.source)}>{l.source}</button>
                            <span>{l.weight}</span>
                          </li>
                        ))}
                        {!incoming.length && <li className="muted">No incoming link</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
          {data && <p className="gf-method">Method: {data.method}. Tree and metadata published by the lab for {data.year}.</p>}
        </>
      )}

      <section className="gf-coming">
        <h2>More population genomics results soon</h2>
        <div className="gf-coming-grid">
          {COMING.map((c) => (
            <div key={c.title} className="gf-coming-card">
              <strong>{c.title}</strong>
              <span>{c.sub}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
