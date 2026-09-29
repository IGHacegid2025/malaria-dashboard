// Author: Khadim Gueye

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AlertRule, WhoStatus } from "../api";
import {
  DRUG_CONTEXT,
  classify,
  findRule,
  formatPercent,
  isWidespreadUnconfirmed,
  titleCase,
  type Classification,
  type DrugOutlook,
  type HrpSummary,
  type MarkerSummary,
} from "../lib/analysis";
import { CountUp } from "./Motion";
import StatusBadge from "./StatusBadge";
import WhoBadge from "./WhoBadge";
import { geneLabel, markerLabel, markerTip, mutationLabel } from "../lib/markers";
import { LOW_SAMPLES, ciText } from "../lib/stats";

const SEVERITY: Record<Classification, number> = { high: 3, intermediate: 2, low: 1, none: 0 };

const GROUPS: { status: WhoStatus; label: string }[] = [
  { status: "validated", label: "WHO validated" },
  { status: "candidate", label: "WHO candidate" },
  { status: "none", label: "Other markers" },
];

function PillIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.6 8.6l4.8 6.8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TestIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="7" width="16" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10v4M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.5" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function Card({
  level,
  icon,
  title,
  context,
  value,
  valueCaption,
  badge,
  barValue,
  barTick,
  text,
  footer,
  footerAction,
  extra,
  onClick,
  active,
  delay,
  label,
}: {
  level: Classification;
  label?: string;
  icon: ReactNode;
  title: string;
  context: string;
  value: ReactNode;
  valueCaption: string;
  badge?: ReactNode;
  barValue: number | null;
  barTick?: number;
  text: string | null;
  footer: string;
  footerAction?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  delay: number;
  extra?: ReactNode;
}) {
  const className = `policy-card level-${level}${active ? " active" : ""}${onClick ? " clickable" : ""}`;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (onClick && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };
  return (
    <div
      className={className}
      style={{ animationDelay: `${delay * 50}ms` }}
      onClick={onClick}
      onKeyDown={onKey}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? active : undefined}
    >
      <div className="policy-card-top">
        <span className="policy-pill">
          <StatusBadge level={level} plain label={label} />
        </span>
        <span className="policy-icon">{icon}</span>
      </div>
      <div className="policy-card-title">{title}</div>
      <div className="policy-card-context">{context}</div>
      <div className="policy-card-figure">
        <span className="policy-card-value">{value}</span>
        <span className="policy-card-caption">{valueCaption}</span>
      </div>
      {badge && <div className="policy-card-marker">{badge}</div>}
      {barValue !== null && (
        <div className="policy-bar" aria-hidden="true">
          <div className="policy-bar-fill" style={{ width: `${Math.max(barValue * 100, barValue > 0 ? 1.5 : 0)}%` }} />
          {barTick !== undefined && <span className="policy-bar-tick" style={{ left: `${barTick * 100}%` }} />}
        </div>
      )}
      {text && <p className="policy-card-text">{text}</p>}
      {extra}
      <div className="policy-card-footer">
        <span>{footer}</span>
        {footerAction}
      </div>
    </div>
  );
}

