// Author: Khadim Gueye

import type { Classification } from "../lib/analysis";

const LABELS: Record<Classification, string> = {
  low: "Low",
  intermediate: "Intermediate",
  high: "High",
  none: "No threshold",
};

function Icon({ level }: { level: Classification }) {
  if (level === "low") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="M4.8 8.2l2.1 2.1 4.3-4.4" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (level === "intermediate") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1.5l7 12.5H1z" fill="currentColor" />
        <path d="M8 6v3.6" stroke="#0b0b0b" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="11.8" r="1" fill="#0b0b0b" />
      </svg>
    );
  }
  if (level === "high") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M5.1 1h5.8L15 5.1v5.8L10.9 15H5.1L1 10.9V5.1z" fill="currentColor" />
        <path d="M8 4.4v4.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="1" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export const PLAIN_LABELS: Record<Classification, string> = {
  low: "Low risk",
  intermediate: "Watch closely",
  high: "High alert",
  none: "Not detected",
};

export default function StatusBadge({
  level,
  compact = false,
  plain = false,
  label,
}: {
  level: Classification;
  compact?: boolean;
  plain?: boolean;
  label?: string;
}) {
  return (
    <span className={`status-badge status-${level}`}>
      <Icon level={level} />
      {!compact && <span>{label ?? (plain ? PLAIN_LABELS[level] : LABELS[level])}</span>}
    </span>
  );
}
