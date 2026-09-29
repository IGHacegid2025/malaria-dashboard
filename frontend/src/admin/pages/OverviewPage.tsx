// Author: Khadim Gueye

import { Link } from "react-router-dom";
import { useAuth } from "../AdminApp";
import { ACTION_LABELS, formatDate } from "../adminApi";
import { useLoad } from "../useLoad";

interface Overview {
  counts: Record<string, { total: number; hidden: number }>;
  recent_uploads: { id: number; kind: string; filename: string; rows_inserted: number; is_hidden: number; created_at: string; email: string | null }[];
  activity: { id: number; user_email: string | null; action: string; entity: string | null; entity_id: string | null; created_at: string }[];
}

const LABELS: Record<string, string> = {
  observations: "Mutation records",
  publications: "Publications",
  species: "Species records",
  diagnostics: "hrp2/3 records",
  moi: "MOI records",
  mis: "MIS records",
};

export const KIND_LABELS: Record<string, string> = {
  sequencing_mutations: "Sequencing mutations",
  publication_mutations: "Publication mutations",
  species: "Species",
  diagnostic: "Diagnostics hrp2/3",
  moi: "Parasite clones (MOI)",
  mis: "Malaria in children (MIS)",
};

export default function OverviewPage() {
  const { user } = useAuth();
  const { data, error } = useLoad<Overview>("/admin/overview");

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Welcome{user.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}</h1>
        <p>Manage the data and content of the public dashboard. Every change is recorded.</p>
      </div>

      <div className="quick-actions">
        <Link to="/admin/submit" className="quick-action primary">
          <strong>Submit new data</strong>
          <span>Download a template, fill it, upload it</span>
        </Link>
        <Link to="/admin/records" className="quick-action">
          <strong>Review data</strong>
          <span>Search and hide incorrect records</span>
        </Link>
        <Link to="/admin/thresholds" className="quick-action">
          <strong>WHO thresholds</strong>
          <span>Alert levels and messages</span>
        </Link>
        <Link to="/admin/appearance" className="quick-action">
          <strong>Site settings</strong>
          <span>Texts, colours, announcement</span>
        </Link>
      </div>

      {error && <div className="admin-alert error">{error}</div>}

      {data && (
        <>
          <div className="count-grid">
            {Object.entries(data.counts).map(([key, c]) => (
              <Link key={key} to={`/admin/records?entity=${key}`} className="count-card">
                <span>{LABELS[key] ?? key}</span>
                <strong>{(c.total - c.hidden).toLocaleString()}</strong>
                <small>{c.hidden ? `${c.hidden} hidden` : "all visible"}</small>
              </Link>
            ))}
          </div>

          <div className="admin-two-col">
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>Recent uploads</h2>
                <Link to="/admin/uploads">See all</Link>
              </div>
              {data.recent_uploads.length === 0 ? (
                <p className="admin-empty">No data submitted yet.</p>
              ) : (
                <ul className="admin-list">
                  {data.recent_uploads.map((u) => (
                    <li key={u.id}>
                      <div>
                        <strong>{KIND_LABELS[u.kind] ?? u.kind}</strong>
                        <span>
                          {u.filename} · {u.rows_inserted} rows · {u.email ?? "unknown"}
                        </span>
                      </div>
                      <span className={`pill ${u.is_hidden ? "muted" : "ok"}`}>{u.is_hidden ? "Hidden" : "Live"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>{user.role === "super_admin" ? "Latest activity" : "My latest activity"}</h2>
                {user.role === "super_admin" && <Link to="/admin/audit">Audit log</Link>}
              </div>
              <ul className="admin-list">
                {data.activity.map((a) => (
                  <li key={a.id}>
                    <div>
                      <strong>{ACTION_LABELS[a.action] ?? a.action}</strong>
                      <span>
                        {a.user_email ?? "unknown"} · {formatDate(a.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
