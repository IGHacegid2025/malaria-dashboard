// Author: Khadim Gueye

export interface Survey {
  short: string;
  citation: string;
  table: string;
  url: string;
}

export const MIS_SURVEYS: Record<number, Survey> = {
  2015: {
    short: "NMIS 2015",
    citation:
      "National Malaria Elimination Programme (NMEP), National Population Commission (NPopC), National Bureau of Statistics (NBS), and ICF International. 2016. Nigeria Malaria Indicator Survey 2015. Abuja, Nigeria, and Rockville, Maryland, USA.",
    table: "Table 6.3.2, microscopy",
    url: "https://dhsprogram.com/pubs/pdf/MIS20/MIS20.pdf",
  },
  2018: {
    short: "NDHS 2018",
    citation:
      "National Population Commission (NPC) [Nigeria] and ICF. 2019. Nigeria Demographic and Health Survey 2018. Abuja, Nigeria, and Rockville, Maryland, USA.",
    table: "Table 12.16, microscopy",
    url: "https://dhsprogram.com/pubs/pdf/FR359/FR359.pdf",
  },
  2021: {
    short: "NMIS 2021",
    citation:
      "National Malaria Elimination Programme (NMEP) [Nigeria], National Population Commission (NPC) [Nigeria], and ICF. 2022. Nigeria Malaria Indicator Survey 2021 Final Report. Abuja, Nigeria, and Rockville, Maryland, USA.",
    table: "Table 4.8.2, microscopy",
    url: "https://dhsprogram.com/pubs/pdf/MIS41/MIS41.pdf",
  },
};

export function surveyName(year: number | null | undefined) {
  if (!year) return "national survey";
  return MIS_SURVEYS[year]?.short ?? `national survey ${year}`;
}
