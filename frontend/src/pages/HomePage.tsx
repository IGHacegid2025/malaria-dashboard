// Author: Khadim Gueye

import { useEffect, useMemo, useState } from "react";
import HeroBackdrop from "../components/HeroBackdrop";
import InfoTip, { GLOSSARY } from "../components/InfoTip";
import { CountUp, LiveClock, RotatingText } from "../components/Motion";
import {
  HrpPanelBody,
  MoiPanelBody,
  SourcesList,
  SpeciesPanelBody,
  StateRanking,
} from "../components/InsightPanels";
import NigeriaMap from "../components/NigeriaMap";
import { EmptyState, Panel, StatTile } from "../components/Panels";
import { PolicyGrid } from "../components/PolicyCards";
import ReportGate from "../components/ReportGate";
import ResistanceTable from "../components/ResistanceTable";
import SelectionBar from "../components/SelectionBar";
import StatusBadge from "../components/StatusBadge";
import CiteBlock, { useRelease } from "../components/CiteBlock";
import SurveySource from "../components/SurveySource";
import { placeLabel, useFilters } from "../filters";
import { useSettings } from "../settings";
import { surveyName } from "../lib/surveys";
import { useDashboardData } from "../hooks/useDashboardData";
import {
  availableYears,
  busiestYear,
  collectSources,
  formatPercent,
  isWidespreadUnconfirmed,
  markerByState,
  misByState,
  summariseDrugs,
  summariseHrp,
  summariseMarkers,
  summariseMoi,
  summariseSpecies,
  titleCase,
  type DrugOutlook,
  type HrpSummary,
} from "../lib/analysis";
import { markerLabel } from "../lib/markers";

export const FUNDING_TEXT = [
  "The concept of the molecular surveillance reporting tool (dashboard) was developed by Dr. Ifeyinwa Aniebo in her role as Principal Investigator (PI), a Calestous Juma Science Leadership Fellow, and Associate Professor of Molecular Biology and Genomics from a 5 year grant funding from the Bill and Melinda Gates Foundation.",
  "The dashboard is maintained by laboratory team members Dr. Vera Mitesser, Khadim Gueye, John Openibo, affiliated with the Institute for Genomics and Global Health, Redeemer's University, Ede, Nigeria under the lead of Prof. Christian Happi.",
];

function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function headline(place: string, year: number, drugs: DrugOutlook[], hrp: HrpSummary) {
  const high = drugs.filter((d) => d.classification === "high").map((d) => d.drug);
  const watch = drugs.filter((d) => d.classification === "intermediate" && !isWidespreadUnconfirmed(d)).map((d) => d.drug);
  const widespread = drugs.filter(isWidespreadUnconfirmed).map((d) => d.drug);
  const parts: string[] = [];
  if (high.length) parts.push(`High alert for ${joinList(high)} resistance.`);
  if (watch.length) parts.push(`${titleCase(joinList(watch))} to watch closely.`);
  if (widespread.length)
    parts.push(`Markers for ${joinList(widespread)} are widespread but not WHO validated.`);
  if (!high.length && !watch.length && !widespread.length) parts.push("No resistance alert for the drugs tracked.");
  if (hrp.tested > 0) {
    parts.push(
      Math.max(hrp.hrp2Prevalence, hrp.hrp3Prevalence) < 0.05
        ? "Rapid diagnostic tests remain reliable."
        : "Rapid diagnostic tests may miss infections.",
    );
  }
  if (drugs.every((d) => d.tested === 0) && hrp.tested === 0) {
    return { lead: `In ${year}, ${place === "Nigeria" ? "across Nigeria" : `in ${place}`}:`, text: "No surveillance data yet for this year. Choose another year, or add data from the admin area." };
  }
  return { lead: `In ${year}, ${place === "Nigeria" ? "across Nigeria" : `in ${place}`}:`, text: parts.join(" ") };
}

