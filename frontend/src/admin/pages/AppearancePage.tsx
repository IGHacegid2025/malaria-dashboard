// Author: Khadim Gueye

import { useEffect, useRef, useState, type ReactNode } from "react";
import { THEME_DEFAULTS, useSettings, withDefaults, type SiteSettings } from "../../settings";
import { adminApi } from "../adminApi";
import PreviewFrame, { type FocusRequest, type PreviewDims, type PreviewPage, type PreviewSize } from "../PreviewFrame";

const DIMS_KEY = "malaria_preview_dims";

function loadDims(): PreviewDims {
  try {
    const raw = JSON.parse(localStorage.getItem(DIMS_KEY) ?? "null");
    if (raw && typeof raw === "object") return { height: raw.height ?? null, width: raw.width ?? null };
  } catch {
    return { height: null, width: null };
  }
  return { height: null, width: null };
}

type ColorKey = Extract<{ [K in keyof SiteSettings]: SiteSettings[K] extends string ? K : never }[keyof SiteSettings], `theme.${string}`>;
type NumberKey = { [K in keyof SiteSettings]: SiteSettings[K] extends number ? K : never }[keyof SiteSettings];

const COLOR_GROUPS: { title: string; hint: string; target: string; items: { key: ColorKey; label: string }[] }[] = [
  {
    title: "Main colours",
    hint: "Buttons, selected year, bars and the banner at the top of each page.",
    target: "hero",
    items: [
      { key: "theme.primary", label: "Main colour" },
      { key: "theme.hero_from", label: "Banner, left" },
      { key: "theme.hero_via", label: "Banner, middle" },
      { key: "theme.hero_to", label: "Banner, right" },
    ],
  },
  {
    title: "Alert colours",
    hint: "Used on the treatment cards, badges, bars and the WHO zones of the curves.",
    target: "cards",
    items: [
      { key: "theme.status_high", label: "High alert" },
      { key: "theme.status_watch", label: "Watch closely" },
      { key: "theme.status_low", label: "Low risk" },
    ],
  },
  {
    title: "Key figure tiles",
    hint: "The coloured line on top of the four tiles under the banner.",
    target: "tiles",
    items: [
      { key: "theme.tile_1", label: "Samples sequenced" },
      { key: "theme.tile_2", label: "Markers detected" },
      { key: "theme.tile_3", label: "High alert markers" },
      { key: "theme.tile_4", label: "Malaria in children" },
    ],
  },
  {
    title: "Map",
    hint: "The darkest colour of the map. Lighter shades are generated from it.",
    target: "map",
    items: [{ key: "theme.map_color", label: "Map colour" }],
  },
];

const SIZES: { key: NumberKey; label: string; min: number; max: number; step: number; unit: string; target: string; page?: PreviewPage }[] = [
  { key: "theme.font_scale", label: "Whole site", min: 0.85, max: 1.25, step: 0.05, unit: "%", target: "page" },
  { key: "size.title", label: "Page title", min: 20, max: 48, step: 1, unit: "px", target: "hero" },
  { key: "size.kpi", label: "Key figure numbers", min: 16, max: 44, step: 1, unit: "px", target: "tiles", page: "/dashboard" },
  { key: "size.card_value", label: "Treatment card percentages", min: 16, max: 44, step: 1, unit: "px", target: "cards", page: "/dashboard" },
  { key: "size.card_title", label: "Treatment card titles", min: 12, max: 24, step: 1, unit: "px", target: "cards", page: "/dashboard" },
  { key: "size.panel_title", label: "Box titles", min: 12, max: 24, step: 1, unit: "px", target: "page", page: "/dashboard" },
  { key: "size.map", label: "Overview: map height", min: 240, max: 640, step: 10, unit: "px", target: "map", page: "/dashboard" },
  { key: "size.ranking", label: "State ranking height", min: 160, max: 640, step: 10, unit: "px", target: "ranking", page: "/dashboard" },
  { key: "size.trend_chart", label: "Trends: curve height", min: 180, max: 520, step: 10, unit: "px", target: "trend", page: "/trends" },
  { key: "size.trend_map", label: "Trends: map height", min: 180, max: 520, step: 10, unit: "px", target: "map", page: "/trends" },
  { key: "size.explorer_map", label: "Map page: map height", min: 280, max: 900, step: 10, unit: "px", target: "map", page: "/map" },
];

const HERO_MODES: { key: SiteSettings["hero.mode"]; label: string }[] = [
  { key: "gradient", label: "Gradient" },
  { key: "color", label: "Solid colour" },
  { key: "image", label: "Image" },
  { key: "video", label: "Video" },
];

