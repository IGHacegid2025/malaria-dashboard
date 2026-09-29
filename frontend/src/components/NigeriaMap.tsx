// Author: Khadim Gueye

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { STATE_PATHS } from "../data/nigeriaMap";
import { animate } from "../lib/motion";
import { TooltipLayer, useTooltip } from "./Tooltip";

export interface MapValue {
  value: number;
  samples: number;
}

interface Props {
  values: Map<string, MapValue>;
  names: Record<string, string>;
  selected: string[];
  onToggle: (code: string) => void;
  format: (value: number) => string;
  metricLabel: string;
  showSamples?: boolean;
  colorFor?: (value: number) => string;
  showLegend?: boolean;
  zoomOnSelect?: boolean;
  greyUnselected?: boolean;
  highlight?: Set<string> | null;
  hint?: string;
}

type Box = [number, number, number, number];

const STEPS = 7;
const ZOOM_MS = 650;

export function stepFor(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(STEPS, Math.ceil((value / max) * STEPS)));
}

function pad(box: Box, ratio: number, minWidth: number): Box {
  let [x, y, w, h] = box;
  const targetW = Math.max(w * (1 + ratio * 2), minWidth);
  const targetH = Math.max(h * (1 + ratio * 2), minWidth * 0.8);
  x -= (targetW - w) / 2;
  y -= (targetH - h) / 2;
  w = targetW;
  h = targetH;
  return [x, y, w, h];
}

export default function NigeriaMap({
  values,
  names,
  selected,
  onToggle,
  format,
  metricLabel,
  showSamples,
  colorFor,
  showLegend = true,
  zoomOnSelect = true,
  greyUnselected = true,
  highlight = null,
  hint,
}: Props) {
  const groupRef = useRef<SVGGElement>(null);
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const [fullBox, setFullBox] = useState<Box | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [zoomToSelection, setZoomToSelection] = useState(true);
  const boxRef = useRef<Box | null>(null);
  const { tip, show, hide } = useTooltip();

  useLayoutEffect(() => {
    if (!groupRef.current) return;
    const b = groupRef.current.getBBox();
    const full = pad([b.x, b.y, b.width, b.height], 0.02, 0);
    setFullBox(full);
    setBox(full);
    boxRef.current = full;
  }, []);

  useEffect(() => {
    if (!fullBox) return;
    let target: Box = fullBox;
    if (zoomOnSelect && zoomToSelection && selected.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const code of selected) {
        const el = pathRefs.current.get(code);
        if (!el) continue;
        const b = el.getBBox();
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }
      if (Number.isFinite(minX)) target = pad([minX, minY, maxX - minX, maxY - minY], 0.35, fullBox[2] * 0.38);
    }
    const start = boxRef.current ?? fullBox;
    const unchanged = start.every((v, i) => Math.abs(v - target[i]) < 0.5);
    return animate(unchanged ? 0 : ZOOM_MS, (k) => {
      const next = start.map((v, i) => v + (target[i] - v) * k) as Box;
      boxRef.current = next;
      setBox(next);
    });
  }, [selected, zoomToSelection, zoomOnSelect, fullBox]);

  const max = useMemo(() => {
    let m = 0;
    values.forEach((v) => (m = Math.max(m, v.value)));
    return m;
  }, [values]);

  const codes = Object.keys(STATE_PATHS);
  const ordered = [...codes.filter((c) => !selected.includes(c)), ...codes.filter((c) => selected.includes(c))];
  const zoomed = zoomOnSelect && zoomToSelection && selected.length > 0;

  return (
    <div className="map-wrap">
      {zoomOnSelect && selected.length > 0 && (
        <button className="map-zoom-button" onClick={() => setZoomToSelection((z) => !z)}>
          {zoomed ? "Show all Nigeria" : "Zoom to selection"}
        </button>
      )}
      <svg
        className="nigeria-map"
        viewBox={box ? box.join(" ") : "0 0 928 928"}
        role="group"
        aria-label={`Map of Nigeria, ${metricLabel}`}
      >
        <defs>
          <pattern id="no-data" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="var(--map-empty)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--map-hatch)" strokeWidth="2" />
          </pattern>
          <filter id="state-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#2a78d6" floodOpacity="0.55" />
          </filter>
        </defs>
        <g ref={groupRef}>
          {ordered.map((code) => {
            const entry = values.get(code);
            const step = entry ? stepFor(entry.value, max) : -1;
            const isSelected = selected.includes(code);
            const dimmed = highlight ? !highlight.has(code) && !isSelected : greyUnselected && selected.length > 0 && !isSelected;
            const base = !entry ? "url(#no-data)" : colorFor ? colorFor(entry.value) : `var(--seq-${step})`;
            const fill = dimmed ? "var(--map-dim)" : base;
            return (
              <path
                key={code}
                ref={(el) => {
                  if (el) pathRefs.current.set(code, el);
                  else pathRefs.current.delete(code);
                }}
                d={STATE_PATHS[code]}
                className={`map-state${isSelected ? " selected" : ""}${dimmed ? " dimmed" : ""}`}
                fill={fill}
                filter={isSelected ? "url(#state-glow)" : undefined}
                vectorEffect="non-scaling-stroke"
                tabIndex={0}
                role="button"
                aria-label={`${names[code] ?? code}: ${entry ? format(entry.value) : "no data"}`}
                aria-pressed={isSelected}
                onClick={() => onToggle(code)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle(code);
                  }
                }}
                onMouseMove={(e) =>
                  show(
                    e,
                    <>
                      <div className="tooltip-title">{names[code] ?? code}</div>
                      <div className="tooltip-row">
                        <span>{metricLabel}</span>
                        <strong>{entry ? format(entry.value) : "No data"}</strong>
                      </div>
                      {showSamples && entry && entry.samples > 0 && (
                        <div className="tooltip-row">
                          <span>Samples</span>
                          <strong>{entry.samples.toLocaleString()}</strong>
                        </div>
                      )}
                      <div className="tooltip-hint">
                        {hint ?? (isSelected ? "Click to remove from selection" : "Click to add to selection")}
                      </div>
                    </>,
                  )
                }
                onMouseLeave={hide}
              />
            );
          })}
        </g>
      </svg>
      {showLegend && (
      <div className="map-legend" aria-hidden="true">
        <span className="legend-label">0%</span>
        <div className="legend-ramp">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} style={{ background: `var(--seq-${i + 1})` }} />
          ))}
        </div>
        <span className="legend-label">{format(max)}</span>
        <span className="legend-nodata">
          <svg width="14" height="14">
            <rect width="14" height="14" rx="3" fill="url(#no-data)" />
          </svg>
          No data
        </span>
        {selected.length > 0 && (
          <span className="legend-nodata">
            <svg width="14" height="14">
              <rect width="14" height="14" rx="3" fill="var(--map-dim)" />
            </svg>
            Not selected
          </span>
        )}
      </div>
      )}
      <TooltipLayer tip={tip} />
    </div>
  );
}
