// Author: Khadim Gueye

import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { mediaSrc } from "../../components/HeroBackdrop";
import { useSettings } from "../../settings";
import { adminApi, formatDate } from "../adminApi";
import { useLoad } from "../useLoad";

type Kind = "project" | "partner";

interface Entry {
  id: number;
  kind: Kind;
  name: string;
  description: string | null;
  logo_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_visible: number;
  is_deleted: number;
  deleted_at: string | null;
}

interface Draft {
  id: number | null;
  kind: Kind;
  name: string;
  description: string;
  logo_url: string;
  link_url: string;
  is_visible: boolean;
}

const LABELS: Record<Kind, { title: string; one: string; hint: string }> = {
  project: { title: "Projects", one: "project", hint: "Research programmes the lab contributes to." },
  partner: { title: "Partners", one: "partner", hint: "Institutions shown as a grid of logos, each linking to its website." },
};

export default function PartnersAdminPage() {
  const { settings } = useSettings();
  const { data, error, reload, setData } = useLoad<Entry[]>("/admin/partners");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const tabOn = settings ? !(settings["nav.hidden"] ?? []).includes("projects") : false;

  const live = (kind: Kind) => (data ?? []).filter((e) => e.kind === kind && !e.is_deleted);
  const deleted = (data ?? []).filter((e) => e.is_deleted);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => draft && setDraft({ ...draft, [key]: value });

  const run = async (call: () => Promise<unknown>, text: string) => {
    setMessage(null);
    try {
      await call();
      setMessage({ type: "success", text });
      reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  };

  const uploadLogo = async (file: File) => {
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await adminApi.post<{ url: string; kind: string }>("/admin/media", form);
      if (res.kind !== "image") throw new Error("Please choose an image");
      set("logo_url", res.url);
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
      if (logoInput.current) logoInput.current.value = "";
    }
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    const body = { ...draft, logo_url: draft.logo_url || null, link_url: draft.link_url || null, description: draft.description || null };
    await run(
      () => (draft.id ? adminApi.put(`/admin/partners/${draft.id}`, body) : adminApi.post("/admin/partners", body)),
      `${draft.name} saved.`,
    );
    setDraft(null);
    setBusy(false);
  };

  const shift = (entry: Entry, dir: -1 | 1) => {
    if (!data) return;
    const group = live(entry.kind).map((e) => e.id);
    const i = group.indexOf(entry.id);
    const j = i + dir;
    if (j < 0 || j >= group.length) return;
    [group[i], group[j]] = [group[j], group[i]];
    const others = data.filter((e) => !group.includes(e.id)).map((e) => e.id);
    const byId = new Map(data.map((e) => [e.id, e]));
    setData([...group, ...others].map((id) => byId.get(id)!));
    run(() => adminApi.post("/admin/partners/reorder", { ids: [...group, ...others] }), "New order saved.");
  };

  const card = (e: Entry, list: Entry[]) => (
    <div key={e.id} className={`partner-admin-card${e.is_visible && !e.is_deleted ? "" : " row-hidden"}`}>
      {e.logo_url ? <img src={mediaSrc(e.logo_url)} alt="" /> : <div className="photo-placeholder">{e.name[0]}</div>}
      <div className="team-admin-body">
        <strong>{e.name}</strong>
        <span className="partner-admin-link">{e.link_url ?? "No link yet"}</span>
        {!e.is_deleted ? (
          <label className="switch-field">
            <input
              type="checkbox"
              checked={Boolean(e.is_visible)}
              onChange={(ev) =>
                run(
                  () => adminApi.post(`/admin/partners/${e.id}/visibility`, { visible: ev.target.checked }),
                  ev.target.checked ? `${e.name} is now shown on the Projects page.` : `${e.name} is no longer shown.`,
                )
              }
            />
            <span className="switch" aria-hidden="true" />
            {e.is_visible ? "Shown on the website" : "Not shown"}
          </label>
        ) : (
          <span className="pill muted">Deleted {e.deleted_at ? formatDate(e.deleted_at).split(",")[0] : ""}</span>
        )}
        <div className="team-admin-actions">
          {!e.is_deleted && (
            <>
              <button type="button" className="team-move" onClick={() => shift(e, -1)} disabled={list[0]?.id === e.id} aria-label={`Move ${e.name} earlier`}>
                &larr;
              </button>
              <button type="button" className="team-move" onClick={() => shift(e, 1)} disabled={list[list.length - 1]?.id === e.id} aria-label={`Move ${e.name} later`}>
                &rarr;
              </button>
              <button
                className="admin-button ghost small"
                onClick={() =>
                  setDraft({
                    id: e.id,
                    kind: e.kind,
                    name: e.name,
                    description: e.description ?? "",
                    logo_url: e.logo_url ?? "",
                    link_url: e.link_url ?? "",
                    is_visible: Boolean(e.is_visible),
                  })
                }
              >
                Edit
              </button>
              {confirm === e.id ? (
                <>
                  <button className="admin-button danger small" onClick={() => run(() => adminApi.delete(`/admin/partners/${e.id}`), `${e.name} deleted. It is kept below and can be restored.`).then(() => setConfirm(null))}>
                    Confirm delete
                  </button>
                  <button className="admin-button ghost small" onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="admin-button ghost small danger-text" onClick={() => setConfirm(e.id)}>
                  Delete
                </button>
              )}
            </>
          )}
          {Boolean(e.is_deleted) && (
            <button className="admin-button ghost small" onClick={() => run(() => adminApi.post(`/admin/partners/${e.id}/restore`), `${e.name} restored (not shown yet).`)}>
              Restore
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Projects and partners</h1>
        <p>
          Projects the lab works on and partner institutions, shown on the public Projects page with their logo and link. Switch each one on
          only once the partnership may be shown publicly. Nothing is ever erased.
        </p>
      </div>
      <div className={`admin-alert ${tabOn ? "success" : "info"}`}>
        {tabOn ? "The Projects tab is visible in the website menu. " : "The Projects tab is switched off in the website menu. "}
        <Link to="/admin/appearance">Change it in Site settings, Menu tabs</Link>
      </div>
      {error && <div className="admin-alert error">{error}</div>}
      {message && <div className={`admin-alert ${message.type}`}>{message.text}</div>}

      {draft ? (
        <section className="admin-card">
          <h2>{draft.id ? `Edit ${draft.name}` : `Add a ${LABELS[draft.kind].one}`}</h2>
          <div className="team-editor">
            <div className="team-photo-edit">
              {draft.logo_url ? <img src={mediaSrc(draft.logo_url)} alt="" className="partner-logo-preview" /> : <div className="photo-placeholder team-photo-empty">No logo</div>}
              <button className="admin-button ghost small" onClick={() => logoInput.current?.click()} disabled={busy}>
                {draft.logo_url ? "Replace logo" : "Upload logo"}
              </button>
              {draft.logo_url && (
                <button className="admin-button ghost small" onClick={() => set("logo_url", "")}>
                  Remove logo
                </button>
              )}
              <input ref={logoInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(ev) => ev.target.files?.[0] && uploadLogo(ev.target.files[0])} />
              <span className="admin-hint">PNG with a transparent background looks best.</span>
            </div>
            <div className="team-fields">
              <div className="admin-form-row">
                <label className="admin-field">
                  <span>Type</span>
                  <select value={draft.kind} onChange={(ev) => set("kind", ev.target.value as Kind)}>
                    <option value="project">Project</option>
                    <option value="partner">Partner</option>
                  </select>
                </label>
                <label className="admin-field grow">
                  <span>Name *</span>
                  <input value={draft.name} maxLength={200} onChange={(ev) => set("name", ev.target.value)} />
                </label>
              </div>
              <label className="admin-field">
                <span>Website (https://)</span>
                <input value={draft.link_url} placeholder="https://" onChange={(ev) => set("link_url", ev.target.value)} />
              </label>
              <label className="admin-field">
                <span>Short description (optional)</span>
                <textarea rows={3} value={draft.description} onChange={(ev) => set("description", ev.target.value)} />
              </label>
              <label className="check-field">
                <input type="checkbox" checked={draft.is_visible} onChange={(ev) => set("is_visible", ev.target.checked)} />
                Show on the website
              </label>
              <div className="preview-actions">
                <button className="admin-button ghost" onClick={() => setDraft(null)}>
                  Cancel
                </button>
                <button className="admin-button primary" onClick={save} disabled={busy || !draft.name.trim()}>
                  {busy ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="preview-actions left">
          <button className="admin-button primary" onClick={() => setDraft({ id: null, kind: "project", name: "", description: "", logo_url: "", link_url: "", is_visible: false })}>
            Add a project
          </button>
          <button className="admin-button ghost" onClick={() => setDraft({ id: null, kind: "partner", name: "", description: "", logo_url: "", link_url: "", is_visible: false })}>
            Add a partner
          </button>
        </div>
      )}

      {(["project", "partner"] as Kind[]).map((kind) => {
        const list = live(kind);
        return (
          <section key={kind} className="admin-card">
            <h2>{LABELS[kind].title}</h2>
            <p className="admin-hint">{LABELS[kind].hint}</p>
            {list.length === 0 ? <p className="admin-empty">None yet.</p> : <div className="team-admin-grid">{list.map((e) => card(e, list))}</div>}
          </section>
        );
      })}

      {deleted.length > 0 && (
        <details className="admin-card team-hidden">
          <summary>
            <h2>Deleted, kept for the record ({deleted.length})</h2>
          </summary>
          <div className="team-admin-grid">{deleted.map((e) => card(e, deleted))}</div>
        </details>
      )}
    </div>
  );
}
