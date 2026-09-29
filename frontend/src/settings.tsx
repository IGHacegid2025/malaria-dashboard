// Author: Khadim Gueye

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface SiteSettings {
  "site.title": string;
  "site.lab": string;
  "site.institute": string;
  "site.announcement": string;
  "site.about": string[];
  "nav.hidden": string[];
  "site.github_url": string;
  "site.website_url": string;
  "site.public_url": string;
  "site.contact_email": string;
  "site.data_release": string;
  "site.data_release_date": string;
  "site.doi": string;
  "site.linkedin_url": string;
  "site.default_year": number | "auto";
  "theme.primary": string;
  "theme.hero_from": string;
  "theme.hero_via": string;
  "theme.hero_to": string;
  "theme.status_high": string;
  "theme.status_watch": string;
  "theme.status_low": string;
  "theme.tile_1": string;
  "theme.tile_2": string;
  "theme.tile_3": string;
  "theme.tile_4": string;
  "theme.map_color": string;
  "theme.font_scale": number;
  "size.title": number;
  "size.kpi": number;
  "size.card_value": number;
  "size.card_title": number;
  "size.panel_title": number;
  "size.map": number;
  "size.trend_chart": number;
  "size.trend_map": number;
  "size.ranking": number;
  "size.explorer_map": number;
  "theme.page_bg": string;
  "hero.mode": "gradient" | "color" | "image" | "video";
  "hero.color": string;
  "hero.media_url": string;
  "hero.overlay": number;
}

export const THEME_DEFAULTS: Omit<SiteSettings, `site.${string}`> = {
  "nav.hidden": [],
  "theme.primary": "#2a78d6",
  "theme.hero_from": "#0d366b",
  "theme.hero_via": "#184f95",
  "theme.hero_to": "#0f7a5c",
  "theme.status_high": "#d03b3b",
  "theme.status_watch": "#fab219",
  "theme.status_low": "#0ca30c",
  "theme.tile_1": "#2a78d6",
  "theme.tile_2": "#1baf7a",
  "theme.tile_3": "#d03b3b",
  "theme.tile_4": "#eb6834",
  "theme.map_color": "#0d366b",
  "theme.font_scale": 1,
  "size.title": 30,
  "size.kpi": 26,
  "size.card_value": 26,
  "size.card_title": 16,
  "size.panel_title": 15,
  "size.map": 400,
  "size.trend_chart": 270,
  "size.trend_map": 270,
  "size.ranking": 300,
  "size.explorer_map": 560,
  "theme.page_bg": "#f4f5f7",
  "hero.mode": "gradient",
  "hero.color": "#0d366b",
  "hero.media_url": "",
  "hero.overlay": 0.45,
};

const API_BASE = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}/api`;

const SettingsContext = createContext<{ settings: SiteSettings | null; setSettings: (s: SiteSettings) => void }>({
  settings: null,
  setSettings: () => undefined,
});

function mixWithWhite(hex: string, weight: number) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(((n >> shift) & 255) * weight + 255 * (1 - weight));
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, "0")).join("")}`;
}

const RAMP_WEIGHTS = [0.06, 0.2, 0.36, 0.52, 0.68, 0.84, 0.94, 1];

export function withDefaults(s: Partial<SiteSettings>): SiteSettings {
  return { ...THEME_DEFAULTS, ...s } as SiteSettings;
}