const MENU_TABS: { key: string; label: string; locked?: boolean }[] = [
  { key: "home", label: "Home", locked: true },
  { key: "dashboard", label: "Dashboard", locked: true },
  { key: "map", label: "Map" },
  { key: "trends", label: "Trends" },
  { key: "genomics", label: "Genomics" },
  { key: "sources", label: "Data sources" },
  { key: "team", label: "Team" },
  { key: "projects", label: "Projects" },
];

function Section({
  children,
  onFocusTarget,
  className = "",
}: {
  children: ReactNode;
  onFocusTarget: () => void;
  className?: string;
}) {
  return (
    <section className={`admin-card focusable ${className}`} onPointerDownCapture={onFocusTarget} onFocusCapture={onFocusTarget}>
      {children}
    </section>
  );
}

export default function AppearancePage() {
  const { settings, setSettings } = useSettings();
  const [draft, setDraft] = useState<SiteSettings | null>(settings ? withDefaults(settings) : null);
  const [status, setStatus] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [size, setSize] = useState<PreviewSize>("normal");
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [dims, setDimsState] = useState<PreviewDims>(loadDims);
  const mediaInput = useRef<HTMLInputElement>(null);
  const lastFocus = useRef("");

  useEffect(() => {
    if (settings && !draft) setDraft(withDefaults(settings));
  }, [settings, draft]);

  if (!draft) return <div className="loading">Loading settings...</div>;

  const setDims = (next: PreviewDims) => {
    setDimsState(next);
    try {
      localStorage.setItem(DIMS_KEY, JSON.stringify(next));
    } catch {
      return;
    }
  };

  const changeSize = (next: PreviewSize) => {
    setSize(next);
    if (next !== "full") setDims({ height: null, width: null });
  };

  const layoutStyle =
    dims.width && size !== "full" ? { gridTemplateColumns: `minmax(360px, 560px) minmax(0, ${dims.width}px)` } : undefined;

  const saved = settings ? withDefaults(settings) : draft;
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setDraft({ ...draft, [key]: value });

  const point = (target: string, page?: PreviewPage) => {
    const key = `${target}|${page ?? ""}`;
    if (key === lastFocus.current) return;
    lastFocus.current = key;
    window.setTimeout(() => {
      if (lastFocus.current === key) lastFocus.current = "";
    }, 1500);
    setFocus({ target, page, n: Date.now() });
  };

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await adminApi.put<SiteSettings>("/admin/settings", draft);
      setSettings(result);
      setDraft(withDefaults(result));
      setStatus({ type: "success", text: "Saved. Visitors see the changes on their next page load." });
    } catch (err) {
      setStatus({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const uploadMedia = async (file: File) => {
    setUploading(true);
    setStatus(null);
    setMediaError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await adminApi.post<{ url: string; kind: "image" | "video" }>("/admin/media", form);
      setDraft({ ...draft, "hero.media_url": res.url, "hero.mode": res.kind });
      point("hero");
      setStatus({ type: "success", text: `${res.kind === "video" ? "Video" : "Image"} added to the preview. Click Save settings to publish it.` });
    } catch (err) {
      setMediaError((err as Error).message);
    } finally {
      setUploading(false);
      if (mediaInput.current) mediaInput.current.value = "";
    }
  };

  return (
    <div className="admin-page full-width">
      <div className="admin-page-head">
        <h1>Site settings</h1>
        <p>
          Change texts, colours, backgrounds and sizes without touching the code. The preview shows the real dashboard with your
          changes before you save.
        </p>
      </div>

      <div className={`settings-layout preview-${size}`} style={layoutStyle}>
        <div className="settings-stack">
          <Section onFocusTarget={() => point("header")}>
            <div>
              <h2>Menu tabs</h2>
              <p className="admin-hint">Switch a tab off to remove it from the website menu. Its page is not deleted and comes back when you switch it on.</p>
            </div>
            <div className="tab-switches">
              {MENU_TABS.map((tab) => {
                const hiddenTabs = draft["nav.hidden"] ?? [];
                const on = tab.locked || !hiddenTabs.includes(tab.key);
                return (
                  <label key={tab.key} className={`switch-field${tab.locked ? " locked" : ""}`} title={tab.locked ? "This tab is always shown" : undefined}>
                    {tab.label}
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={tab.locked}
                      onChange={(e) => set("nav.hidden", e.target.checked ? hiddenTabs.filter((k) => k !== tab.key) : [...hiddenTabs, tab.key])}
                    />
                    <span className="switch" aria-hidden="true" />
                  </label>
                );
              })}
            </div>
          </Section>

          <Section onFocusTarget={() => point("header")}>
            <h2>Texts</h2>
            <label className="admin-field">
              <span>Dashboard title</span>
              <input value={draft["site.title"]} onChange={(e) => set("site.title", e.target.value)} />
            </label>
            <div className="admin-form-row">
              <label className="admin-field grow">
                <span>Lab name</span>
                <input value={draft["site.lab"]} onChange={(e) => set("site.lab", e.target.value)} />
              </label>
              <label className="admin-field grow">
                <span>Institute</span>
                <input value={draft["site.institute"]} onChange={(e) => set("site.institute", e.target.value)} />
              </label>
            </div>
            <div className="admin-form-row" onPointerDownCapture={() => point("footer")} onFocusCapture={() => point("footer")}>
              <label className="admin-field grow">
                <span>Public address of the dashboard (used in the citation)</span>
                <input value={draft["site.public_url"] ?? ""} placeholder="https://para-sight.org/" onChange={(e) => set("site.public_url", e.target.value)} />
              </label>
              <label className="admin-field grow">
                <span>Institute website (footer link)</span>
                <input value={draft["site.website_url"] ?? ""} placeholder="https://" onChange={(e) => set("site.website_url", e.target.value)} />
              </label>
              <label className="admin-field grow">
                <span>LinkedIn (footer link)</span>
                <input value={draft["site.linkedin_url"] ?? ""} placeholder="https://www.linkedin.com/" onChange={(e) => set("site.linkedin_url", e.target.value)} />
              </label>
              <label className="admin-field grow">
                <span>GitHub (footer link)</span>
                <input value={draft["site.github_url"] ?? ""} placeholder="https://github.com/" onChange={(e) => set("site.github_url", e.target.value)} />
              </label>
            </div>
            <div className="admin-field" onPointerDownCapture={() => point("page", "/dashboard")}>
              <span>Default year shown when the dashboard opens</span>
              <div className="default-year-row">
                <div className="segmented">
                  <button type="button" className={draft["site.default_year"] === "auto" ? "active" : ""} onClick={() => set("site.default_year", "auto")}>
                    Automatic (latest year with data)
                  </button>
                  <button
                    type="button"
                    className={draft["site.default_year"] !== "auto" ? "active" : ""}
                    onClick={() => set("site.default_year", draft["site.default_year"] === "auto" ? new Date().getFullYear() - 1 : draft["site.default_year"])}
                  >
                    Fixed year
                  </button>
                </div>
                {draft["site.default_year"] !== "auto" && (
                  <input
                    type="number"
                    className="admin-input year-input"
                    min={1980}
                    max={new Date().getFullYear() + 1}
                    value={draft["site.default_year"] ?? 2021}
                    onChange={(e) => set("site.default_year", Number(e.target.value))}
                  />
                )}
              </div>
            </div>
            <label className="admin-field">
              <span>Announcement banner (leave empty to hide)</span>
              <input
                value={draft["site.announcement"]}
                placeholder="e.g. New 2024 sequencing data added"
                onChange={(e) => set("site.announcement", e.target.value)}
              />
            </label>
            <label className="admin-field" onFocusCapture={() => point("about", "/dashboard")} onPointerDownCapture={() => point("about", "/dashboard")}>
              <span>About this dashboard (one paragraph per blank line)</span>
              <textarea
                rows={5}
                value={draft["site.about"].join("\n\n")}
                onChange={(e) =>
                  set(
                    "site.about",
                    e.target.value
                      .split(/\n\s*\n/)
                      .map((p) => p.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
          </Section>

          {COLOR_GROUPS.map((group) => (
            <Section key={group.title} onFocusTarget={() => point(group.target, group.target === "map" ? undefined : "/dashboard")}>
              <div>
                <h2>{group.title}</h2>
                <p className="admin-hint">{group.hint}</p>
              </div>
              <div className="color-grid">
                {group.items.map((c) => (
                  <label key={c.key} className="color-field">
                    <input type="color" value={draft[c.key]} onChange={(e) => set(c.key, e.target.value)} />
                    <span>{c.label}</span>
                    <button
                      type="button"
                      className="color-reset"
                      title="Back to default"
                      disabled={draft[c.key].toLowerCase() === THEME_DEFAULTS[c.key].toLowerCase()}
                      onClick={(e) => {
                        e.preventDefault();
                        set(c.key, THEME_DEFAULTS[c.key]);
                      }}
                    >
                      {draft[c.key]}
                    </button>
                  </label>
                ))}
              </div>
            </Section>
          ))}

          <Section onFocusTarget={() => point("hero")}>
            <div>
              <h2>Background</h2>
              <p className="admin-hint">Colour of the whole dashboard, and the background of the banner at the top of each page.</p>
            </div>
            <label className="color-field single" onPointerDownCapture={() => point("page")}>
              <input type="color" value={draft["theme.page_bg"]} onChange={(e) => set("theme.page_bg", e.target.value)} />
              <span>Page background</span>
              <button
                type="button"
                className="color-reset"
                disabled={draft["theme.page_bg"].toLowerCase() === THEME_DEFAULTS["theme.page_bg"]}
                onClick={(e) => {
                  e.preventDefault();
                  set("theme.page_bg", THEME_DEFAULTS["theme.page_bg"]);
                }}
              >
                {draft["theme.page_bg"]}
              </button>
            </label>
            <div className="admin-field">
              <span>Banner style</span>
              <div className="segmented full">
                {HERO_MODES.map((m) => (
                  <button key={m.key} type="button" className={draft["hero.mode"] === m.key ? "active" : ""} onClick={() => set("hero.mode", m.key)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {draft["hero.mode"] === "gradient" && <p className="admin-hint">Uses the three banner colours from Main colours.</p>}
            {draft["hero.mode"] === "color" && (
              <label className="color-field single">
                <input type="color" value={draft["hero.color"]} onChange={(e) => set("hero.color", e.target.value)} />
                <span>Banner colour</span>
                <code>{draft["hero.color"]}</code>
              </label>
            )}
            {(draft["hero.mode"] === "image" || draft["hero.mode"] === "video") && (
              <>
                <div className="media-row">
                  <button type="button" className="admin-button ghost" onClick={() => mediaInput.current?.click()} disabled={uploading}>
                    {uploading ? "Uploading..." : draft["hero.media_url"] ? "Replace the file" : draft["hero.mode"] === "image" ? "Upload an image" : "Upload a video"}
                  </button>
                  <span className="admin-hint">
                    {draft["hero.mode"] === "image" ? "JPG, PNG or WebP, up to 25 MB. Large photos are resized automatically. Wide photos work best." : "MP4 or WebM, up to 25 MB. Plays muted and on a loop."}
                  </span>
                  <input
                    ref={mediaInput}
                    type="file"
                    hidden
                    accept={draft["hero.mode"] === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm"}
                    onChange={(e) => e.target.files?.[0] && uploadMedia(e.target.files[0])}
                  />
                </div>
                {mediaError && <div className="admin-alert error">{mediaError}</div>}
                {!draft["hero.media_url"] && <div className="admin-alert info">No file yet. Upload one: it appears in the preview right away.</div>}
                <label className="size-field">
                  <span>
                    Darken for readable text
                    <strong>{Math.round(draft["hero.overlay"] * 100)}%</strong>
                  </span>
                  <input type="range" min={0} max={0.85} step={0.05} value={draft["hero.overlay"]} onChange={(e) => set("hero.overlay", Number(e.target.value))} />
                </label>
              </>
            )}
          </Section>

          <Section onFocusTarget={() => undefined}>
            <div>
              <h2>Sizes</h2>
              <p className="admin-hint">Move a slider: the preview jumps to that element. Phones use slightly smaller values automatically.</p>
            </div>
            <div className="size-grid">
              {SIZES.map((s) => (
                <label key={s.key} className="size-field" onPointerDownCapture={() => point(s.target, s.page)} onFocusCapture={() => point(s.target, s.page)}>
                  <span>
                    {s.label}
                    <strong>{s.unit === "%" ? `${Math.round(draft[s.key] * 100)}%` : `${draft[s.key]} px`}</strong>
                  </span>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={draft[s.key]} onChange={(e) => set(s.key, Number(e.target.value))} />
                </label>
              ))}
            </div>
          </Section>

          <section className="admin-card save-bar">
            {status && <div className={`admin-alert ${status.type}`}>{status.text}</div>}
            <div className="save-row">
              <span className={`dirty-note${dirty ? " on" : ""}`}>{dirty ? "Unsaved changes, visible only in the preview" : "All changes saved"}</span>
              <button className="admin-button ghost" onClick={() => setDraft(saved)} disabled={!dirty}>
                Discard changes
              </button>
              <button className="admin-button ghost" onClick={() => setDraft({ ...draft, ...THEME_DEFAULTS })}>
                Reset to defaults
              </button>
              <button className="admin-button primary" onClick={save} disabled={busy || !dirty}>
                {busy ? "Saving..." : "Save settings"}
              </button>
            </div>
          </section>
        </div>

        <section className={`admin-card preview-card preview-${size}`}>
          <h2>Live preview</h2>
          <PreviewFrame settings={draft} focus={focus} size={size} onSize={changeSize} dims={dims} onDims={setDims} />
        </section>
      </div>
    </div>
  );
}
