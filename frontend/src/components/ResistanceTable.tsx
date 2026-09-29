// Author: Khadim Gueye

import { Fragment, useMemo, useState } from "react";
import { formatPercent, titleCase, type MarkerSummary } from "../lib/analysis";
import StatusBadge from "./StatusBadge";
import WhoBadge from "./WhoBadge";
import { TooltipLayer, useTooltip } from "./Tooltip";
import { geneLabel, markerTip, mutationLabel } from "../lib/markers";
import { ciText } from "../lib/stats";

const DRUG_ORDER = [
  "artemisinin",
  "artemether-lumefantrine",
  "artesunate-amodiaquine",
  "piperaquine",
  "chloroquine",
  "sulfadoxine/pyrimethamine",
  "pyrimethamine",
  "other markers",
];

interface Props {
  markers: MarkerSummary[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  scope: string;
}

function PrevalenceBar({ marker }: { marker: MarkerSummary }) {
  const width = marker.prevalence > 0 ? Math.max(marker.prevalence * 100, 1.2) : 0;
  return (
    <div className="prev-bar" aria-hidden="true">
      <div className={`prev-fill fill-${marker.classification}`} style={{ width: `${width}%` }} />
      {marker.thresholds.map((t) => (
        <span key={t} className="prev-tick" style={{ left: `${t * 100}%` }} />
      ))}
    </div>
  );
}

export default function ResistanceTable({ markers, selectedKey, onSelect, scope }: Props) {
  const [showAll, setShowAll] = useState(false);
  const { tip, show, hide } = useTooltip();

  const detected = markers.filter((m) => m.prevalence > 0);
  const hidden = markers.length - detected.length;
  const visible = showAll ? markers : detected;

  const groups = useMemo(() => {
    const map = new Map<string, MarkerSummary[]>();
    for (const m of visible) {
      const list = map.get(m.antimalarial);
      if (list) list.push(m);
      else map.set(m.antimalarial, [m]);
    }
    return [...map.entries()].sort(
      (a, b) =>
        (DRUG_ORDER.indexOf(a[0]) === -1 ? 99 : DRUG_ORDER.indexOf(a[0])) -
        (DRUG_ORDER.indexOf(b[0]) === -1 ? 99 : DRUG_ORDER.indexOf(b[0])),
    );
  }, [visible]);

  if (markers.length === 0) {
    return <div className="empty-state">No resistance marker data for this selection.</div>;
  }

  return (
    <>
      <div className="table-scroll resistance-scroll">
        <table className="resistance-table">
          <thead>
            <tr>
              <th>Marker</th>
              <th className="num">Prevalence</th>
              <th className="bar-col" aria-label="Prevalence bar" />
              <th>Alert level</th>
              <th className="num hide-sm">States</th>
              <th className="num hide-sm">Samples</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([drug, rows]) => (
              <Fragment key={drug}>
                <tr className="group-row">
                  <td colSpan={6}>
                    <span className="drug-name">{titleCase(drug)}</span>
                    <span className="drug-count">{rows.length} marker{rows.length > 1 ? "s" : ""}</span>
                  </td>
                </tr>
                {rows.map((m) => {
                  const isSelected = m.key === selectedKey;
                  return (
                    <Fragment key={m.key}>
                      <tr
                        className={`marker-row${isSelected ? " selected" : ""}`}
                        onClick={() => onSelect(isSelected ? null : m.key)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSelect(isSelected ? null : m.key);
                        }}
                        onMouseMove={(e) =>
                          show(
                            e,
                            <div className="marker-tip">
                              <div className="marker-tip-head">
                                <span className="mutation-chip">{mutationLabel(m.gene, m.mutation)}</span>
                                <span className="marker-tip-gene">{geneLabel(m.gene)}</span>
                                <WhoBadge status={m.whoStatus} />
                                <StatusBadge level={m.classification} />
                              </div>
                              <div className="tooltip-row">
                                <span>Antimalarial</span>
                                <strong>{titleCase(m.antimalarial)}</strong>
                              </div>
                              <div className="tooltip-row">
                                <span>Prevalence</span>
                                <strong>{formatPercent(m.prevalence, 2)}</strong>
                              </div>
                              <div className="tooltip-row">
                                <span>Detected in</span>
                                <strong>
                                  {m.statesDetected} of {m.statesTested} state{m.statesTested > 1 ? "s" : ""} tested
                                </strong>
                              </div>
                              <div className="tooltip-row">
                                <span>Samples</span>
                                <strong>{m.samples.toLocaleString()}</strong>
                              </div>
                              {m.samples > 0 && (
                                <div className="tooltip-row">
                                  <span>95% CI</span>
                                  <strong>{ciText(m.prevalence, m.samples)}</strong>
                                </div>
                              )}
                              {m.thresholds.length > 0 && (
                                <div className="tooltip-row">
                                  <span>WHO thresholds</span>
                                  <strong>{m.thresholds.map((t) => `${Math.round(t * 100)}%`).join(" / ")}</strong>
                                </div>
                              )}
                              {m.summary && (
                                <div className="marker-tip-block action">
                                  <span>Action</span>
                                  {m.summary}
                                </div>
                              )}
                              {m.message && (
                                <div className="marker-tip-block">
                                  <span>Info</span>
                                  {m.message}
                                </div>
                              )}
                              <div className="tooltip-hint">Click to map this marker across states</div>
                            </div>,
                          )
                        }
                        onMouseLeave={hide}
                      >
                        <td className="marker-cell">
                          <span className="gene-name" title={markerTip(m.gene, m.mutation)}>{geneLabel(m.gene)}</span>
                          <span className="mutation-chip">{mutationLabel(m.gene, m.mutation)}</span>
                          <WhoBadge status={m.whoStatus} />
                        </td>
                        <td className="num strong">{formatPercent(m.prevalence, 2)}</td>
                        <td className="bar-col">
                          <PrevalenceBar marker={m} />
                        </td>
                        <td>
                          <StatusBadge level={m.classification} />
                        </td>
                        <td className="num muted hide-sm">
                          {m.statesDetected}/{Math.max(m.statesTested, 1)}
                        </td>
                        <td className="num muted hide-sm">{m.samples.toLocaleString()}</td>
                      </tr>
                      {isSelected && m.message && (
                        <tr className="message-row">
                          <td colSpan={6}>{m.message}</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>
          Prevalence is weighted by sample size across {scope} and sources.
          <span className="no-print"> Ticks mark WHO alert thresholds.</span>
        </span>
        {hidden > 0 && (
          <button className="link-button" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Hide markers not detected" : `Show ${hidden} markers tested but not detected`}
          </button>
        )}
      </div>
      <TooltipLayer tip={tip} />
    </>
  );
}