export default function HomePage() {
  const { data, error } = useDashboardData();
  const { settings: siteSettings } = useSettings();
  const release = useRelease();
  const siteHost = (siteSettings?.["site.public_url"] || "https://para-sight.org/").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const { view, setView, year, setYear, states: selected, setStates, toggleState, marker, setMarker } = useFilters();

  const years = useMemo(() => (data ? availableYears(data.observations, data.hrp) : []), [data]);
  const yearsWithSequencing = useMemo(
    () => new Set((data?.observations ?? []).filter((o) => o.source_type === "sequencing").map((o) => o.year)),
    [data],
  );

  useEffect(() => {
    if (!data || year !== null) return;
    if (!siteSettings) {
      const id = window.setTimeout(() => setYear(busiestYear(data.observations)), 1500);
      return () => window.clearTimeout(id);
    }
    const pref = siteSettings["site.default_year"];
    const withData = availableYears(data.observations, data.hrp);
    if (typeof pref === "number") setYear(pref);
    else if (pref === "auto" && withData.length) setYear(withData[withData.length - 1]);
    else setYear(busiestYear(data.observations));
  }, [data, year, setYear, siteSettings]);

  const names = useMemo(
    () => Object.fromEntries((data?.states ?? []).map((s) => [s.code, s.name])),
    [data],
  );

  const sel = useMemo(() => ({ year: year ?? 0, states: selected }), [year, selected]);

  const insights = useMemo(() => {
    if (!data || year === null) return null;
    const markers = summariseMarkers(data.observations, data.alerts, sel);
    return {
      markers,
      nationalMarkers: selected.length ? summariseMarkers(data.observations, data.alerts, { year, states: [] }) : markers,
      drugs: summariseDrugs(markers),
      hrp: summariseHrp(data.hrp, sel),
      moi: summariseMoi(data.moi, sel),
      species: summariseSpecies(data.species, sel),
      sources: collectSources(data.observations, data.hrp, data.publications, sel),
      mis: misByState(data.mis, year),
    };
  }, [data, year, selected, sel]);

  const [mapMetric, setMapMetric] = useState<"resistance" | "mis">("resistance");
  const [gate, setGate] = useState(false);

  const autoMarker = useMemo(() => {
    const list = (insights?.nationalMarkers ?? []).filter((m) => m.prevalence > 0);
    const rank = { high: 3, intermediate: 2, low: 1, none: 0 } as const;
    return [...list].sort((a, b) => rank[b.classification] - rank[a.classification] || b.statesDetected - a.statesDetected || b.prevalence - a.prevalence)[0] ?? null;
  }, [insights]);

  const selectedMarker = useMemo(() => {
    if (mapMetric === "mis" && !marker) return null;
    return insights?.nationalMarkers.find((m) => m.key === marker) ?? autoMarker;
  }, [insights, marker, mapMetric, autoMarker]);

  useEffect(() => {
    if (insights && marker && !insights.nationalMarkers.some((m) => m.key === marker)) setMarker(null);
  }, [insights, marker, setMarker]);

  if (error) {
    return (
      <EmptyState>
        Cannot reach the API ({error}). Check that MySQL is running in XAMPP and that the API is started.
      </EmptyState>
    );
  }
  if (!data || !insights || year === null) {
    return <div className="loading">Loading surveillance data...</div>;
  }

  const mapValues = selectedMarker
    ? markerByState(data.observations, selectedMarker.gene, selectedMarker.mutation, year)
    : insights.mis.values;
  const mapLabel = selectedMarker
    ? `Share of samples carrying ${markerLabel(selectedMarker.gene, selectedMarker.mutation)}, ${year}`
    : insights.mis.values.size
      ? `Children aged 6 to 59 months testing positive for malaria (microscopy), ${surveyName(year)}`
      : `No data available for ${year}`;
  const mapFormat = (v: number) => formatPercent(v, selectedMarker ? 2 : 1);

  const detected = insights.markers.filter((m) => m.prevalence > 0);
  const highAlerts = detected.filter((m) => m.classification === "high");
  const misEntries = selected.length
    ? selected.map((c) => insights.mis.values.get(c)).filter((v) => v !== undefined)
    : [...insights.mis.values.values()];
  const misValue = misEntries.length ? misEntries.reduce((sum, v) => sum + v.value, 0) / misEntries.length : null;
  const sequenced = Math.max(insights.moi.sequenced, insights.species.total);
  const misDetail = !misEntries.length
    ? `No data available for ${year}`
    : selected.length === 1
      ? `${surveyName(year)}, ${names[selected[0]]}`
      : `${surveyName(year)}, average of ${misEntries.length} states`;
  const place = placeLabel(selected, names);
  const summary = headline(place, year, insights.drugs, insights.hrp);
  const detailed = view === "detailed";
  const reportQuery = new URLSearchParams(window.location.search);
  reportQuery.set("year", String(year));
  const reportPage = `/dashboard?${reportQuery.toString()}`;
  const reportLabel = [
    `${place}, ${year}`,
    selectedMarker ? markerLabel(selectedMarker.gene, selectedMarker.mutation) : null,
    detailed ? "detailed view" : "summary view",
  ]
    .filter(Boolean)
    .join(" · ");

  const mapPanel = (
    <Panel
      className={`map-panel ${detailed ? "col-5" : "col-12 map-wide"}`}
      title={selectedMarker ? `${markerLabel(selectedMarker.gene, selectedMarker.mutation)} by state` : "Malaria in children by state"}
      subtitle={mapLabel}
      info={selectedMarker ? GLOSSARY.marker : GLOSSARY.mis}
      actions={
        <div className="segmented" role="group" aria-label="Map metric">
          <button
            className={!selectedMarker ? "active" : ""}
            onClick={() => {
              setMarker(null);
              setMapMetric("mis");
            }}
          >
            Malaria in children
          </button>
          <button
            className={selectedMarker ? "active" : ""}
            disabled={!selectedMarker && detected.length === 0}
            onClick={() => setMapMetric("resistance")}
          >
            {selectedMarker ? `${markerLabel(selectedMarker.gene, selectedMarker.mutation)}` : "Resistance marker"}
          </button>
        </div>
      }
    >
      {mapValues.size === 0 && (
        <div className="no-data-banner">
          No data available for {year}.{selectedMarker ? " The map will fill in when data for this year is added." : ""}
        </div>
      )}
      <div className="map-body">
        <NigeriaMap
          values={mapValues}
          names={names}
          selected={selected}
          onToggle={toggleState}
          format={mapFormat}
          metricLabel={selectedMarker ? "Prevalence" : "Malaria in children"}
          showSamples={Boolean(selectedMarker)}
        />
        <div className="ranking-wrap">
          <div className="ranking-title">
            States ranked
            <span>{selected.length ? `${selected.length} selected` : "tap to select one or more"}</span>
          </div>
          <StateRanking values={mapValues} names={names} selected={selected} onToggle={toggleState} format={mapFormat} showSamples={Boolean(selectedMarker)} />
        </div>
      </div>
      {!selectedMarker && mapValues.size > 0 && <SurveySource year={year} />}
    </Panel>
  );

  return (
    <div className="page">
      <div className="page-hero">
        <HeroBackdrop />
        <div className="hero-row">
          <div>
            <p className="eyebrow">
              Genomic surveillance ·{" "}
              <span className="no-print">
                <RotatingText
                  items={["antimalarial drug resistance", "diagnostic resistance (hrp2 / hrp3)", "parasite diversity and species"]}
                />
              </span>
              <span className="print-inline">report</span>
            </p>
            <h1 className="page-title">
              {place}, <span>{year}</span>
            </h1>
          </div>
          <div className="hero-actions">
            <span className="live-block">
              <span className="live-indicator">
                <span className="live-dot" aria-hidden="true" />
                Live data · {data.publications.length} studies and IGH sequencing
              </span>
              <LiveClock />
            </span>
            <button className="export-button" onClick={() => setGate(true)}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 13h10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export PDF report
            </button>
            <div className="view-switch" role="group" aria-label="View">
              <button className={!detailed ? "active" : ""} onClick={() => setView("summary")}>
                Summary
              </button>
              <button className={detailed ? "active" : ""} onClick={() => setView("detailed")}>
                Detailed
              </button>
            </div>
          </div>
        </div>
        <p className="print-only print-meta">
          Malaria genomic surveillance report, Ify Aniebo Lab, Institute of Genomics and Global Health. Generated on{" "}
          {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} from {siteHost}.
          Selection: {place}, {year}.{release.text ? ` ${release.text}.` : ""}{release.doi ? ` doi:${release.doi}.` : ""}
        </p>
        <p className="page-lede">
          <strong>{summary.lead}</strong> {summary.text}
        </p>
      </div>

      <SelectionBar
        years={years}
        year={year}
        onYear={setYear}
        states={data.states}
        selected={selected}
        onToggle={toggleState}
        onClear={() => setStates([])}
        yearsWithSequencing={yearsWithSequencing}
      />

      <div className="stat-row">
        <StatTile
          label="Samples sequenced"
          value={sequenced > 0 ? <CountUp value={sequenced} /> : 0}
          detail={sequenced > 0 ? `IGH sequencing, ${year}` : insights.markers.length ? "Publication data only this year" : "No data yet for this year"}
        />
        <StatTile
          label="Markers detected"
          info={GLOSSARY.marker}
          value={
            <>
              <CountUp value={detected.length} />
              <span className="stat-of"> of {insights.markers.length}</span>
            </>
          }
          detail="resistance markers tested"
        />
        <StatTile
          label="High alert markers"
          info={GLOSSARY.who}
          accent={<StatusBadge level={highAlerts.length > 0 ? "high" : "low"} compact />}
          value={<CountUp value={highAlerts.length} />}
          detail={
            highAlerts.length
              ? highAlerts
                  .slice(0, 3)
                  .map((m) => markerLabel(m.gene, m.mutation))
                  .join(", ") + (highAlerts.length > 3 ? ` and ${highAlerts.length - 3} more` : "")
              : "No marker above the WHO alert level"
          }
        />
        <StatTile
          label="Malaria in children"
          info={GLOSSARY.mis}
          value={misValue !== null ? <CountUp value={misValue} format={(v) => formatPercent(v, 1)} /> : <span className="stat-empty">No data</span>}
          detail={misDetail}
        />
      </div>

      <section className="policy-section" aria-labelledby="policy-title">
        <div className="section-head">
          <h2 id="policy-title">
            What this means for treatment
            <InfoTip label="About drug alerts">
              {GLOSSARY.marker} {GLOSSARY.who}
            </InfoTip>
          </h2>
          <p>Each card shows the strongest resistance signal for a drug.<span className="no-print"> Tap a card to see where it was found.</span></p>
        </div>
        {insights.drugs.length === 0 && insights.hrp.tested === 0 ? (
          <div className="no-data-card">
            <strong>No data available for {year}</strong>
            <span>No resistance marker or rapid test result has been recorded for this year yet. Choose another year, or add data from the admin area.</span>
          </div>
        ) : (
        <PolicyGrid
          drugs={insights.drugs}
          hrp={insights.hrp}
          alerts={data.alerts}
          selectedMarker={marker}
          onSelectMarker={(key) => {
            setMarker(key);
            setMapMetric("resistance");
          }}
        />
        )}
      </section>

      <div className="dash-grid">
        {mapPanel}

        {!detailed && (
          <button className="detail-cta col-12" onClick={() => setView("detailed")}>
            <span>For scientists</span>
            See every resistance marker, parasite clones and species in the detailed view
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {detailed && (
          <>
            <Panel
              className="col-7"
              title="Antimalarial resistance markers"
              info={GLOSSARY.marker}
              subtitle={
                <>
                  {place}, {year}.<span className="no-print"> Hover a marker for details, click it to map it across states.</span>
                </>
              }
            >
              <ResistanceTable
                markers={insights.markers}
                selectedKey={marker}
                onSelect={setMarker}
                scope={selected.length ? "the selected states" : "all states"}
              />
            </Panel>

            <Panel className="col-4" title="Diagnostic resistance" info={GLOSSARY.hrp} subtitle="hrp2 and hrp3 gene deletions">
              <HrpPanelBody summary={insights.hrp} alerts={data.alerts} />
            </Panel>
            <Panel className="col-4" title="Parasite clones" info={GLOSSARY.moi} subtitle="Multiplicity of infection">
              <MoiPanelBody moi={insights.moi} />
            </Panel>
            <Panel
              className="col-4"
              title="Plasmodium species detected"
              info={GLOSSARY.species}
              subtitle={insights.species.total ? `${insights.species.total.toLocaleString()} samples` : undefined}
            >
              <SpeciesPanelBody species={insights.species} />
            </Panel>
          </>
        )}

        <Panel
          className="col-6"
          title="Data sources"
          subtitle={`${insights.sources.length} source${insights.sources.length === 1 ? "" : "s"} for this selection`}
        >
          <SourcesList sources={insights.sources} names={names} />
        </Panel>
        <Panel className="col-6 about-panel" title="About this dashboard">
          {(siteSettings?.["site.about"]?.length ? siteSettings["site.about"] : FUNDING_TEXT).map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
          <CiteBlock compact />
        </Panel>
      </div>
      {gate && <ReportGate label={reportLabel} page={reportPage} onClose={() => setGate(false)} onReady={() => window.setTimeout(() => window.print(), 250)} />}
    </div>
  );
}
