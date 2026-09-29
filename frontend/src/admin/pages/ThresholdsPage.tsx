// Author: Khadim Gueye

import { useMemo, useState } from "react";
import { invalidateDashboardData } from "../../hooks/useDashboardData";
import WhoBadge from "../../components/WhoBadge";
import { adminApi } from "../adminApi";
import { useLoad } from "../useLoad";

interface Level {
  id: number;
  level_order: number;
  max_prevalence: string | number;
  classification: "low" | "intermediate" | "high";
  message: string | null;
  summary: string | null;
  guideline: string | null;
}

interface Rule {
  id: number;
  gene: string;
  mutation_pattern: string;
  who_status: "validated" | "candidate" | "none";
  antimalarial: string | null;
  reference_text: string | null;
  levels: Level[];
}

function RuleEditor({ rule, onSaved, onRemoved }: { rule: Rule; onSaved: () => void; onRemoved: () => void }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [antimalarial, setAntimalarial] = useState(rule.antimalarial ?? "");
  const [reference, setReference] = useState(rule.reference_text ?? "");
  const [whoStatus, setWhoStatus] = useState(rule.who_status ?? "none");
  const [levels, setLevels] = useState(rule.levels.map((l) => ({ ...l, pct: (Number(l.max_prevalence) * 100).toString() })));
  const [status, setStatus] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (id: number, patch: Partial<(typeof levels)[number]>) =>
    setLevels((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await adminApi.put(`/admin/alerts/${rule.id}`, {
        who_status: whoStatus,
        antimalarial: antimalarial || null,
        reference_text: reference || null,
        levels: levels.map((l) => ({
          id: l.id,
          max_prevalence: Number(l.pct) / 100,
          classification: l.classification,
          message: l.message,
          summary: l.summary,
          guideline: l.guideline,
        })),
      });
      invalidateDashboardData();
      setStatus({ type: "success", text: "Saved. The public dashboard uses the new values." });
      onSaved();
    } catch (err) {
      setStatus({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await adminApi.delete(`/admin/alerts/${rule.id}`);
      invalidateDashboardData();
      onRemoved();
    } catch (err) {
      setStatus({ type: "error", text: (err as Error).message });
      setBusy(false);
    }
  };

  return (
    <div className="rule-editor">
      <p className="admin-hint">
        {rule.mutation_pattern === "*"
          ? `General rule: applies to every ${rule.gene} mutation that has no specific rule.`
          : `Specific rule: applies only to ${rule.gene} ${rule.mutation_pattern}.`}
      </p>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>WHO status</span>
          <select value={whoStatus} onChange={(e) => setWhoStatus(e.target.value as Rule["who_status"])} disabled={rule.mutation_pattern === "*"}>
            <option value="validated">WHO validated marker</option>
            <option value="candidate">WHO candidate marker</option>
            <option value="none">Not a WHO marker (team thresholds)</option>
          </select>
        </label>
        <label className="admin-field">
          <span>Antimalarial</span>
          <input value={antimalarial} onChange={(e) => setAntimalarial(e.target.value)} />
        </label>
        <label className="admin-field grow">
          <span>Reference</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
      </div>
      {levels.map((l, i) => (
        <div key={l.id} className="level-editor">
          <div className="level-head">
            <span className={`level-dot ${l.classification}`} />
            Level {i + 1}: from {i === 0 ? "0" : levels[i - 1].pct}% up to
            <input className="admin-input pct" type="number" min={0} max={100} step={0.1} value={l.pct} onChange={(e) => update(l.id, { pct: e.target.value })} />%
            <select className="admin-input" value={l.classification} onChange={(e) => update(l.id, { classification: e.target.value as Level["classification"] })}>
              <option value="low">Low risk</option>
              <option value="intermediate">Watch closely</option>
              <option value="high">High alert</option>
            </select>
          </div>
          <label className="admin-field">
            <span>Short action text (shown on cards)</span>
            <input value={l.summary ?? ""} onChange={(e) => update(l.id, { summary: e.target.value })} />
          </label>
          <label className="admin-field">
            <span>Detailed message (shown on hover)</span>
            <textarea rows={2} value={l.message ?? ""} onChange={(e) => update(l.id, { message: e.target.value })} />
          </label>
        </div>
      ))}
      {status && <div className={`admin-alert ${status.type}`}>{status.text}</div>}
      <div className="preview-actions">
        {rule.mutation_pattern !== "*" &&
          (confirmRemove ? (
            <>
              <button className="admin-button danger" onClick={remove} disabled={busy}>
                Confirm: use the general rule again
              </button>
              <button className="admin-button ghost" onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="admin-button ghost danger-text" onClick={() => setConfirmRemove(true)}>
              Remove this specific rule
            </button>
          ))}
        <button className="admin-button primary" onClick={save} disabled={busy}>
          {busy ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function AddRule({ rules, onCreated }: { rules: Rule[]; onCreated: (id: number) => void }) {
  const genes = [...new Set(rules.map((r) => r.gene))].filter((g) => !g.startsWith("hrp")).sort();
  const [gene, setGene] = useState(genes[0] ?? "");
  const [mutation, setMutation] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const { data: mutations } = useLoad<{ mutation_code: string }[]>(gene ? `/mutations?gene=${encodeURIComponent(gene)}` : null);
  const taken = new Set(rules.filter((r) => r.gene === gene).map((r) => r.mutation_pattern));
  const choices = (mutations ?? []).map((m) => m.mutation_code).filter((m) => !taken.has(m));

  const create = async () => {
    setMessage(null);
    try {
      const res = await adminApi.post<{ id: number }>("/admin/alerts", { gene, mutation: mutation || choices[0] });
      invalidateDashboardData();
      setMessage({ type: "success", text: `Specific rule created for ${gene} ${mutation || choices[0]}. Adjust its thresholds below.` });
      setMutation("");
      onCreated(res.id);
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  };

  return (
    <section className="admin-card">
      <div>
        <h2>Add a specific rule</h2>
        <p className="admin-hint">
          Give a mutation or haplotype its own WHO thresholds and messages. It starts as a copy of the gene's general rule.
        </p>
      </div>
      <div className="admin-form-row align-end">
        <label className="admin-field">
          <span>Gene</span>
          <select value={gene} onChange={(e) => { setGene(e.target.value); setMutation(""); }}>
            {genes.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field grow">
          <span>Mutation or haplotype without its own rule</span>
          <select value={mutation || choices[0] || ""} onChange={(e) => setMutation(e.target.value)} disabled={choices.length === 0}>
            {choices.length === 0 && <option value="">All mutations of this gene already have a rule</option>}
            {choices.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button className="admin-button primary" onClick={create} disabled={choices.length === 0}>
          Create rule
        </button>
      </div>
      {message && <div className={`admin-alert ${message.type}`}>{message.text}</div>}
    </section>
  );
}

export default function ThresholdsPage() {
  const { data, error, reload } = useLoad<Rule[]>("/admin/alerts");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const rules = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((r) => !term || `${r.gene} ${r.mutation_pattern} ${r.antimalarial ?? ""}`.toLowerCase().includes(term));
  }, [data, q]);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>WHO thresholds and alert messages</h1>
        <p>Each rule decides the alert level shown for a marker. A pattern * applies to every mutation of the gene without its own rule.</p>
      </div>
      {error && <div className="admin-alert error">{error}</div>}
      {data && (
        <AddRule
          rules={data}
          onCreated={async (id) => {
            await reload();
            setOpen(id);
          }}
        />
      )}
      <section className="admin-card">
        <input className="admin-input wide" placeholder="Search gene, mutation or drug..." value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="rule-list">
          {rules.map((r) => (
            <li key={r.id} className={open === r.id ? "open" : ""}>
              <button className="rule-row" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <span className="mutation-chip" title={r.mutation_pattern}>{r.mutation_pattern === "*" ? "all others" : r.mutation_pattern}</span>
                <span className="rule-gene">
                  {r.gene}
                  <WhoBadge status={r.who_status ?? "none"} />
                </span>
                <span className="rule-drug">{r.antimalarial ?? "no drug"}</span>
                <span className="rule-levels">
                  {r.levels.map((l) => (
                    <span key={l.id} className={`level-dot ${l.classification}`} title={`${l.classification} up to ${(Number(l.max_prevalence) * 100).toFixed(1)}%`} />
                  ))}
                </span>
              </button>
              {open === r.id && (
                <RuleEditor
                  rule={r}
                  onSaved={reload}
                  onRemoved={() => {
                    setOpen(null);
                    reload();
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
