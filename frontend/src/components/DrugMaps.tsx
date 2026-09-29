// Author: Khadim Gueye

import type { Observation } from "../api";
import { formatPercent, markerByState, titleCase, type DrugOutlook, type MarkerSummary } from "../lib/analysis";
import { geneLabel, markerTip, mutationLabel } from "../lib/markers";
import NigeriaMap, { stepFor } from "./NigeriaMap";
import WhoBadge from "./WhoBadge";

const STEPS = [1, 2, 3, 4, 5, 6, 7];

export function resistanceColor(value: number) {
  return `var(--seq-${stepFor(value, 1)})`;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function tilesFor(drugs: DrugOutlook[]) {
  const tiles: { drug: string; marker: MarkerSummary }[] = [];
  for (const d of drugs) {
    if (!d.topMarker) continue;
    tiles.push({ drug: d.drug, marker: d.topMarker });
    for (const m of d.validated) if (m.key !== d.topMarker.key) tiles.push({ drug: d.drug, marker: m });
  }
  return tiles;
}

export default function DrugMaps({
  drugs,
  observations,
  year,
  names,
  selectedMarker,
  onSelectMarker,
}: {
  drugs: DrugOutlook[];
  observations: Observation[];
  year: number;
  names: Record<string, string>;
  selectedMarker: string | null;
  onSelectMarker: (key: string) => void;
}) {
  const tiles = tilesFor(drugs);
  if (!tiles.length) return <p className="drug-maps-empty">No resistance marker detected for {year}.</p>;
  return (
    <>
      <div className="drug-maps">
        {tiles.map(({ drug, marker }, i) => (
          <div
            key={marker.key}
            role="button"
            tabIndex={0}
            className={`drug-map${selectedMarker === marker.key ? " active" : ""}`}
            onClick={() => onSelectMarker(marker.key)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelectMarker(marker.key))}
            title={markerTip(marker.gene, marker.mutation) ?? "Show this marker on the main map"}
          >
            <div className="drug-map-head">
              <span className="drug-map-letter">{LETTERS[i] ?? ""}</span>
              <div>
                <strong>{titleCase(drug).replace("/", "/​")}</strong>
                <span>
                  <em>{geneLabel(marker.gene)}</em> {mutationLabel(marker.gene, marker.mutation)}
                </span>
              </div>
            </div>
            <NigeriaMap
              values={markerByState(observations, marker.gene, marker.mutation, year)}
              names={names}
              selected={[]}
              onToggle={() => undefined}
              format={(v) => formatPercent(v, 1)}
              metricLabel="Prevalence"
              showSamples
              colorFor={resistanceColor}
              showLegend={false}
              zoomOnSelect={false}
              greyUnselected={false}
            />
            <div className="drug-map-foot">
              <WhoBadge status={marker.whoStatus} showOther />
              <span>
                {formatPercent(marker.prevalence, 1)} · {marker.statesDetected} of {marker.statesTested} states
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="drug-maps-legend" aria-hidden="true">
        <span>0%</span>
        <span className="drug-maps-scale">
          {STEPS.map((s) => (
            <i key={s} style={{ background: `var(--seq-${s})` }} />
          ))}
        </span>
        <span>100%</span>
        <span className="drug-maps-nodata">No data</span>
      </div>
    </>
  );
}
