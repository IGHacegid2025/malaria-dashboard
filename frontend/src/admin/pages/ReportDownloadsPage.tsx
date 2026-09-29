// Author: Khadim Gueye

import { useEffect, useMemo, useState } from "react";
import { countryName, escapeHtml, flag, place } from "../../lib/countries";
import { adminApi, formatDate } from "../adminApi";
import { useLoad } from "../useLoad";
import WorldMap from "../WorldMap";

interface Download {
  id: number;
  name: string;
  email: string;
  organization: string | null;
  kind: "report" | "data";
  country_code: string | null;
  region: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  page: string | null;
  report: string;
  created_at: string;
}

interface Downloads {
  total: number;
  rows: Download[];
  stats: { downloads: number; people: number; countries: number; last_30_days: number | null };
  countries: { country_code: string; downloads: number }[];
}

const PAGE = 50;

export default function ReportDownloadsPage() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [offset, setOffset] = useState(0);
  const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
  if (term) params.set("search", term);
  const { data, error } = useLoad<Downloads>(`/admin/report-downloads?${params.toString()}`);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setTerm(search.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const points = useMemo(
    () =>
      (data?.rows ?? [])
        .filter((r) => r.latitude !== null && r.longitude !== null)
        .map((r) => ({
          lat: Number(r.latitude),
          lon: Number(r.longitude),
          weight: 1,
          label: `<strong>${escapeHtml(r.name)}</strong><br>${escapeHtml(r.organization ?? r.email)}<br>${flag(r.country_code)} ${escapeHtml(place(r.city, r.region, r.country_code))}`,
        })),
    [data],
  );

  const exportCsv = () => {
    setExportError(null);
    adminApi
      .download(`/admin/report-downloads.csv${term ? `?search=${encodeURIComponent(term)}` : ""}`, "report_downloads.csv")
      .catch((err: Error) => setExportError(err.message));
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Report downloads</h1>
        <p>Everyone who downloaded a PDF report or a data file from the website. The country and city are worked out from the connection when the report is requested. The IP address itself is not kept.</p>
      </div>
      {error && <div className="admin-alert error">{error}</div>}
      {exportError && <div className="admin-alert error">{exportError}</div>}

      {data && (
        <div className="visit-stats">
          <div className="visit-stat">
            <strong>{data.stats.downloads.toLocaleString()}</strong>
            <span>downloads</span>
          </div>
          <div className="visit-stat">
            <strong>{data.stats.people.toLocaleString()}</strong>
            <span>different people</span>
          </div>
          <div className="visit-stat">
            <strong>{Number(data.stats.last_30_days ?? 0).toLocaleString()}</strong>
            <span>in the last 30 days</span>
          </div>
          <div className="visit-stat">
            <strong>{data.stats.countries}</strong>
            <span>countries</span>
          </div>
        </div>
      )}

      {data && points.length > 0 && (
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Where reports are downloaded</h2>
            <span className="muted-note">
              {data.countries.map((c) => `${flag(c.country_code)} ${countryName(c.country_code)} ${c.downloads}`).join("  ·  ")}
            </span>
          </div>
          <WorldMap points={points} height={320} />
        </section>
      )}

      <section className="admin-card">
        <div className="records-toolbar">
          <input className="admin-input grow" placeholder="Search name, email, organisation, country or city" value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="records-count">{data ? `${data.total} downloads` : ""}</span>
          <button className="admin-button ghost small" onClick={exportCsv} disabled={!data?.total}>
            Export CSV
          </button>
        </div>
        {data && data.rows.length === 0 ? (
          <p className="admin-empty">{term ? "No download matches this search." : "No report downloaded yet."}</p>
        ) : (
          <div className="table-scroll">
            <table className="admin-table compact">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Organisation</th>
                  <th>Place</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.created_at)}</td>
                    <td>
                      <span className={`download-kind ${r.kind}`}>{r.kind === "data" ? "Data (CSV)" : "PDF report"}</span>
                    </td>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>
                      <a href={`mailto:${r.email}`}>{r.email}</a>
                    </td>
                    <td>{r.organization ?? ""}</td>
                    <td>
                      {flag(r.country_code)} {place(r.city, r.region, r.country_code)}
                    </td>
                    <td className="ellipsis" title={r.page ?? ""}>
                      {r.page?.startsWith("/") ? (
                        <a href={r.page} target="_blank" rel="noreferrer">
                          {r.report || r.page}
                        </a>
                      ) : (
                        r.report || r.page || ""
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PAGE && (
          <div className="pager">
            <button className="admin-button ghost small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              Newer
            </button>
            <span>
              {offset + 1} to {Math.min(offset + PAGE, data.total)} of {data.total}
            </span>
            <button className="admin-button ghost small" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
              Older
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