function OtherMarkers({
  markers,
  selectedMarker,
  onSelectMarker,
}: {
  markers: MarkerSummary[];
  selectedMarker: string | null;
  onSelectMarker: (key: string | null) => void;
}) {
  return (
    <div className="marker-more" onClick={(e) => e.stopPropagation()}>
      {GROUPS.map((g) => {
        const rows = markers.filter((m) => m.whoStatus === g.status);
        if (!rows.length) return null;
        return (
          <div key={g.status} className="marker-more-group">
            <div className="marker-more-head">
              <WhoBadge status={g.status} showOther />
              <span>{rows.length}</span>
            </div>
            <ul>
              {rows.map((m) => (
                <li key={m.key}>
                  <button
                    type="button"
                    className={selectedMarker === m.key ? "active" : ""}
                    onClick={() => onSelectMarker(selectedMarker === m.key ? null : m.key)}
                    title={markerTip(m.gene, m.mutation) ?? `Show ${markerLabel(m.gene, m.mutation)} on the map`}
                  >
                    <span className={`marker-dot level-${m.classification}`} aria-hidden="true" />
                    <span className="marker-name">
                      <em>{geneLabel(m.gene)}</em> {mutationLabel(m.gene, m.mutation)}
                    </span>
                    <strong>{formatPercent(m.prevalence, 1)}</strong>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function DrugCard({
  drug: d,
  delay,
  selectedMarker,
  onSelectMarker,
}: {
  drug: DrugOutlook;
  delay: number;
  selectedMarker: string | null;
  onSelectMarker: (key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const top = d.topMarker;
  const widespread = isWidespreadUnconfirmed(d);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <Card
      delay={delay}
      level={d.classification}
      label={widespread ? "Widespread, unconfirmed" : undefined}
      icon={<PillIcon />}
      title={titleCase(d.drug)}
      context={DRUG_CONTEXT[d.drug] ?? "Antimalarial drug"}
      value={top ? <CountUp value={top.prevalence} format={(v) => formatPercent(v, 1)} /> : "0%"}
      valueCaption={top ? `of samples carry ${markerLabel(top.gene, top.mutation)}` : "no resistance marker found"}
      badge={top ? <WhoBadge status={top.whoStatus} showOther /> : undefined}
      barValue={top ? top.prevalence : 0}
      text={widespread ? "Found in most samples, but WHO has not confirmed its link to drug resistance." : d.summary ?? (top ? null : "Current data show no sign of resistance to this drug.")}
      extra={
        top && top.samples > 0 ? (
          <p className="policy-card-ci">
            95% CI {ciText(top.prevalence, top.samples)} · {top.samples.toLocaleString()} samples
            {top.samples < LOW_SAMPLES ? " · few samples, interpret with care" : ""}
          </p>
        ) : undefined
      }
      footer={`${d.detected} of ${d.tested} markers detected`}
      footerAction={
        d.others.length > 0 ? (
          <div className="marker-more-wrap" ref={wrap}>
            <button
              type="button"
              className={`marker-more-toggle${open ? " open" : ""}`}
              aria-expanded={open}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(!open);
              }}
            >
              Other markers ({d.others.length})
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {open && <OtherMarkers markers={d.others} selectedMarker={selectedMarker} onSelectMarker={onSelectMarker} />}
          </div>
        ) : undefined
      }
      onClick={top ? () => onSelectMarker(selectedMarker === top.key ? null : top.key) : undefined}
      active={top !== null && selectedMarker === top.key}
    />
  );
}

export function PolicyGrid({
  drugs,
  hrp,
  alerts,
  selectedMarker,
  onSelectMarker,
}: {
  drugs: DrugOutlook[];
  hrp: HrpSummary;
  alerts: AlertRule[];
  selectedMarker: string | null;
  onSelectMarker: (key: string | null) => void;
}) {
  const worstHrp =
    hrp.hrp2Prevalence >= hrp.hrp3Prevalence ? { gene: "hrp2", p: hrp.hrp2Prevalence } : { gene: "hrp3", p: hrp.hrp3Prevalence };
  const hrpLevel: Classification =
    hrp.tested === 0 ? "none" : worstHrp.p > 0 ? classify(findRule(alerts, worstHrp.gene, "deletion"), worstHrp.p).classification : "low";

  const quiet = drugs.filter((d) => !d.topMarker);
  const items = [
    ...drugs
      .filter((d) => d.topMarker)
      .map((d, i) => ({ kind: "drug" as const, drug: d, level: d.classification, order: i }))
      .sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level] || a.order - b.order),
    ...(hrp.tested > 0 ? [{ kind: "tests" as const, level: hrpLevel, order: 99 }] : []),
  ];

  return (
    <>
    <div className={`policy-grid${[3, 5, 6, 9].includes(items.length) ? " cols-3" : ""}`}>
      {items.map((item, index) => {
        if (item.kind === "tests") {
          return (
            <Card
              key="tests"
              delay={index}
              level={hrpLevel}
              icon={<TestIcon />}
              title="Rapid diagnostic tests"
              context="HRP2-based tests used to confirm malaria"
              value={hrp.tested ? <CountUp value={worstHrp.p} format={(v) => formatPercent(v, 1)} /> : "No data"}
              valueCaption={hrp.tested ? `of samples with ${worstHrp.gene} deletion` : "for this selection"}
              barValue={hrp.tested ? Math.min(worstHrp.p * 10, 1) : null}
              barTick={0.5}
              text={
                hrp.tested
                  ? worstHrp.p < 0.05
                    ? "Tests remain reliable. WHO recommends switching tests above 5% (marked on the bar)."
                    : "Above the WHO 5% threshold: tests may miss infections."
                  : null
              }
              footer={hrp.tested ? `${hrp.tested.toLocaleString()} samples tested · bar scale 0 to 10%` : "Try another year or state"}
            />
          );
        }
        return (
          <DrugCard
            key={item.drug.drug}
            drug={item.drug}
            delay={index}
            selectedMarker={selectedMarker}
            onSelectMarker={onSelectMarker}
          />
        );
      })}
    </div>
    {quiet.length > 0 && (
      <div className="policy-quiet">
        <span className="policy-quiet-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5.2 8.2l1.9 1.9 3.8-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>
          <strong>No resistance marker found</strong> for {quiet.map((d) => titleCase(d.drug)).join(", ")}
        </span>
        <span className="policy-quiet-note">{quiet.reduce((n, d) => n + d.tested, 0)} markers tested</span>
      </div>
    )}
    </>
  );
}
