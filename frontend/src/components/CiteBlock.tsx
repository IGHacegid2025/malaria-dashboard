// Author: Khadim Gueye

import { useState } from "react";
import { useSettings } from "../settings";

export function useRelease() {
  const { settings } = useSettings();
  const release = settings?.["site.data_release"] || "";
  const iso = settings?.["site.data_release_date"] || "";
  const date = iso ? new Date(`${iso}T00:00:00`) : null;
  const dateText = date ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const doi = settings?.["site.doi"] || "";
  const text = release ? `Data release ${release}${dateText ? `, ${dateText}` : ""}` : dateText ? `Data updated ${dateText}` : "";
  return { release, date, dateText, doi, text };
}

export function useCitation() {
  const { settings } = useSettings();
  const { release, date, doi } = useRelease();
  const lab = settings?.["site.lab"] ?? "Ify Aniebo Lab";
  const institute = settings?.["site.institute"] ?? "Institute of Genomics and Global Health, Nigeria";
  const title = settings?.["site.title"] ?? "Malaria Genomic Surveillance";
  const now = new Date();
  const accessed = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const url = settings?.["site.public_url"] || "https://para-sight.org/";
  const year = (date ?? now).getFullYear();
  const version = release ? `, data release ${release}` : "";
  const link = doi ? ` https://doi.org/${doi}.` : "";
  return `${lab}, ${institute}. ${year}. ${title} Dashboard${version} [online dashboard].${link} Available at: ${url} (accessed ${accessed}).`;
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
