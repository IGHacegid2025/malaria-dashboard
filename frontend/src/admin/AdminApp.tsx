// Author: Khadim Gueye

import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { adminApi, getToken, setToken, setUnauthorizedHandler, type AdminUser } from "./adminApi";
import ActivitiesAdminPage from "./pages/ActivitiesAdminPage";
import AppearancePage from "./pages/AppearancePage";
import AuditPage from "./pages/AuditPage";
import GenomicsAdminPage from "./pages/GenomicsAdminPage";
import OverviewPage from "./pages/OverviewPage";
import PartnersAdminPage from "./pages/PartnersAdminPage";
import RecordsPage from "./pages/RecordsPage";
import ReportDownloadsPage from "./pages/ReportDownloadsPage";
import SubmitPage from "./pages/SubmitPage";
import TeamAdminPage from "./pages/TeamAdminPage";
import ThresholdsPage from "./pages/ThresholdsPage";
import UploadsPage from "./pages/UploadsPage";
import UsersPage from "./pages/UsersPage";
import VisitorsPage from "./pages/VisitorsPage";
import "./admin.css";

interface AuthState {
  user: AdminUser;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AdminApp");
  return ctx;
}

function Brand() {
  return (
    <Link to="/" className="admin-brand">
      <span className="admin-brand-mark">M</span>
      <span>
        <strong>Malaria Surveillance</strong>
        <small>Admin</small>
      </span>
    </Link>
  );
}

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="admin-field">
      <span>{label}</span>
      <div className="password-input">
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: AdminUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ challenge: string; email: string } | null>(null);
  const [code, setCode] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step) {
        const res = await adminApi.post<{ token: string; user: AdminUser }>("/auth/verify-code", { challenge: step.challenge, code });
        setToken(res.token);
        onLogin(res.user);
        return;
      }
      const res = await adminApi.post<{ token?: string; user?: AdminUser; two_factor?: boolean; challenge?: string; email?: string }>(
        "/auth/login",
        { email, password },
      );
      if (res.two_factor && res.challenge) {
        setStep({ challenge: res.challenge, email: res.email ?? email });
        setCode("");
        return;
      }
      setToken(res.token!);
      onLogin(res.user!);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep(null);
    setCode("");
    setError(null);
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <Brand />
        <h1>{step ? "Check your email" : "Sign in"}</h1>
        {step ? (
          <>
            <p className="auth-lede">We sent a 6-digit code to {step.email}. It expires in 10 minutes.</p>
            <label className="admin-field">
              <span>Sign-in code</span>
              <input
                className="code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                required
                autoFocus
              />
            </label>
          </>
        ) : (
          <>
            <p className="auth-lede">Administration of the malaria genomic surveillance dashboard.</p>
            <label className="admin-field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
            </label>
            <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
          </>
        )}
        {error && <div className="admin-alert error">{error}</div>}
        <button className="admin-button primary wide" disabled={busy || (step !== null && code.length !== 6)}>
          {busy ? (step ? "Checking..." : "Signing in...") : step ? "Verify" : "Sign in"}
        </button>
        {step && (
          <button type="button" className="auth-back link-like" onClick={restart}>
            Use another account or get a new code
          </button>
        )}
        <Link to="/" className="auth-back">
          Back to the dashboard
        </Link>
      </form>
    </div>
  );
}

export function ChangePasswordForm({ forced, onDone }: { forced?: boolean; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await adminApi.post("/auth/change-password", { current_password: current, new_password: next });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="password-form" onSubmit={submit}>
      {forced && <div className="admin-alert info">For security, choose a new password before continuing.</div>}
      <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" />
      <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <p className="admin-hint">At least 8 characters, with letters and numbers.</p>
      {error && <div className="admin-alert error">{error}</div>}
      {done && !forced && <div className="admin-alert success">Password updated.</div>}
      <button className="admin-button primary" disabled={busy}>
        {busy ? "Saving..." : "Update password"}
      </button>
    </form>
  );
}

