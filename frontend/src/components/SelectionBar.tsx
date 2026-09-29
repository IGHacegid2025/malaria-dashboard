// Author: Khadim Gueye

import { useEffect, useRef, useState } from "react";
import type { StateInfo } from "../api";

export function StatePicker({
  states,
  selected,
  onToggle,
  onClear,
  label = "Focus",
}: {
  states: StateInfo[];
  selected: string[];
  onToggle: (code: string) => void;
  onClear: () => void;
  label?: string;
}) {
  const names = Object.fromEntries(states.map((s) => [s.code, s.name]));
  const available = states.filter((s) => !selected.includes(s.code));
  return (
    <div className="state-picker">
      <label htmlFor="state-select">{label}</label>
      <div className="state-chips">
        {selected.length === 0 && <span className="state-chip all">All Nigeria</span>}
        {selected.map((code) => (
          <span className="state-chip" key={code}>
            {names[code] ?? code}
            <button onClick={() => onToggle(code)} aria-label={`Remove ${names[code] ?? code}`}>
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ))}
        <select
          id="state-select"
          value=""
          onChange={(e) => {
            if (e.target.value) onToggle(e.target.value);
          }}
          aria-label="Add a state"
        >
          <option value="">{selected.length ? "+ Add state" : "+ Select states"}</option>
          {available.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        {selected.length > 0 && (
          <button className="clear-chip" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  years: number[];
  year: number;
  onYear: (year: number) => void;
  states: StateInfo[];
  selected: string[];
  onToggle: (code: string) => void;
  onClear: () => void;
  yearsWithSequencing?: Set<number>;
}

function YearStrip({
  years,
  year,
  onYear,
  yearsWithSequencing,
}: {
  years: number[];
  year: number;
  onYear: (year: number) => void;
  yearsWithSequencing?: Set<number>;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const current = new Date().getFullYear();
  const first = Math.min(...(years.length ? years : [current]), current);
  const last = Math.max(current, ...years);
  const all = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const withData = new Set(years);

  const update = () => {
    const el = track.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [all.length]);

  useEffect(() => {
    const box = track.current;
    const el = box?.querySelector<HTMLElement>(".year-pill.active");
    if (!box || !el) return;
    const left = el.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft;
    if (left < box.scrollLeft || left + el.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: left - (box.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
    }
  }, [year]);

  const shift = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.6, behavior: "smooth" });

  return (
    <div className="year-strip">
      <button className="year-arrow" onClick={() => shift(-1)} disabled={!edges.left} aria-label="Earlier years">
        ‹
      </button>
      <div className="year-pills" role="tablist" aria-label="Year" ref={track} onScroll={update}>
        {all.map((y) => {
          const has = withData.has(y);
          return (
            <button
              key={y}
              role="tab"
              aria-selected={y === year}
              className={`year-pill${y === year ? " active" : ""}${has ? "" : " empty"}${y === current ? " current" : ""}`}
              onClick={() => onYear(y)}
              title={!has ? "No data yet for this year" : yearsWithSequencing?.has(y) ? "Includes IGH sequencing data" : "Publications only"}
            >
              {y}
              {yearsWithSequencing?.has(y) && <span className="seq-dot" aria-label="sequencing data" />}
            </button>
          );
        })}
      </div>
      <button className="year-arrow" onClick={() => shift(1)} disabled={!edges.right} aria-label="Later years">
        ›
      </button>
    </div>
  );
}

export default function SelectionBar({ years, year, onYear, states, selected, onToggle, onClear, yearsWithSequencing }: Props) {
  return (
    <div className="selection-bar">
      <YearStrip years={years} year={year} onYear={onYear} yearsWithSequencing={yearsWithSequencing} />
      <StatePicker states={states} selected={selected} onToggle={onToggle} onClear={onClear} />
    </div>
  );
}