// Author: Khadim Gueye

import { useState } from "react";
import { useSettings } from "../settings";

export function useCitation() {
  const { settings } = useSettings();
  const lab = settings?.["site.lab"] ?? "Ify Aniebo Lab";
  const institute = settings?.["site.institute"] ?? "Institute of Genomics and Global Health, Nigeria";
  const title = settings?.["site.title"] ?? "Malaria Genomic Surveillance";
  const now = new Date();
  const accessed = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const url = settings?.["site.public_url"] || "https://para-sight.org/";
  return `${lab}, ${institute}. ${now.getFullYear()}. ${title} Dashboard [online dashboard]. Available at: ${url} (accessed ${accessed}).`;
}

export default function CiteBlock({ compact = false }: { compact?: boolean }) {
  const citation = useCitation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`cite-block${compact ? " compact" : ""}`}>
      <div className="cite-head">
        <span className="cite-label">How to cite this dashboard</span>
        <button type="button" className="cite-copy" onClick={copy}>
          {copied ? "Copied" : "Copy citation"}
        </button>
      </div>
      <p className="cite-text">{citation}</p>
      <p className="cite-note">
        When you use specific figures, please also cite the original sources: IGH genomic sequencing, the published studies listed on the Data
        sources page, and the national surveys named under each map.
      </p>
    </div>
  );
}
