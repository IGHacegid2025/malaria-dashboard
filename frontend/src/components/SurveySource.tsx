// Author: Khadim Gueye

import { MIS_SURVEYS } from "../lib/surveys";

export default function SurveySource({ year }: { year: number }) {
  const survey = MIS_SURVEYS[year];
  if (!survey) return null;
  return (
    <p className="survey-source">
      <span className="survey-source-label">Source</span>
      <span>
        {survey.citation} {survey.table}.{" "}
        <a href={survey.url} target="_blank" rel="noreferrer">
          View the report
        </a>
      </span>
    </p>
  );
}