const NAV: { to: string; label: string; icon: string; superOnly?: boolean; end?: boolean }[] = [
  { to: "/admin", label: "Overview", icon: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z", end: true },
  { to: "/admin/submit", label: "Submit data", icon: "M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" },
  { to: "/admin/uploads", label: "Upload history", icon: "M4 6h16M4 12h16M4 18h10" },
  { to: "/admin/records", label: "Data records", icon: "M4 5h16v4H4zM4 11h16v4H4zM4 17h16v2H4z" },
  { to: "/admin/thresholds", label: "WHO thresholds", icon: "M4 19h16M6 15l4-6 4 3 4-7" },
  { to: "/admin/genomics", label: "Population genomics", icon: "M6 3c0 5 12 7 12 12s-12 4-12 6M18 3c0 5-12 7-12 12s12 4 12 6M8 7h8M8 17h8" },
  { to: "/admin/team", label: "Team", icon: "M9 11a3 3 0 100-6 3 3 0 000 6zM17 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M13 14.5a6 6 0 018 5.5" },
  { to: "/admin/partners", label: "Projects & partners", icon: "M3 12h4l3 -3 4 4 3 -3h4M7 12l3 4a2 2 0 003 0l1 -1M3 7l5 -3 4 2 4 -2 5 3" },
  { to: "/admin/activities", label: "Lab activities", icon: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" },
  { to: "/admin/visitors", label: "Visitors", icon: "M12 21s-7-6.2-7-11.5A7 7 0 0112 3a7 7 0 017 6.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" },
  { to: "/admin/downloads", label: "Report downloads", icon: "M7 3h7l5 5v13H7zM14 3v5h5M12 11v6m0 0l-2.5-2.5M12 17l2.5-2.5" },
  { to: "/admin/appearance", label: "Site settings", icon: "M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.5 0-1-.8-1.5-.8-2.5 0-1 .8-1.5 1.8-1.5H17a4 4 0 004-4c0-4.7-4-8.5-9-8.5z" },
  { to: "/admin/users", label: "Admins", icon: "M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0", superOnly: true },
  { to: "/admin/audit", label: "Audit log", icon: "M9 5h10M9 12h10M9 19h10M4 5h.01M4 12h.01M4 19h.01", superOnly: true },
];

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className={`admin-shell${open ? " nav-open" : ""}`}>
      <aside className="admin-sidebar">
        <Brand />
        <nav onClick={() => setOpen(false)}>
          {NAV.filter((n) => !n.superOnly || user.role === "super_admin").map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={n.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-user">
          <div className="admin-user-name">{user.full_name || user.email}</div>
          <div className="admin-user-role">
            {user.role === "super_admin" ? "Super admin" : "Admin"}
          </div>
          <div className="admin-user-actions">
            <NavLink to="/admin/account">Account</NavLink>
            <button onClick={logout}>Sign out</button>
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <Link to="/dashboard" className="admin-view-site" target="_blank">
            View public dashboard
          </Link>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

function AccountPage() {
  const { user } = useAuth();
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>My account</h1>
        <p>
          {user.email} · {user.role === "super_admin" ? "Super admin" : "Admin"}
        </p>
      </div>
      <section className="admin-card narrow">
        <h2>Change password</h2>
        <ChangePasswordForm onDone={() => undefined} />
      </section>
    </div>
  );
}

export default function AdminApp() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setUser(await adminApi.get<AdminUser>("/auth/me"));
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (getToken()) refresh();
  }, [logout, refresh]);

  if (checking) return <div className="auth-screen"><div className="loading">Checking your session...</div></div>;
  if (!user) return <LoginScreen onLogin={setUser} />;

  if (user.must_change_password) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <Brand />
          <h1>Choose a new password</h1>
          <ChangePasswordForm forced onDone={refresh} />
          <button className="admin-button ghost wide" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const isSuper = user.role === "super_admin";
  return (
    <AuthContext.Provider value={{ user, refresh, logout }}>
      <Shell>
        <Routes>
          <Route index element={<OverviewPage />} />
          <Route path="submit" element={<SubmitPage />} />
          <Route path="uploads" element={<UploadsPage />} />
          <Route path="records" element={<RecordsPage />} />
          <Route path="thresholds" element={<ThresholdsPage />} />
          <Route path="appearance" element={<AppearancePage />} />
          <Route path="team" element={<TeamAdminPage />} />
          <Route path="activities" element={<ActivitiesAdminPage />} />
          <Route path="partners" element={<PartnersAdminPage />} />
          <Route path="genomics" element={<GenomicsAdminPage />} />
          <Route path="visitors" element={<VisitorsPage />} />
          <Route path="downloads" element={<ReportDownloadsPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="users" element={isSuper ? <UsersPage /> : <Navigate to="/admin" replace />} />
          <Route path="audit" element={isSuper ? <AuditPage /> : <Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Shell>
    </AuthContext.Provider>
  );
}
