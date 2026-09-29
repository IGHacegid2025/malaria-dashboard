// Author: Khadim Gueye

import { useSettings, withDefaults, type SiteSettings } from "../settings";

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function mediaSrc(url: string) {
  return url.startsWith("/api/") ? `${API_ORIGIN}${url}` : url;
}

export function Backdrop({ settings }: { settings: SiteSettings }) {
  const mode = settings["hero.mode"];
  const url = settings["hero.media_url"];
  if (mode === "gradient") return null;
  const overlay = <span className="hero-overlay" style={{ opacity: settings["hero.overlay"] }} />;
  if (mode === "color") {
    return <span className="hero-backdrop" style={{ background: settings["hero.color"] }} aria-hidden="true" />;
  }
  if (!url) return null;
  if (mode === "image") {
    return (
      <span className="hero-backdrop" aria-hidden="true">
        <span className="hero-image" style={{ backgroundImage: `url("${mediaSrc(url)}")` }} />
        {overlay}
      </span>
    );
  }
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <span className="hero-backdrop" aria-hidden="true">
      <video className="hero-video" src={mediaSrc(url)} autoPlay={!reduced} muted loop playsInline preload="metadata" />
      {overlay}
    </span>
  );
}

export default function HeroBackdrop() {
  const { settings } = useSettings();
  if (!settings) return null;
  return <Backdrop settings={withDefaults(settings)} />;
}
