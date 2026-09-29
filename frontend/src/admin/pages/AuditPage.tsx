// Author: Khadim Gueye

import { useState } from "react";
import { ACTION_LABELS, formatDate } from "../adminApi";
import { useLoad } from "../useLoad";

interface Entry {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: unknown;
  ip_address: string | null;
  created_at: string;
}

const PAGE = 30;

function tone(action: string) {
  if (action.includes("failed") || action.includes("removed") || action.includes("hidden")) return "warn";
  if (action.includes("uploaded") || action.includes("created") || action.includes("restored")) return "ok";
  return "";
}

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
  if (action) params.set("action", action);
  const { data, error } = useLoad<{ total: number; rows: Entry[]; actions: string[] }>(`/admin/audit?${params.toString()}`);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Audit log</h1>
        <p>Every sign-in and change made in the admin area, with who did it and when. Entries cannot be edited or deleted.</p>
      </div>
      <section className="admin-card">
        <div className="records-toolbar">
          <select className="admin-input" value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }}>
            <option value="">All actions</option>
            {data?.actions.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
          <span className="records-count">{data ? `${data.total} entries` : ""}</span>
        </div>
        {error && <div className="admin-alert error">{error}</div>}
        <ul className="audit-list">
          {data?.rows.map((e) => (
            <li key={e.id}>
              <button className="audit-row" onClick={() => setOpen(open === e.id ? null : e.id)} disabled={!e.details}>
                <span className={`audit-dot ${tone(e.action)}`} />
                <span className="audit-main">
                  <strong>{ACTION_LABELS[e.action] ?? e.action}</strong>
                  <span>
                    {e.user_email ?? "unknown"}
                    {e.entity ? ` · ${e.entity}${e.entity_id ? ` #${e.entity_id}` : ""}` : ""}
                  </span>
                </span>
                <span className="audit-time">{formatDate(e.created_at)}</span>
              </button>
              {open === e.id && e.details !== null && <pre className="audit-details">{JSON.stringify(e.details, null, 2)}</pre>}
            </li>
          ))}
        </ul>
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
