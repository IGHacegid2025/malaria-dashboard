// Author: Khadim Gueye

import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AdminApp";
import { adminApi } from "../adminApi";
import { useLoad } from "../useLoad";

interface YearRow {
  year: number;
  hidden: boolean;
  ready: boolean;
  samples?: number;
  tips?: number;
  states?: number;
  links?: number;
  transitions?: number;
  updated?: number;
  error?: string;
}

interface Uploaded {
  year: number;
  samples: number;
  tips: number;
  states: number;
  links: number;
}

export default function GenomicsAdminPage() {
  const { user } = useAuth();
  const isSuper = user.role === "super_admin";
  const { data, error, reload } = useLoad<YearRow[]>("/admin/genomics/gene-flow");
  const [year, setYear] = useState(new Date().getFullYear());
  const [tree, setTree] = useState<File | null>(null);
  const [meta, setMeta] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const treeInput = useRef<HTMLInputElement>(null);
  const metaInput = useRef<HTMLInputElement>(null);
  const exists = data?.some((r) => r.year === year);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tree || !meta) return;
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.append("year", String(year));
    form.append("tree", tree);
    form.append("metadata", meta);
    try {
      const res = await adminApi.post<Uploaded>("/admin/genomics/gene-flow", form);
      const unmatched = res.tips - res.samples;
      setMessage({
        type: "success",
        text: `Gene flow ${res.year} published: ${res.samples} samples, ${res.states} states, ${res.links} links.${unmatched ? ` ${unmatched} tree samples were not found in the metadata.` : ""}`,
      });
      setTree(null);
      setMeta(null);
      if (treeInput.current) treeInput.current.value = "";
      if (metaInput.current) metaInput.current.value = "";
      reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const act = async (row: YearRow, action: "hide" | "restore") => {
    try {
      await adminApi.post(`/admin/genomics/gene-flow/${row.year}/${action}`);
      setMessage({ type: "success", text: action === "hide" ? `Gene flow ${row.year} hidden from the website.` : `Gene flow ${row.year} is visible again.` });
      reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Population genomics</h1>
        <p>
          Publish the gene flow network of a year. Upload the phylogenetic tree and its metadata, the same two files used in StrainHub. The network
          is rebuilt automatically and shown on the <Link to="/genomics" target="_blank">Genomics page</Link>.
        </p>
      </div>
      {error && <div className="admin-alert error">{error}</div>}
      {message && <div className={`admin-alert ${message.type}`}>{message.text}</div>}

      <form className="admin-card" onSubmit={submit}>
        <h2>Add or replace a year</h2>
        <div className="admin-form-row align-end">
          <label className="admin-field">
            <span>Year</span>
            <input type="number" className="year-input" min={1990} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </label>
          <label className="admin-field grow">
            <span>Tree file (Newick, e.g. strainhub_tree.treefile)</span>
            <input ref={treeInput} type="file" accept=".treefile,.tree,.nwk,.newick,.tre,.txt" onChange={(e) => setTree(e.target.files?.[0] ?? null)} />
          </label>
          <label className="admin-field grow">
            <span>Metadata (CSV with Accession, state, date)</span>
            <input ref={metaInput} type="file" accept=".csv,text/csv" onChange={(e) => setMeta(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {exists && <p className="muted-note">A network already exists for {year}. Uploading will replace it.</p>}
        <div className="preview-actions">
          <button className="admin-button primary" disabled={busy || !tree || !meta}>
            {busy ? "Building the network..." : exists ? `Replace ${year}` : `Publish ${year}`}
          </button>
        </div>
      </form>

      <section className="admin-card">
        <h2>Published years</h2>
        {data?.length === 0 && <p className="admin-empty">No gene flow analysis yet.</p>}
        {data && data.length > 0 && (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th className="num">Samples</th>
                  <th className="num">States</th>
                  <th className="num">Links</th>
                  <th className="num">Transitions</th>
                  <th>Updated</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.year} className={r.hidden ? "row-hidden" : ""}>
                    <td>
                      <strong>{r.year}</strong>
                    </td>
                    <td className="num">{r.samples?.toLocaleString() ?? ""}</td>
                    <td className="num">{r.states ?? ""}</td>
                    <td className="num">{r.links ?? ""}</td>
                    <td className="num">{r.transitions?.toLocaleString() ?? ""}</td>
                    <td>{r.updated ? new Date(r.updated * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}</td>
                    <td>
                      {r.error ? (
                        <span className="pill muted" title={r.error}>
                          Error
                        </span>
                      ) : (
                        <span className={`pill ${r.hidden ? "muted" : "ok"}`}>{r.hidden ? "Hidden" : r.ready ? "Live" : "Incomplete"}</span>
                      )}
                    </td>
                    <td className="actions">
                      {!r.hidden && r.ready && (
                        <button className="admin-button ghost small danger-text" onClick={() => act(r, "hide")}>
                          Hide
                        </button>
                      )}
                      {r.hidden && isSuper && (
                        <button className="admin-button ghost small" onClick={() => act(r, "restore")}>
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
