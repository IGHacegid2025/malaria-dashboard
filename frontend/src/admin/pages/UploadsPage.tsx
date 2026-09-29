// Author: Khadim Gueye

import { useState } from "react";
import { invalidateDashboardData } from "../../hooks/useDashboardData";
import { useAuth } from "../AdminApp";
import { adminApi, formatDate } from "../adminApi";
import { useLoad } from "../useLoad";
import { KIND_LABELS } from "./OverviewPage";

interface Upload {
  id: number;
  kind: string;
  filename: string;
  rows_inserted: number;
  is_hidden: number;
  created_at: string;
  email: string | null;
}

export default function UploadsPage() {
  const { user } = useAuth();
  const { data, error, reload } = useLoad<Upload[]>("/admin/uploads");
  const [pending, setPending] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isSuper = user.role === "super_admin";

  const act = async (u: Upload, action: "hide" | "restore") => {
    try {
      await adminApi.post(`/admin/uploads/${u.id}/${action}`);
      invalidateDashboardData();
      setMessage(action === "hide" ? `Upload #${u.id} is now hidden from the public dashboard.` : `Upload #${u.id} is visible again.`);
      setPending(null);
      reload();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Upload history</h1>
        <p>
          Every submitted file. Hiding an upload removes all its rows from the public dashboard without deleting them.
          {isSuper ? " As super admin you can restore hidden uploads." : " Only a super admin can restore a hidden upload."}
        </p>
      </div>
      {error && <div className="admin-alert error">{error}</div>}
      {message && <div className="admin-alert info">{message}</div>}
      <section className="admin-card">
        {data && data.length === 0 && <p className="admin-empty">No uploads yet.</p>}
        {data && data.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Data type</th>
                  <th>File</th>
                  <th className="num">Rows</th>
                  <th>By</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} className={u.is_hidden ? "row-hidden" : ""}>
                    <td>{u.id}</td>
                    <td className="nowrap">{formatDate(u.created_at)}</td>
                    <td>{KIND_LABELS[u.kind] ?? u.kind}</td>
                    <td className="truncate">{u.filename}</td>
                    <td className="num">{u.rows_inserted}</td>
                    <td>{u.email ?? "unknown"}</td>
                    <td>
                      <span className={`pill ${u.is_hidden ? "muted" : "ok"}`}>{u.is_hidden ? "Hidden" : "Live"}</span>
                    </td>
                    <td className="actions">
                      {!u.is_hidden &&
                        (pending === u.id ? (
                          <>
                            <button className="admin-button danger small" onClick={() => act(u, "hide")}>
                              Confirm hide
                            </button>
                            <button className="admin-button ghost small" onClick={() => setPending(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button className="admin-button ghost small" onClick={() => setPending(u.id)}>
                            Hide
                          </button>
                        ))}
                      {Boolean(u.is_hidden) && isSuper && (
                        <button className="admin-button ghost small" onClick={() => act(u, "restore")}>
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
