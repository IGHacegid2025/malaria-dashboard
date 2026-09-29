// Author: Khadim Gueye

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewMode = "summary" | "detailed";

interface Filters {
  view: ViewMode;
  setView: (view: ViewMode) => void;
  year: number | null;
  setYear: (year: number) => void;
  states: string[];
  setStates: (states: string[]) => void;
  toggleState: (code: string) => void;
  marker: string | null;
  setMarker: (marker: string | null) => void;
}

const FilterContext = createContext<Filters | null>(null);

function readParams() {
  const params = new URLSearchParams(window.location.search);
  const year = Number(params.get("year"));
  return {
    view: (params.get("view") === "detailed" ? "detailed" : "summary") as ViewMode,
    year: Number.isInteger(year) && year > 0 ? year : null,
    states: (params.get("states") ?? "").split(",").filter((s) => /^[A-Z]{2}$/.test(s)),
    marker: params.get("marker"),
  };
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(readParams);
  const [view, setView] = useState<ViewMode>(initial.view);
  const [year, setYear] = useState<number | null>(initial.year);
  const [states, setStates] = useState<string[]>(initial.states);
  const [marker, setMarker] = useState<string | null>(initial.marker);

  const toggleState = useCallback((code: string) => {
    setStates((current) => (current.includes(code) ? current.filter((c) => c !== code) : [...current, code]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const apply = (key: string, value: string | null) => (value ? params.set(key, value) : params.delete(key));
    apply("view", view === "detailed" ? view : null);
    apply("year", year ? String(year) : null);
    apply("states", states.length ? states.join(",") : null);
    apply("marker", marker);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [view, year, states, marker]);

  return (
    <FilterContext.Provider value={{ view, setView, year, setYear, states, setStates, toggleState, marker, setMarker }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used inside FilterProvider");
  return ctx;
}

export function placeLabel(states: string[], names: Record<string, string>) {
  if (states.length === 0) return "Nigeria";
  if (states.length === 1) return names[states[0]] ?? states[0];
  if (states.length === 2) return `${names[states[0]] ?? states[0]} and ${names[states[1]] ?? states[1]}`;
  return `${states.length} states`;
}
