// Author: Khadim Gueye

const DHFR_CODONS = new Set([16, 50, 51, 59, 108, 164]);
const COMBINATION_NAMES: Record<number, string> = { 2: "double", 3: "triple", 4: "quadruple", 5: "quintuple", 6: "sextuple", 7: "septuple" };

function splitCombination(mutation: string) {
  const dhps: string[] = [];
  const dhfr: string[] = [];
  for (const part of mutation.split("-").filter(Boolean)) {
    const codon = Number(part.match(/\d+/)?.[0]);
    (DHFR_CODONS.has(codon) ? dhfr : dhps).push(part);
  }
  return { dhps, dhfr };
}

export function geneLabel(gene: string) {
  return gene === "psfr" ? "dhps/dhfr" : gene;
}

export function mutationLabel(gene: string, mutation: string) {
  if (gene !== "psfr") return mutation;
  const { dhps, dhfr } = splitCombination(mutation);
  return [dhps.join(", "), dhfr.join(", ")].filter(Boolean).join(" + ");
}

export function markerLabel(gene: string, mutation: string) {
  return `${geneLabel(gene)} ${mutationLabel(gene, mutation)}`;
}

export function markerTip(gene: string, mutation: string) {
  if (gene !== "psfr") return undefined;
  const { dhps, dhfr } = splitCombination(mutation);
  const size = COMBINATION_NAMES[dhps.length + dhfr.length];
  return `Combined dhps + dhfr haplotype${size ? ` (${size} mutant)` : ""}: dhps ${dhps.join(", ") || "wild type"} with dhfr ${dhfr.join(", ") || "wild type"}.`;
}
