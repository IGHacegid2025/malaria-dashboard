// Author: Khadim Gueye

import { useMemo, useState } from "react";
import CiteBlock from "../components/CiteBlock";
import HeroBackdrop from "../components/HeroBackdrop";
import { EmptyState, Panel, StatTile } from "../components/Panels";
import { useDashboardData } from "../hooks/useDashboardData";

export default function SourcesPage() {
  const { data, error } = useDashboardData();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.publications.filter(
      (p) =>
        !term ||
        p.author.toLowerCase().includes(term) ||
        (p.title ?? "").toLowerCase().includes(term) ||
        String(p.year_of_publication).includes(term),
    );
  }, [data, search]);

  if (error) return <EmptyState>Cannot reach the API ({error}).</EmptyState>;
  if (!data) return <div className="loading">Loading publications...</div>;

  const sequencingObs = data.observations.filter((o) => o.source_type === "sequencing").length;
  const publicationObs = data.observations.length - sequencingObs;
  const years = data.publications.map((p) => p.year_of_publication);

  return (
    <div className="page">
      <div className="page-hero compact">
        <HeroBackdrop />
        <div>
          <p className="eyebrow">Evidence base</p>
          <h1 className="page-title">
            Data <span>sources</span>
          </h1>
          <p className="page-lede">
            Every figure on this dashboard comes from IGH genomic sequencing or from a published study on Nigerian samples.
          </p>
        </div>
      </div>

      <div className="stat-row">
        <StatTile label="Publications" value={data.publications.length} detail={`Published ${Math.min(...years)} to ${Math.max(...years)}`} />
        <StatTile label="Publication data points" value={publicationObs.toLocaleString()} detail="marker prevalences from studies" />
        <StatTile label="Sequencing data points" value={sequencingObs.toLocaleString()} detail="marker prevalences from IGH sequencing" />
        <StatTile label="States covered" value={new Set(data.observations.map((o) => o.state)).size} detail="of 37 states and FCT" />
      </div>

      <CiteBlock />

      <Panel
        title="Publications"
        subtitle={`${rows.length} of ${data.publications.length} shown`}
        actions={
          <input
            className="search-input"
            type="search"
            placeholder="Search author, title or year"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search publications"
          />
        }
      >
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Author</th>
                <th className="num">Year</th>
                <th>Title</th>
                <th className="num">Data points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="strong">{p.author}</td>
                  <td className="num">{p.year_of_publication}</td>
                  <td>
                    {p.doi ? (
                      <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">
                        {p.title ?? p.doi}
                      </a>
                    ) : (
                      <span className="muted">{p.title ?? "Reference details pending"}</span>
                    )}
                  </td>
                  <td className="num">{p.observation_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
