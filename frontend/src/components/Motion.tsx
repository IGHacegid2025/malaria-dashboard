// Author: Khadim Gueye

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { animate, easeOut, prefersReducedMotion } from "../lib/motion";

export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  duration = 800,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    const start = from.current;
    stop.current = animate(
      duration,
      (k) => {
        const next = start + (value - start) * k;
        from.current = next;
        setShown(next);
      },
      easeOut,
    );
    return () => stop.current?.();
  }, [value, duration]);

  useEffect(() => {
    const settle = () => {
      stop.current?.();
      from.current = value;
      setShown(value);
    };
    window.addEventListener("beforeprint", settle);
    return () => window.removeEventListener("beforeprint", settle);
  }, [value]);

  return (
    <span className="count-up">
      <span className="count-live">{format(shown)}</span>
      <span className="count-final">{format(value)}</span>
    </span>
  );
}

function offsetLabel(date: Date) {
  const minutes = -date.getTimezoneOffset();
  if (minutes === 0) return "GMT";
  const sign = minutes > 0 ? "+" : "-";
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

export function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const zone = (() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
      return tz.includes("/") ? tz.split("/").pop()!.replace(/_/g, " ") : tz;
    } catch {
      return "";
    }
  })();
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const day = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <time className="live-clock" dateTime={now.toISOString()}>
      <span className="live-clock-time">{time}</span>
      <span>{day}</span>
      <span title="Detected from your device">
        {zone ? `${zone} · ` : ""}
        {offsetLabel(now)}
      </span>
    </time>
  );
}

export function Reveal({
  as: Tag = "div",
  className = "",
  delay = 0,
  children,
}: {
  as?: ElementType;
  className?: string;
  delay?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === "undefined" || prefersReducedMotion());

  useEffect(() => {
    if (shown || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <Tag ref={ref} className={`reveal${shown ? " in" : ""} ${className}`.trim()} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}

export function RotatingText({ items, interval = 3200 }: { items: string[]; interval?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length < 2 || prefersReducedMotion()) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % items.length), interval);
    return () => window.clearInterval(id);
  }, [items.length, interval]);

  return (
    <span className="rotating-text" aria-live="off">
      <span key={index} className="rotating-item">
        {items[index % items.length]}
      </span>
    </span>
  );
}
