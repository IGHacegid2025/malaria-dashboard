// Author: Khadim Gueye

import { useRef, useState } from "react";
import { mediaSrc } from "../../components/HeroBackdrop";
import { useAuth } from "../AdminApp";
import { adminApi } from "../adminApi";
import { useLoad } from "../useLoad";

interface Member {
  id: number;
  name: string;
  title: string | null;
  affiliation: string | null;
  bio: string | null;
  photo_url: string | null;
  email: string | null;
  linkedin_url: string | null;
  is_lead: number;
  is_alumni: number;
  sort_order: number;
  is_hidden: number;
  is_deleted: number;
  deleted_at: string | null;
}

type Draft = Omit<Member, "id" | "is_hidden" | "is_lead" | "is_alumni" | "is_deleted" | "deleted_at"> & { id: number | null; is_lead: boolean };

const EMPTY: Draft = { id: null, name: "", title: "", affiliation: "", bio: "", photo_url: "", email: "", linkedin_url: "", is_lead: false, sort_order: 10 };

function toDraft(m: Member): Draft {
  return { ...m, is_lead: Boolean(m.is_lead) };
}

export default function TeamAdminPage() {
  const { user } = useAuth();
  const isSuper = user.role === "super_admin";
  const { data, error, reload, setData } = useLoad<Member[]>("/admin/team");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const active = (data ?? []).filter((m) => !m.is_hidden && !m.is_alumni);
  const alumni = (data ?? []).filter((m) => !m.is_hidden && m.is_alumni);
  const hidden = (data ?? []).filter((m) => m.is_hidden && !m.is_deleted);
  const deleted = (data ?? []).filter((m) => m.is_deleted);
  const movable = active.filter((m) => !m.is_lead);

  const saveOrder = async (ids: number[]) => {
    if (!data) return;
    const fixed = active.filter((m) => m.is_lead).map((m) => m.id);
    const rest = [...alumni, ...hidden, ...deleted].map((m) => m.id);
    const byId = new Map(data.map((m) => [m.id, m]));
    setData([...fixed, ...ids, ...rest].map((id) => byId.get(id)!).filter(Boolean));
    try {
      await adminApi.post("/admin/team/reorder", { ids: [...fixed, ...ids, ...rest] });
      setMessage({ type: "success", text: "New order saved. The Team page is updated." });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
    reload();
  };

  const moveTo = (id: number, targetId: number) => {
    if (id === targetId) return;
    const ids = movable.map((m) => m.id).filter((x) => x !== id);
    ids.splice(ids.indexOf(targetId) + (movable.findIndex((m) => m.id === id) < movable.findIndex((m) => m.id === targetId) ? 1 : 0), 0, id);
    saveOrder(ids);
  };

  const shift = (id: number, dir: -1 | 1) => {
    const ids = movable.map((m) => m.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    saveOrder(ids);
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => draft && setDraft({ ...draft, [key]: value });

  const upload = async (file: File) => {
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await adminApi.post<{ url: string; kind: string }>("/admin/media", form);
      if (res.kind !== "image") throw new Error("Please choose an image");
      set("photo_url", res.url);
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    const body = { ...draft, photo_url: draft.photo_url || null, linkedin_url: draft.linkedin_url || null };
    try {
      if (draft.id) await adminApi.put(`/admin/team/${draft.id}`, body);
      else await adminApi.post("/admin/team", body);
      setMessage({ type: "success", text: `${draft.name} saved. The Team page is updated.` });
      setDraft(null);
      reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const act = async (m: Member, action: "alumni" | "active" | "hide" | "restore" | "delete") => {
    const done = {
      alumni: `${m.name} moved to alumni, at the bottom of the Team page.`,
      active: `${m.name} is back in the team.`,
      hide: `${m.name} is hidden from the website. You can restore them at any time.`,
      restore: `${m.name} is visible again.`,
      delete: `${m.name} deleted. The record is kept and a super admin can restore it.`,
    };
    try {
      if (action === "delete") await adminApi.delete(`/admin/team/${m.id}`);
      else await adminApi.post(`/admin/team/${m.id}/${action}`);
      setConfirm(null);
      setMessage({ type: "success", text: done[action] });
      reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  };

  const renderCard = (m: Member) => (
            <div
              key={m.id}
              className={`team-admin-card${m.is_hidden ? " row-hidden" : ""}${dragId === m.id ? " dragging" : ""}${overId === m.id && dragId !== m.id ? " drop-target" : ""}`}
              draggable={!m.is_hidden && !m.is_alumni && !m.is_lead}
              onDragStart={(e) => {
                setDragId(m.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (dragId === null || m.is_hidden || m.is_alumni || m.is_lead) return;
                e.preventDefault();
                setOverId(m.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId !== null) moveTo(dragId, m.id);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
            >
              {m.photo_url ? <img src={mediaSrc(m.photo_url)} alt="" /> : <div className="photo-placeholder team-photo-empty">{m.name[0]}</div>}
              <div className="team-admin-body">
                <strong>{m.name}</strong>
                <span>{m.title || "No title yet"}</span>
                <div className="team-admin-tags">
                  {Boolean(m.is_lead) && <span className="pill strong">Lab lead</span>}
                  <span className={`pill ${m.is_hidden ? "muted" : m.is_alumni ? "strong" : "ok"}`}>{m.is_deleted ? "Deleted" : m.is_hidden ? "Hidden" : m.is_alumni ? "Alumni" : "Visible"}</span>
                </div>
                {!m.is_hidden && !m.is_alumni && !m.is_lead && (
                  <div className="team-order">
                    <span className="team-drag" title="Drag to change the order" aria-hidden="true">
                      <svg viewBox="0 0 12 12"><path d="M4 2.5h.01M8 2.5h.01M4 6h.01M8 6h.01M4 9.5h.01M8 9.5h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                    </span>
                    <button type="button" className="team-move" onClick={() => shift(m.id, -1)} disabled={movable[0]?.id === m.id} aria-label={`Move ${m.name} earlier`}>
                      &larr;
                    </button>
                    <button type="button" className="team-move" onClick={() => shift(m.id, 1)} disabled={movable[movable.length - 1]?.id === m.id} aria-label={`Move ${m.name} later`}>
                      &rarr;
                    </button>
                  </div>
                )}
                <div className="team-admin-actions">
                  {!m.is_hidden && (
                    <button className="admin-button ghost small" onClick={() => setDraft(toDraft(m))}>
                      Edit
                    </button>
                  )}
                  {!m.is_hidden && !m.is_alumni && !m.is_lead &&
                    (confirm === m.id ? (
                      <>
                        <button className="admin-button primary small" onClick={() => act(m, "alumni")}>
                          Confirm: move to alumni
                        </button>
                        <button className="admin-button ghost small" onClick={() => setConfirm(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button className="admin-button ghost small" onClick={() => setConfirm(m.id)}>
                        Move to alumni
                      </button>
                    ))}
                  {!m.is_hidden && Boolean(m.is_alumni) && (
                    <>
                      <button className="admin-button ghost small" onClick={() => act(m, "active")}>
                        Back to the team
                      </button>
                      <button className="admin-button ghost small danger-text" onClick={() => act(m, "hide")}>
                        Hide from the website
                      </button>
                    </>
                  )}
                  {Boolean(m.is_hidden) && (!m.is_deleted || isSuper) && (
                    <button className="admin-button ghost small" onClick={() => act(m, "restore")}>
                      Restore
                    </button>
                  )}
                  {Boolean(m.is_hidden) && !m.is_deleted && isSuper &&
                    (confirm === m.id ? (
                      <>
                        <button className="admin-button danger small" onClick={() => act(m, "delete")}>
                          Confirm delete
                        </button>
                        <button className="admin-button ghost small" onClick={() => setConfirm(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button className="admin-button ghost small danger-text" onClick={() => setConfirm(m.id)}>
                        Delete
                      </button>
                    ))}
                </div>
              </div>
            </div>
  );

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Team members</h1>
        <p>
          Add and edit the people shown on the public Team page. The lab lead appears in a large card at the top. Drag a member card (or use the
          arrows) to change the order. Former members move to Alumni, at the bottom of the page, and can come back to the team at any time.
           Nothing is ever erased: hidden and deleted members are kept below.
        </p>
      </div>
      {error && <div className="admin-alert error">{error}</div>}
      {message && <div className={`admin-alert ${message.type}`}>{message.text}</div>}

      {draft ? (
        <section className="admin-card">
          <h2>{draft.id ? `Edit ${draft.name}` : "Add a member"}</h2>
          <div className="team-editor">
            <div className="team-photo-edit">
              {draft.photo_url ? (
                <img src={mediaSrc(draft.photo_url)} alt="" />
              ) : (
                <div className="photo-placeholder team-photo-empty">No photo</div>
              )}
              <button className="admin-button ghost small" onClick={() => photoInput.current?.click()} disabled={busy}>
                {draft.photo_url ? "Replace photo" : "Upload photo"}
              </button>
              {draft.photo_url && (
                <button className="admin-button ghost small" onClick={() => set("photo_url", "")}>
                  Remove photo
                </button>
              )}
              <input ref={photoInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </div>
            <div className="team-fields">
              <div className="admin-form-row">
                <label className="admin-field grow">
                  <span>Full name *</span>
                  <input value={draft.name} onChange={(e) => set("name", e.target.value)} />
                </label>
                <label className="admin-field grow">
                  <span>Title or role</span>
                  <input value={draft.title ?? ""} placeholder="e.g. Research scientist" onChange={(e) => set("title", e.target.value)} />
                </label>
              </div>
              <label className="admin-field">
                <span>Affiliation</span>
                <input value={draft.affiliation ?? ""} onChange={(e) => set("affiliation", e.target.value)} />
              </label>
              <label className="admin-field">
                <span>Description (shown when the member is clicked)</span>
                <textarea rows={7} value={draft.bio ?? ""} onChange={(e) => set("bio", e.target.value)} />
              </label>
              <label className="admin-field">
                <span>LinkedIn profile (optional)</span>
                <input value={draft.linkedin_url ?? ""} placeholder="https://www.linkedin.com/in/..." onChange={(e) => set("linkedin_url", e.target.value)} />
              </label>
              <div className="admin-form-row align-end">
                <label className="admin-field grow">
                  <span>Email (optional, shown publicly)</span>
                  <input value={draft.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                </label>
                <label className="admin-field">
                  <span>Order</span>
                  <input type="number" className="year-input" value={draft.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} />
                </label>
                <label className="check-field">
                  <input type="checkbox" checked={draft.is_lead} onChange={(e) => set("is_lead", e.target.checked)} />
                  Lab lead (large card at the top)
                </label>
              </div>
              <div className="preview-actions">
                <button className="admin-button ghost" onClick={() => setDraft(null)}>
                  Cancel
                </button>
                <button className="admin-button primary" onClick={save} disabled={busy || !draft.name.trim()}>
                  {busy ? "Saving..." : "Save member"}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div>
          <button className="admin-button primary" onClick={() => setDraft({ ...EMPTY, sort_order: (data?.length ?? 0) + 1 })}>
            Add a member
          </button>
        </div>
      )}

      <section className="admin-card">
        <h2>Members</h2>
        <div className="team-admin-grid">
          {active.map(renderCard)}
        </div>
      </section>
      <section className="admin-card">
        <h2>Alumni</h2>
        <p className="admin-hint">Former members, shown at the bottom of the Team page. Nothing is deleted: move them back to the team at any time.</p>
        {alumni.length ? <div className="team-admin-grid">{alumni.map(renderCard)}</div> : <p className="admin-empty">No alumni yet.</p>}
      </section>
      {hidden.length > 0 && (
        <details className="admin-card team-hidden">
          <summary>
            <h2>Hidden from the website ({hidden.length})</h2>
          </summary>
          <div className="team-admin-grid">{hidden.map(renderCard)}</div>
        </details>
      )}
      {deleted.length > 0 && (
        <details className="admin-card team-hidden">
          <summary>
            <h2>Deleted, kept for the record ({deleted.length})</h2>
          </summary>
          <p className="admin-hint">Nothing is erased. {isSuper ? "You can restore any of these." : "A super admin can restore them."}</p>
          <div className="team-admin-grid">{deleted.map(renderCard)}</div>
        </details>
      )}
    </div>
  );
}
