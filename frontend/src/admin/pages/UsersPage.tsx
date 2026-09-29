// Author: Khadim Gueye

import { useState, type FormEvent } from "react";
import { useAuth } from "../AdminApp";
import { adminApi, formatDate } from "../adminApi";
import { useLoad } from "../useLoad";

interface Account {
  id: number;
  email: string;
  full_name: string | null;
  role: "super_admin" | "admin";
  is_owner: number;
  is_active: number;
  must_change_password: number;
  last_login_at: string | null;
  created_at: string;
  created_by: string | null;
}

function TempPassword({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="admin-alert success temp-password">
      <div>
        Temporary password for <strong>{email}</strong>:
        <code>{password}</code>
        Share it privately. It is shown only once and must be changed at first sign-in.
      </div>
      <div className="temp-actions">
        <button
          className="admin-button ghost small"
          onClick={() => navigator.clipboard?.writeText(password).then(() => setCopied(true), () => undefined)}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button className="admin-button ghost small" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const { data, error, reload } = useLoad<Account[]>("/admin/users");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "super_admin">("admin");
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await adminApi.post<{ temporary_password: string }>("/admin/users", { email, full_name: name || null, role });
      setTemp({ email, password: res.temporary_password });
      setEmail("");
      setName("");
      setRole("admin");
      reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  };

  const patch = async (a: Account, body: object, text: string) => {
    try {
      await adminApi.patch(`/admin/users/${a.id}`, body);
      setMessage({ type: "success", text });
      setConfirm(null);
      reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  };

  const reset = async (a: Account) => {
    try {
      const res = await adminApi.post<{ temporary_password: string }>(`/admin/users/${a.id}/reset-password`);
      setTemp({ email: a.email, password: res.temporary_password });
      setConfirm(null);
      reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Admins</h1>
        <p>Only super admins see this page. The first super admin account is protected and cannot be changed by anyone else.</p>
      </div>

      <section className="admin-card">
        <h2>Add an admin</h2>
        <form className="admin-form-row align-end" onSubmit={add}>
          <label className="admin-field grow">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="admin-field grow">
            <span>Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="admin-field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "super_admin")}>
              <option value="admin">Admin</option>
              <option value="super_admin">Super admin</option>
            </select>
          </label>
          <button className="admin-button primary">Add</button>
        </form>
        {temp && <TempPassword {...temp} onClose={() => setTemp(null)} />}
        {message && <div className={`admin-alert ${message.type}`}>{message.text}</div>}
      </section>

      <section className="admin-card">
        <h2>All accounts</h2>
        {error && <div className="admin-alert error">{error}</div>}
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th>Added by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.map((a) => {
                const locked = Boolean(a.is_owner) || a.id === user.id;
                return (
                  <tr key={a.id} className={a.is_active ? "" : "row-hidden"}>
                    <td>
                      <strong>{a.full_name || a.email}</strong>
                      <div className="muted small">{a.email}</div>
                    </td>
                    <td>
                      <span className={`pill ${a.role === "super_admin" ? "strong" : ""}`}>{a.role === "super_admin" ? "Super admin" : "Admin"}</span>
                    </td>
                    <td>
                      <span className={`pill ${a.is_active ? "ok" : "muted"}`}>{a.is_active ? (a.must_change_password ? "Invited" : "Active") : "Removed"}</span>
                    </td>
                    <td className="nowrap">{formatDate(a.last_login_at)}</td>
                    <td>{a.created_by ?? "-"}</td>
                    <td className="actions">
                      {locked ? (
                        <span className="muted small">{a.is_owner ? "Protected" : "You"}</span>
                      ) : confirm === `remove-${a.id}` ? (
                        <>
                          <button className="admin-button danger small" onClick={() => patch(a, { is_active: false }, `${a.email} removed.`)}>
                            Confirm remove
                          </button>
                          <button className="admin-button ghost small" onClick={() => setConfirm(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {a.is_active ? (
                            <>
                              <button
                                className="admin-button ghost small"
                                onClick={() =>
                                  patch(
                                    a,
                                    { role: a.role === "super_admin" ? "admin" : "super_admin" },
                                    `${a.email} is now ${a.role === "super_admin" ? "admin" : "super admin"}.`,
                                  )
                                }
                              >
                                {a.role === "super_admin" ? "Make admin" : "Make super admin"}
                              </button>
                              <button className="admin-button ghost small" onClick={() => reset(a)}>
                                Reset password
                              </button>
                              <button className="admin-button ghost small danger-text" onClick={() => setConfirm(`remove-${a.id}`)}>
                                Remove
                              </button>
                            </>
                          ) : (
                            <button className="admin-button ghost small" onClick={() => patch(a, { is_active: true }, `${a.email} reactivated.`)}>
                              Reactivate
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
