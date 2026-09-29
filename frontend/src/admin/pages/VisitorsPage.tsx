// Author: Khadim Gueye

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { countryName, escapeHtml, flag, place } from "../../lib/countries";
import { formatDate } from "../adminApi";
import { useLoad } from "../useLoad";
import WorldMap from "../WorldMap";

interface Point {
  lat: number;
  lon: number;
  city: string | null;
  region: string | null;
  country_code: string | null;
  visits: number;
  visitors: number;
  last_visit: string;
}

interface Visitors {
  days: number;
  today: { visits: number; visitors: number };
  total: { visits: number; visitors: number; countries: number };
  online: number;
  points: Point[];
  countries: { country_code: string; visits: number; visitors: number }[];
  pages: { path: string; visits: number }[];
  devices: { device: string; visits: number }[];
  daily: { day: string; visits: number; visitors: number }[];
  recent: { created_at: string; visitor: string; country_code: string | null; region: string | null; city: string | null; path: string; device: string; referrer: string | null }[];
  geo_ready: boolean;
}

const PERIODS = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
];

const PAGE_NAMES: Record<string, string> = {
  "/": "Home",
  "/dashboard": "Dashboard",
  "/genomics": "Genomics",
  "/map": "Map",
  "/trends": "Trends",
  "/explore": "Trends",
  "/sources": "Data sources",
  "/team": "Team",
};

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="admin-empty">No visits in this period.</p>;
  return (
    <ul className="hbar-list">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="hbar-label" title={r.label}>
            {r.label}
          </span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(100 * r.value) / max}%` }} />
          </span>
          <span className="hbar-value">{r.value.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function minutesAgo(value: string) {
  return (Date.now() - new Date(value.replace(" ", "T")).getTime()) / 60000;
}

export default function VisitorsPage() {
  const [days, setDays] = useState(7);
  const { data, error, reload } = useLoad<Visitors>(`/admin/visitors?days=${days}`);
  const [updated, setUpdated] = useState(new Date());
  const [shown, setShown] = useState(20);

  useEffect(() => {
    const id = window.setInterval(() => reload().then(() => setUpdated(new Date())), 30000);
    return () => window.clearInterval(id);
  }, [reload]);

  const points = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        lat: Number(p.lat),
        lon: Number(p.lon),
        weight: p.visits,
        recent: minutesAgo(p.last_visit) < 10,
        label: `<strong>${flag(p.country_code)} ${escapeHtml(place(p.city, p.region, p.country_code))}</strong><br>${p.visits} visit${p.visits === 1 ? "" : "s"} · ${p.visitors} visitor${p.visitors === 1 ? "" : "s"}<br>Last: ${formatDate(p.last_visit)}`,
      })),
    [data],
  );

  const period = PERIODS.find((p) => p.days === days)?.label ?? `${days} days`;

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Website visitors</h1>
        <p>
          Where people open the dashboard from, found from their IP address. No name or personal data is collected for simple visits, and admin
          pages are not counted.
        </p>
      </div>
      {error && <div className="admin-alert error">{error}</div>}
      {data && !data.geo_ready && (
        <div className="admin-alert error">
          The location database is missing, so visits are counted without a place. See the README section "Visitor locations" to install it.
        </div>
      )}

      <div className="period-switch" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <button key={p.days} className={p.days === days ? "active" : ""} onClick={() => setDays(p.days)}>
            {p.label}
          </button>
        ))}
      </div>

      {data && (
        <>
          <div className="visit-stats">
            <div className="visit-stat live">
              <strong>
                <span className="live-dot" aria-hidden="true" />
                {data.online}
              </strong>
              <span>online now</span>
            </div>
            <div className="visit-stat">
              <strong>{data.today.visits.toLocaleString()}</strong>
              <span>visits today</span>
            </div>
            <div className="visit-stat">
              <strong>{data.today.visitors.toLocaleString()}</strong>
              <span>unique visitors today</span>
            </div>
            <div className="visit-stat">
              <strong>{data.total.visits.toLocaleString()}</strong>
              <span>visits ({period})</span>
            </div>
            <div className="visit-stat">
              <strong>{data.total.countries}</strong>
              <span>countries ({period})</span>
            </div>
          </div>

          <section className="admin-card">
            <div className="admin-card-head">
              <h2>
                <span className="live-dot" aria-hidden="true" /> Live map
              </h2>
              <span className="muted-note">
                Updated {updated.toLocaleTimeString("en-GB")} · orange = active in the last 10 minutes
              </span>
            </div>
            <WorldMap points={points} />
          </section>

          <div className="admin-two-col">
            <section className="admin-card">
              <h2>Top countries ({period})</h2>
              <Bars rows={data.countries.map((c) => ({ label: `${flag(c.country_code)} ${countryName(c.country_code)}`, value: c.visits }))} />
            </section>
            <section className="admin-card">
              <h2>Top pages ({period})</h2>
              <Bars rows={data.pages.map((p) => ({ label: PAGE_NAMES[p.path] ? `${PAGE_NAMES[p.path]}  ${p.path}` : p.path, value: p.visits }))} />
            </section>
          </div>

          <div className="admin-two-col wide-left">
            <section className="admin-card">
              <h2>Visits per day</h2>
              {data.daily.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.daily.map((d) => ({ ...d, day: new Date(d.day).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) }))}>
                    <CartesianGrid vertical={false} stroke="#e7ebf0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                    <Tooltip />
                    <Bar dataKey="visits" name="Visits" fill="#1baf7a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="visitors" name="Unique visitors" fill="#2a78d6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="admin-empty">No visits in this period.</p>
              )}
            </section>
            <section className="admin-card">
              <h2>Devices</h2>
              <Bars rows={data.devices.map((d) => ({ label: d.device[0].toUpperCase() + d.device.slice(1), value: d.visits }))} />
            </section>
          </div>

          <section className="admin-card">
            <h2>Latest visits</h2>
            {data.recent.length === 0 ? (
              <p className="admin-empty">No visit recorded yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="admin-table compact">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Place</th>
                      <th>Page</th>
                      <th>Device</th>
                      <th>Visitor</th>
                      <th>Came from</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.slice(0, shown).map((v, i) => (
                      <tr key={i}>
                        <td>{formatDate(v.created_at)}</td>
                        <td>
                          {flag(v.country_code)} {place(v.city, v.region, v.country_code)}
                        </td>
                        <td>{v.path}</td>
                        <td>{v.device}</td>
                        <td className="mono">{v.visitor}</td>
                        <td className="ellipsis">{v.referrer ?? "Direct"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.recent.length > shown && (
                  <div className="pager">
                    <button className="admin-button ghost small" onClick={() => setShown(shown + 40)}>
                      Show more ({data.recent.length - shown} left)
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
          <p className="muted-note">IP geolocation by <a href="https://db-ip.com" target="_blank" rel="noreferrer">DB-IP</a>. Map data OpenStreetMap.</p>
        </>
      )}
    </div>
  );
}
