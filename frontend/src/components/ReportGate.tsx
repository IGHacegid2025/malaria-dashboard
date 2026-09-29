// Author: Khadim Gueye

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api";

const KEY = "malaria.reporter";

interface Reporter {
  name: string;
  email: string;
  organization: string;
}

function remembered(): Reporter {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved?.name && saved?.email) return { name: saved.name, email: saved.email, organization: saved.organization ?? "" };
  } catch {
    /* ignore */
  }
  return { name: "", email: "", organization: "" };
}

export default function ReportGate({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Reporter>(remembered);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.requestReport({ ...form, page: `${window.location.pathname}${window.location.search}` });
      try {
        localStorage.setItem(KEY, JSON.stringify(form));
      } catch {
        /* ignore */
      }
      onClose();
      window.setTimeout(() => window.print(), 250);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const set = (key: keyof Reporter) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="member-overlay no-print" onClick={onClose} role="presentation">
      <form className="gate-sheet" role="dialog" aria-modal="true" aria-labelledby="gate-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="member-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <div className="gate-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M14 3v5h5M10 13h6M10 17h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <h2 id="gate-title">Download the PDF report</h2>
        <p>Tell us who you are so the lab knows how the evidence is used. The report opens right after.</p>
        <label className="gate-field">
          <span>Full name *</span>
          <input ref={first} value={form.name} onChange={set("name")} required minLength={2} maxLength={160} autoComplete="name" />
        </label>
        <label className="gate-field">
          <span>Email *</span>
          <input type="email" value={form.email} onChange={set("email")} required maxLength={200} autoComplete="email" />
        </label>
        <label className="gate-field">
          <span>Organisation</span>
          <input value={form.organization} onChange={set("organization")} maxLength={200} autoComplete="organization" placeholder="e.g. NMEP, State Ministry of Health" />
        </label>
        {error && <div className="gate-error">{error}</div>}
        <button type="submit" className="gate-submit" disabled={busy}>
          {busy ? "Preparing..." : "Download report"}
        </button>
        <small>Your details are only seen by the IGH team and are never shared.</small>
      </form>
    </div>
  );
}
