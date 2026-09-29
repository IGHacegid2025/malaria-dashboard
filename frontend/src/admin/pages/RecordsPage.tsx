// Author: Khadim Gueye

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { invalidateDashboardData } from "../../hooks/useDashboardData";
import { useAuth } from "../AdminApp";
import { adminApi } from "../adminApi";
import { useLoad } from "../useLoad";

const ENTITIES = [
  { key: "observations", label: "Mutations" },
  { key: "publications", label: "Publications" },
  { key: "species", label: "Species" },
  { key: "diagnostics", label: "hrp2/3" },
  { key: "moi", label: "MOI" },
  { key: "mis", label: "MIS" },
];

const PAGE = 25;
const SKIP = new Set(["is_hidden", "id"]);

type Row = Record<string, string | number | null>;

function cell(key: string, value: string | number | null) {
  if (value === null || value === undefined || value === "") return <span className="muted">-</span>;
  if (key === "prevalence") return `${(Number(value) * 100).toFixed(2)}%`;
  if (key === "upload_id") return `#${value}`;
  if (key === "mutation") return <span className="mutation-chip">{String(value)}</span>;
  return String(value);
}

export default function RecordsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const entity = params.get("entity") ?? "observations";
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const isSuper = user.role === "super_admin";

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(q);
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(id);
  }, [q]);

  const query = new URLSearchParams({ q: search, status, limit: String(PAGE), offset: String(offset) });
  const { data, error, reload } = useLoad<{ total: number; rows: Row[] }>(`/admin/records/${entity}?${query.toString()}`);

  const act = async (row: Row, action: "hide" | "restore") => {
    try {
      await adminApi.post(`/admin/records/${entity}/${row.id}/${action}`);
      invalidateDashboardData();
      setMessage(action === "hide" ? `Record #${row.id} hidden.` : `Record #${row.id} restored.`);
      reload();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const columns = data?.rows[0] ? Object.keys(data.rows[0]).filter((k) => !SKIP.has(k)) : [];

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Data records</h1>
        <p>
          Search the database and hide incorrect records. Hidden records disappear from the public dashboard but are never deleted
          {isSuper ? "; you can restore them." : "; a super admin can restore them."}
        </p>
      </div>

      <div className="records-tabs" role="tablist">
        {ENTITIES.map((e) => (
          <button
            key={e.key}
            role="tab"
            aria-selected={entity === e.key}
            className={entity === e.key ? "active" : ""}
            onClick={() => {
              setParams({ entity: e.key });
              setOffset(0);
              setMessage(null);
            }}
          >
            {e.label}
          </button>
        ))}
      </div>

      <section className="admin-card">
        <div className="records-toolbar">
          <input className="admin-input" placeholder="Search state, gene, mutation, author, year..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="admin-input" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
            <option value="all">All records</option>
            <option value="visible">Visible only</option>
            <option value="hidden">Hidden only</option>
          </select>
          <span className="records-count">{data ? `${data.total.toLocaleString()} records` : ""}</span>
        </div>
        {error && <div className="admin-alert error">{error}</div>}
        {message && <div className="admin-alert info">{message}</div>}
        {data && data.rows.length === 0 && <p className="admin-empty">No records match.</p>}
        {data && data.rows.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table compact">
              <thead>
                <tr>
                  <th>#</th>
                  {columns.map((c) => (
                    <th key={c}>{c === "upload_id" ? "source file" : c.replace(/_/g, " ")}</th>
                  ))}
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={String(row.id)} className={row.is_hidden ? "row-hidden" : ""}>
                    <td>{row.id}</td>
                    {columns.map((c) => (
                      <td key={c} className={c === "title" ? "truncate" : ""}>
                        {c === "upload_id" && row[c] === null ? <span className="muted">reference</span> : cell(c, row[c])}
                      </td>
                    ))}
                    <td>
                      <span className={`pill ${row.is_hidden ? "muted" : "ok"}`}>{row.is_hidden ? "Hidden" : "Visible"}</span>
                    </td>
                    <td className="actions">
                      {!row.is_hidden ? (
                        <button className="admin-button ghost small" onClick={() => act(row, "hide")}>
                          Hide
                        </button>
                      ) : (
                        isSuper && (
                          <button className="admin-button ghost small" onClick={() => act(row, "restore")}>
                            Restore
                          </button>
                        )
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
              Previous
            </button>
            <span>
              {offset + 1} to {Math.min(offset + PAGE, data.total)} of {data.total.toLocaleString()}
            </span>
            <button className="admin-button ghost small" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
