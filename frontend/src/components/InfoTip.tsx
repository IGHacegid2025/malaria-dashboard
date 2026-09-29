// Author: Khadim Gueye

import type { ReactNode } from "react";

export const GLOSSARY = {
  marker:
    "A resistance marker is a small genetic change in the malaria parasite that makes a drug work less well. The higher its share in a population, the higher the risk that treatment fails.",
  prevalence: "Prevalence is the share of tested parasite samples that carry the marker.",
  who: "Alert levels follow World Health Organization thresholds for each marker.",
  hrp:
    "Most rapid diagnostic tests detect a parasite protein called HRP2. Parasites with hrp2/hrp3 deletions do not produce it, so tests can miss the infection. WHO recommends switching tests when deletions exceed 5%.",
  moi:
    "Multiplicity of infection is the number of distinct parasite strains found in one patient. More strains per patient usually means more intense transmission.",
  species:
    "P. falciparum causes most severe malaria. Other species (P. malariae, P. ovale) respond differently to some drugs and tests.",
  mis: "Share of children aged 6 to 59 months who tested positive for malaria by microscopy in national household surveys: the Nigeria Malaria Indicator Survey (NMIS 2015, 2021) and the Nigeria Demographic and Health Survey (NDHS 2018).",
  map: "Click a state to add it to your selection. All figures on the page then update for the selected states.",
} as const;

export default function InfoTip({ children, label = "More information" }: { children: ReactNode; label?: string }) {
  return (
    <span className="info-tip">
      <button type="button" aria-label={label} className="info-tip-button">
        ?
      </button>
      <span role="tooltip" className="info-tip-bubble">
        {children}
      </span>
    </span>
  );
}