function apply(raw: SiteSettings) {
  const s = withDefaults(raw);
  const root = document.documentElement.style;
  const colors: [string, keyof SiteSettings][] = [
    ["--series-1", "theme.primary"],
    ["--hero-from", "theme.hero_from"],
    ["--hero-via", "theme.hero_via"],
    ["--hero-to", "theme.hero_to"],
    ["--status-critical", "theme.status_high"],
    ["--status-warning", "theme.status_watch"],
    ["--status-good", "theme.status_low"],
    ["--tile-1", "theme.tile_1"],
    ["--tile-2", "theme.tile_2"],
    ["--tile-3", "theme.tile_3"],
    ["--tile-4", "theme.tile_4"],
  ];
  for (const [variable, key] of colors) root.setProperty(variable, String(s[key]));
  const sizes: [string, keyof SiteSettings][] = [
    ["--size-title", "size.title"],
    ["--size-kpi", "size.kpi"],
    ["--size-card-value", "size.card_value"],
    ["--size-card-title", "size.card_title"],
    ["--size-panel-title", "size.panel_title"],
    ["--size-map", "size.map"],
    ["--size-trend-map", "size.trend_map"],
    ["--size-ranking", "size.ranking"],
    ["--size-explorer-map", "size.explorer_map"],
  ];
  for (const [variable, key] of sizes) root.setProperty(variable, `${s[key]}px`);
  root.setProperty("--font-scale", String(s["theme.font_scale"]));
  if (s["theme.page_bg"].toLowerCase() !== THEME_DEFAULTS["theme.page_bg"]) root.setProperty("--page-plane", s["theme.page_bg"]);
  else root.removeProperty("--page-plane");
  if (s["theme.map_color"].toLowerCase() !== THEME_DEFAULTS["theme.map_color"]) {
    RAMP_WEIGHTS.forEach((w, i) => root.setProperty(`--seq-${i}`, mixWithWhite(s["theme.map_color"], w)));
  } else {
    RAMP_WEIGHTS.forEach((_, i) => root.removeProperty(`--seq-${i}`));
  }
  document.title = s["site.title"] === "Malaria Genomic Surveillance" ? "Malaria Dashboard" : s["site.title"];
}

export const PREVIEW_TARGETS: Record<string, string> = {
  header: ".app-header",
  hero: ".page-hero",
  tiles: ".stat-row",
  cards: ".policy-section",
  map: ".map-panel, .trend-map-panel, .explorer-map",
  ranking: ".ranking-wrap, .trend-ranking-panel",
  trend: ".trend-chart-panel",
  about: ".about-panel",
  page: ".dash-grid",
  footer: ".app-footer",
};

const PREVIEW_FLAG = "malaria_preview_frame";

export function isPreviewFrame() {
  if (typeof window === "undefined" || window.self === window.top) return false;
  try {
    if (new URLSearchParams(window.location.search).has("preview")) sessionStorage.setItem(PREVIEW_FLAG, "1");
    return sessionStorage.getItem(PREVIEW_FLAG) === "1";
  } catch {
    return new URLSearchParams(window.location.search).has("preview");
  }
}

function flash(target: string) {
  const selector = PREVIEW_TARGETS[target];
  if (!selector) return;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  window.scrollTo({ top: window.scrollY + rect.top - (window.innerHeight - Math.min(rect.height, window.innerHeight)) / 2, behavior: "smooth" });
  el.classList.remove("preview-flash");
  void el.offsetWidth;
  el.classList.add("preview-flash");
  window.setTimeout(() => el.classList.remove("preview-flash"), 1800);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  useAutoScale();
  const [settings, setState] = useState<SiteSettings | null>(null);
  const previewing = useRef(false);

  useEffect(() => {
    fetch(`${API_BASE}/settings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s: SiteSettings | null) => {
        if (s && !previewing.current) {
          apply(s);
          setState(withDefaults(s));
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isPreviewFrame()) return;
    document.documentElement.classList.add("in-preview");
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const msg = event.data as { type?: string; settings?: SiteSettings; target?: string };
      if (msg?.type === "malaria-preview-settings" && msg.settings) {
        previewing.current = true;
        apply(msg.settings);
        setState(withDefaults(msg.settings));
      } else if (msg?.type === "malaria-preview-focus" && msg.target) {
        flash(msg.target);
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "malaria-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const setSettings = (s: SiteSettings) => {
    apply(s);
    setState(withDefaults(s));
  };

  return <SettingsContext.Provider value={{ settings, setSettings }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

const MOBILE_BELOW = 900;
const SITE_WIDTH = 1700;
const SITE_MIN_SCALE = 0.8;
const ADMIN_WIDTH = 1366;
const ADMIN_MIN_SCALE = 0.82;

function scaleFor(width: number, full: number, min: number) {
  return width < MOBILE_BELOW || width >= full ? 1 : Math.max(min, width / full);
}

export function useAutoScale() {
  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const root = document.documentElement.style;
      root.setProperty("--auto-scale", scaleFor(width, SITE_WIDTH, SITE_MIN_SCALE).toFixed(3));
      root.setProperty("--admin-scale", scaleFor(width, ADMIN_WIDTH, ADMIN_MIN_SCALE).toFixed(3));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
}