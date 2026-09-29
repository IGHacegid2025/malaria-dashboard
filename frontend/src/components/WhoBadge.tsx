// Author: Khadim Gueye

import type { WhoStatus } from "../api";

const LABELS: Record<WhoStatus, string> = {
  validated: "WHO validated",
  candidate: "WHO candidate",
  none: "Other marker",
};

const TIPS: Record<WhoStatus, string> = {
  validated: "Listed by WHO as a validated marker of resistance.",
  candidate: "Listed by WHO as a candidate marker: association with resistance is suspected but not yet confirmed.",
  none: "Associated with resistance, but not classified here as a WHO validated or candidate marker.",
};

export default function WhoBadge({ status, showOther = false, large = false }: { status: WhoStatus; showOther?: boolean; large?: boolean }) {
  if (status === "none" && !showOther) return null;
  return (
    <span className={`who-badge who-${status}${large ? " who-badge-lg" : ""}`} title={TIPS[status]}>
      {LABELS[status]}
    </span>
  );
}
