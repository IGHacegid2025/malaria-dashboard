// Author: Khadim Gueye

import { useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { invalidateDashboardData } from "../../hooks/useDashboardData";
import { adminApi } from "../adminApi";
import { useLoad } from "../useLoad";

interface TemplateInfo {
  kind: string;
  label: string;
  description: string;
  columns: { name: string; required: boolean; help: string }[];
}

interface Issue {
  row: number;
  column: string;
  message: string;
}

interface Preview {
  filename: string;
  total_rows: number;
  valid_rows: number;
  errors: Issue[];
  error_count: number;
  warnings: Issue[];
  warning_count: number;
  sample: Record<string, string | number | null>[];
}

const HIDDEN_SAMPLE_KEYS = new Set(["_row", "state_code"]);

export default function SubmitPage() {
  const { data: templates, error } = useLoad<TemplateInfo[]>("/admin/templates");
  const [kind, setKind] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const selected = templates?.find((t) => t.kind === kind) ?? null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setMessage(null);
    if (input.current) input.current.value = "";
  };

  const check = async (f: File) => {
    if (!kind) return;
    setFile(f);
    setPreview(null);
    setMessage(null);
    setBusy(true);
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", f);
    try {
      setPreview(await adminApi.post<Preview>("/admin/uploads/preview", form));
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!kind || !file) return;
    setBusy(true);
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    try {
      const res = await adminApi.post<{ rows_inserted: number }>("/admin/uploads/commit", form);
      invalidateDashboardData();
      reset();
      setMessage({ type: "success", text: `${res.rows_inserted} rows saved. They are now visible on the public dashboard.` });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) check(f);
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Submit data</h1>
        <p>Three steps: pick the type of data, fill the Excel template, upload it. Every row is checked before anything is saved.</p>
      </div>
      {error && <div className="admin-alert error">{error}</div>}

      <section className="admin-card">
        <h2 className="step-title">
          <span>1</span> What are you submitting?
        </h2>
        <div className="kind-grid">
          {templates?.map((t) => (
            <button
              key={t.kind}
              className={`kind-card${kind === t.kind ? " active" : ""}`}
              onClick={() => {
                setKind(t.kind);
                reset();
              }}
            >
              <strong>{t.label}</strong>
              <span>{t.description}</span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <section className="admin-card">
          <h2 className="step-title">
            <span>2</span> Download and fill the template
          </h2>
          <div className="template-box">
            <div>
              <p>
                The file has an <strong>Instructions</strong> sheet, a <strong>Data</strong> sheet to fill, an{" "}
                <strong>Example</strong> sheet and a <strong>Lists</strong> sheet with accepted states and genes. Columns marked * are
                required. CSV and TSV files with the same headers are also accepted.
              </p>
              <button
                className="admin-button primary"
                onClick={() => adminApi.download(`/admin/templates/${selected.kind}`, `template_${selected.kind}.xlsx`)}
              >
                Download Excel template
              </button>
            </div>
            <table className="admin-table compact">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {selected.columns.map((c) => (
                  <tr key={c.name}>
                    <td className="nowrap">
                      {c.name}
                      {c.required && <span className="required">*</span>}
                    </td>
                    <td>{c.help}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected && (
        <section className="admin-card">
          <h2 className="step-title">
            <span>3</span> Upload the filled file
          </h2>
          <div
            className={`drop-zone${dragging ? " dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => input.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <strong>{file ? file.name : "Drop the file here or click to choose"}</strong>
            <span>.xlsx, .csv or .tsv, up to 10 MB</span>
            <input
              ref={input}
              type="file"
              accept=".xlsx,.csv,.tsv,.txt"
              hidden
              onChange={(e) => e.target.files?.[0] && check(e.target.files[0])}
            />
          </div>

          {busy && <div className="admin-alert info">Checking the file...</div>}
          {message && <div className={`admin-alert ${message.type}`}>{message.text}{message.type === "success" && <> <Link to="/admin/uploads">See upload history</Link></>}</div>}

          {preview && (
            <div className="preview">
              <div className="preview-stats">
                <div>
                  <strong>{preview.total_rows}</strong>
                  <span>rows in file</span>
                </div>
                <div className="ok">
                  <strong>{preview.valid_rows}</strong>
                  <span>ready to save</span>
                </div>
                <div className={preview.error_count ? "bad" : ""}>
                  <strong>{preview.error_count}</strong>
                  <span>errors</span>
                </div>
                <div className={preview.warning_count ? "warn" : ""}>
                  <strong>{preview.warning_count}</strong>
                  <span>warnings</span>
                </div>
              </div>

              {preview.error_count > 0 && (
                <div className="issue-box error">
                  <h3>Fix these errors in the file, then upload it again</h3>
                  <ul>
                    {preview.errors.map((e, i) => (
                      <li key={i}>
                        <strong>Row {e.row}</strong> · {e.column}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.warning_count > 0 && (
                <div className="issue-box warn">
                  <h3>Warnings (you can still submit)</h3>
                  <ul>
                    {preview.warnings.map((e, i) => (
                      <li key={i}>
                        <strong>Row {e.row}</strong>
                        {e.column ? ` · ${e.column}` : ""}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.sample.length > 0 && (
                <>
                  <h3 className="preview-title">Preview of the rows that will be saved</h3>
                  <div className="table-wrap">
                    <table className="admin-table compact">
                      <thead>
                        <tr>
                          {Object.keys(preview.sample[0])
                            .filter((k) => !HIDDEN_SAMPLE_KEYS.has(k))
                            .map((k) => (
                              <th key={k}>{k.replace(/_/g, " ")}</th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample.map((row, i) => (
                          <tr key={i}>
                            {Object.entries(row)
                              .filter(([k]) => !HIDDEN_SAMPLE_KEYS.has(k))
                              .map(([k, v]) => (
                                <td key={k}>{k === "prevalence" && typeof v === "number" ? `${(v * 100).toFixed(2)}%` : String(v ?? "")}</td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="preview-actions">
                <button className="admin-button ghost" onClick={reset}>
                  Cancel
                </button>
                <button className="admin-button primary" disabled={busy || preview.error_count > 0 || preview.valid_rows === 0} onClick={submit}>
                  Submit {preview.valid_rows} rows
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
