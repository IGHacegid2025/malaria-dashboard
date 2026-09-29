// Author: Khadim Gueye

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { SiteSettings } from "../settings";

export type PreviewSize = "normal" | "large" | "full";
export type PreviewPage = "/" | "/dashboard" | "/trends" | "/map" | "/team";

export interface PreviewDims {
  height: number | null;
  width: number | null;
}

export interface FocusRequest {
  target: string;
  page?: PreviewPage;
  n: number;
}

const PAGES: { path: PreviewPage; label: string }[] = [
  { path: "/", label: "Home" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/trends", label: "Trends" },
  { path: "/map", label: "Map" },
];

const DEVICES = { desktop: 1366, phone: 390 };

export default function PreviewFrame({
  settings,
  focus,
  size,
  onSize,
  dims,
  onDims,
}: {
  settings: SiteSettings;
  focus: FocusRequest | null;
  size: PreviewSize;
  onSize: (size: PreviewSize) => void;
  dims: PreviewDims;
  onDims: (dims: PreviewDims) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  const [page, setPage] = useState<PreviewPage>("/dashboard");
  const [device, setDevice] = useState<keyof typeof DEVICES>("desktop");
  const [box, setBox] = useState({ width: 600, height: 520 });
  const [ready, setReady] = useState(false);

  const post = useCallback((message: object) => {
    frame.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [size]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if ((event.data as { type?: string })?.type === "malaria-preview-ready") {
        setReady(true);
        post({ type: "malaria-preview-settings", settings });
        if (pending.current) {
          const target = pending.current;
          pending.current = null;
          window.setTimeout(() => post({ type: "malaria-preview-focus", target }), 700);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post, settings]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => post({ type: "malaria-preview-settings", settings }), 80);
    return () => window.clearTimeout(id);
  }, [settings, ready, post]);

  useEffect(() => {
    if (!focus) return;
    if (focus.page && focus.page !== page) {
      pending.current = focus.target;
      setReady(false);
      setPage(focus.page);
    } else {
      post({ type: "malaria-preview-focus", target: focus.target });
    }
  }, [focus, page, post]);

  useEffect(() => {
    if (size !== "full") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onSize("large");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [size, onSize]);

  const startDrag = (e: ReactPointerEvent) => {
    e.preventDefault();
    const layout = (e.currentTarget as HTMLElement).closest(".settings-layout") as HTMLElement | null;
    const card = (e.currentTarget as HTMLElement).closest(".preview-card") as HTMLElement | null;
    if (!layout || !card || !viewport.current) return;
    const cardBox = card.getBoundingClientRect();
    const layoutBox = layout.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, height: viewport.current.getBoundingClientRect().height, width: cardBox.width, max: layoutBox.right - cardBox.left };
    setDragging(true);
    document.body.style.userSelect = "none";
    window.getSelection()?.removeAllRanges();
    const move = (ev: PointerEvent) => {
      ev.preventDefault();
      const height = Math.round(Math.min(Math.max(start.height + ev.clientY - start.y, 320), window.innerHeight - 120));
      const width = Math.round(Math.min(Math.max(start.width + ev.clientX - start.x, 360), start.max));
      onDims({ height, width });
    };
    const up = () => {
      setDragging(false);
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const logicalWidth = DEVICES[device];
  const scale = Math.min(1, box.width / logicalWidth);
  const frameStyle = {
    width: logicalWidth,
    height: box.height / scale,
    transform: `scale(${scale})`,
    left: device === "phone" ? Math.max(0, (box.width - logicalWidth * scale) / 2) : 0,
  };

  return (
    <div className={`preview-frame size-${size}`}>
      <div className="preview-toolbar">
        <div className="segmented" role="tablist" aria-label="Preview page">
          {PAGES.map((p) => (
            <button
              key={p.path}
              className={page === p.path ? "active" : ""}
              onClick={() => {
                setReady(false);
                setPage(p.path);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="segmented" aria-label="Device">
          <button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}>
            Desktop
          </button>
          <button className={device === "phone" ? "active" : ""} onClick={() => setDevice("phone")}>
            Phone
          </button>
        </div>
        <div className="segmented" aria-label="Preview size">
          <button className={size === "normal" ? "active" : ""} onClick={() => onSize("normal")}>
            Normal
          </button>
          <button className={size === "large" ? "active" : ""} onClick={() => onSize("large")}>
            Large
          </button>
          <button className={size === "full" ? "active" : ""} onClick={() => onSize("full")}>
            Full screen
          </button>
        </div>
      </div>
      <div className="preview-viewport" ref={viewport} style={dims.height && size !== "full" ? { height: dims.height } : undefined}>
        <iframe ref={frame} key={page} src={`${page}?preview=1`} title="Live preview of the dashboard" style={frameStyle} />
        {!ready && <div className="preview-loading">Loading preview...</div>}
        {dragging && <div className="preview-drag-shield" />}
        {size !== "full" && (
          <button
            type="button"
            className="preview-resize"
            onPointerDown={startDrag}
            onDoubleClick={() => onDims({ height: null, width: null })}
            title="Drag to resize the preview. Double-click to reset."
            aria-label="Resize the preview"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M15 9L9 15M15 4L4 15M15 14L14 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <p className="preview-caption">
        Live preview with your unsaved changes. Click a section on the left to jump to it here. Drag the corner to resize.
        {size === "full" ? " Press Esc to leave full screen." : ""}
      </p>
    </div>
  );
}
