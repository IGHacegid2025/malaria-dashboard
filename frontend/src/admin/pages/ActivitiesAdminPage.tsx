// Author: Khadim Gueye

import { useRef, useState } from "react";
import { mediaSrc } from "../../components/HeroBackdrop";
import { useAuth } from "../AdminApp";
import { adminApi, formatDate } from "../adminApi";
import { useLoad } from "../useLoad";

interface Activity {
  id: number;
  title: string;
  category: string | null;
  description: string | null;
  activity_date: string | null;
  image_url: string | null;
  link_url: string | null;
  is_featured: number;
  sort_order: number;
  is_hidden: number;
  is_deleted: number;
  deleted_at: string | null;
}

type Draft = Omit<Activity, "id" | "is_hidden" | "is_featured" | "is_deleted" | "deleted_at"> & { id: number | null; is_featured: boolean };

const CATEGORIES = ["Fieldwork", "Laboratory", "Data", "Training", "Conference", "Publication", "Project", "News"];

const EMPTY: Draft = {
  id: null,
  title: "",
  category: "News",
  description: "",
  activity_date: new Date().toISOString().slice(0, 10),
  image_url: "",
  link_url: "",
  is_featured: false,
  sort_order: 10,
};

export default function ActivitiesAdminPage() {
  const { user } = useAuth();
  const isSuper = user.role === "super_admin";
  const { data, error, reload, setData } = useLoad<Activity[]>("/admin/activities");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => draft && setDraft({ ...draft, [key]: value });

  const upload = async (file: File) => {
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await adminApi.post<{ url: string; kind: string }>("/admin/media", form);
      if (res.kind !== "image") throw new Error("Please choose an image");
      set("image_url", res.url);
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
    const body = { ...draft, image_url: draft.image_url || null, link_url: draft.link_url || null, activity_date: draft.activity_date || null };
    try {
      if (draft.id) await adminApi.put(`/admin/activities/${draft.id}`, body);
      else await adminApi.post("/admin/activities", body);
      setMessage({ type: "success", text: `"${draft.title}" saved. The home page is updated.` });
      setDraft(null);
      reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const live = (data ?? []).filter((a) => !a.is_hidden && !a.is_deleted);
  const archived = (data ?? []).filter((a) => a.is_hidden && !a.is_deleted);
  const deleted = (data ?? []).filter((a) => a.is_deleted);

  const saveOrder = async (ids: number[]) => {
    if (!data) return;
    const byId = new Map(data.map((a) => [a.id, a]));
    const rest = [...archived, ...deleted].map((a) => a.id);
    setData([...ids, ...rest].map((id) => byId.get(id)!).filter(Boolean));
    try {
      await adminApi.post("/admin/activities/reorder", { ids: [...ids, ...rest] });
      setMessage({ type: "success", text: "New order saved. The home page is updated." });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
    reload();
  };

  const moveTo = (id: number, targetId: number) => {
    if (id === targetId) return;
    const ids = live.map((a) => a.id).filter((x) => x !== id);
    const forward = live.findIndex((a) => a.id === id) < live.findIndex((a) => a.id === targetId);
    ids.splice(ids.indexOf(targetId) + (forward ? 1 : 0), 0, id);
    saveOrder(ids);
  };

  const shift = (id: number, dir: -1 | 1) => {
    const ids = live.map((a) => a.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    saveOrder(ids);
  };

  const act = async (a: Activity, action: "hide" | "restore" | "delete") => {
    const done = {
      hide: `"${a.title}" archived. It is no longer on the home page, and stays in the Archive below.`,
      restore: `"${a.title}" is back on the home page.`,
      delete: `"${a.title}" deleted. It is kept for the record and can be restored by a super admin.`,
    };
    try {
      if (action === "delete") await adminApi.delete(`/admin/activities/${a.id}`);
      else await adminApi.post(`/admin/activities/${a.id}/${action}`);
      setConfirm(null);
      setMessage({ type: "success", text: done[action] });
      reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  };

  const renderCard = (a: Activity) => (
    <div
      key={a.id}
      className={`activity-admin-card${a.is_hidden ? " row-hidden" : ""}${dragId === a.id ? " dragging" : ""}${overId === a.id && dragId !== a.id ? " drop-target" : ""}`}
      draggable={!a.is_hidden && !a.is_deleted}
      onDragStart={(e) => {
        setDragId(a.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (dragId === null || a.is_hidden || a.is_deleted) return;
        e.preventDefault();
        setOverId(a.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragId !== null) moveTo(dragId, a.id);
        setDragId(null);
        setOverId(null);
      }}
      onDragEnd={() => {
        setDragId(null);
        setOverId(null);
      }}
    >
      {a.image_url ? <img src={mediaSrc(a.image_url)} alt="" /> : <div className="photo-placeholder">{a.title[0]}</div>}
      <div className="team-admin-body">
        <strong>{a.title}</strong>
        <span>{[a.category, a.activity_date ? formatDate(a.activity_date).split(",")[0] : null].filter(Boolean).join(" · ") || "No category"}</span>
        <div className="team-admin-tags">
          {Boolean(a.is_featured) && <span className="pill strong">Slideshow</span>}
          <span className={`pill ${a.is_hidden || a.is_deleted ? "muted" : "ok"}`}>
            {a.is_deleted ? `Deleted ${a.deleted_at ? formatDate(a.deleted_at).split(",")[0] : ""}` : a.is_hidden ? "Archived" : "On the home page"}
          </span>
        </div>
        {!a.is_hidden && !a.is_deleted && (
          <div className="team-order">
            <span className="team-drag" title="Drag to change the order" aria-hidden="true">
              <svg viewBox="0 0 12 12">
                <path d="M4 2.5h.01M8 2.5h.01M4 6h.01M8 6h.01M4 9.5h.01M8 9.5h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <button type="button" className="team-move" onClick={() => shift(a.id, -1)} disabled={live[0]?.id === a.id} aria-label={`Move ${a.title} earlier`}>
              &larr;
            </button>
            <button type="button" className="team-move" onClick={() => shift(a.id, 1)} disabled={live[live.length - 1]?.id === a.id} aria-label={`Move ${a.title} later`}>
              &rarr;
            </button>
          </div>
        )}
        <div className="team-admin-actions">
          {!a.is_deleted && (
            <button className="admin-button ghost small" onClick={() => setDraft({ ...a, is_featured: Boolean(a.is_featured), activity_date: a.activity_date?.slice(0, 10) ?? "" })}>
              Edit
            </button>
          )}
          {!a.is_hidden &&
            !a.is_deleted &&
            (confirm === a.id ? (
              <>
                <button className="admin-button primary small" onClick={() => act(a, "hide")}>
                  Confirm: archive
                </button>
                <button className="admin-button ghost small" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="admin-button ghost small" onClick={() => setConfirm(a.id)}>
                Archive
              </button>
            ))}
          {Boolean(a.is_hidden) && !a.is_deleted && (
            <button className="admin-button ghost small" onClick={() => act(a, "restore")}>
              Put back on the home page
            </button>
          )}
          {Boolean(a.is_hidden) &&
            !a.is_deleted &&
            isSuper &&
            (confirm === a.id ? (
              <>
                <button className="admin-button danger small" onClick={() => act(a, "delete")}>
                  Confirm delete
                </button>
                <button className="admin-button ghost small" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="admin-button ghost small danger-text" onClick={() => setConfirm(a.id)}>
                Delete
              </button>
            ))}
          {Boolean(a.is_deleted) && isSuper && (
            <button className="admin-button ghost small" onClick={() => act(a, "restore")}>
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
        <h1>Lab activities</h1>
        <p>
          News, fieldwork, trainings and events shown on the home page. Featured activities also appear in the large photo slideshow at the top.
           Drag a card (or use the arrows) to change the order. Archived and deleted activities are always kept, so nothing is lost.
        </p>
      </div>
      {error && <div className="admin-alert error">{error}</div>}
      {message && <div className={`admin-alert ${message.type}`}>{message.text}</div>}

      {draft ? (
        <section className="admin-card">
          <h2>{draft.id ? `Edit "${draft.title}"` : "Add an activity"}</h2>
          <div className="team-editor">
            <div className="team-photo-edit">
              {draft.image_url ? <img src={mediaSrc(draft.image_url)} alt="" /> : <div className="photo-placeholder team-photo-empty">No photo</div>}
              <button className="admin-button ghost small" onClick={() => photoInput.current?.click()} disabled={busy}>
                {draft.image_url ? "Replace photo" : "Upload photo"}
              </button>
              {draft.image_url && (
                <button className="admin-button ghost small" onClick={() => set("image_url", "")}>
                  Remove photo
                </button>
              )}
              <input ref={photoInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </div>
            <div className="team-fields">
              <div className="admin-form-row">
                <label className="admin-field grow">
                  <span>Title *</span>
                  <input value={draft.title} maxLength={255} onChange={(e) => set("title", e.target.value)} />
                </label>
                <label className="admin-field">
                  <span>Category</span>
                  <input list="activity-categories" value={draft.category ?? ""} onChange={(e) => set("category", e.target.value)} />
                  <datalist id="activity-categories">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="admin-field">
                  <span>Date</span>
                  <input type="date" value={draft.activity_date ?? ""} onChange={(e) => set("activity_date", e.target.value)} />
                </label>
              </div>
              <label className="admin-field">
                <span>Text</span>
                <textarea rows={4} value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </label>
              <div className="admin-form-row align-end">
                <label className="admin-field grow">
                  <span>Link (optional, https://)</span>
                  <input value={draft.link_url ?? ""} placeholder="https://" onChange={(e) => set("link_url", e.target.value)} />
                </label>
                <label className="admin-field">
                  <span>Order</span>
                  <input type="number" className="year-input" value={draft.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} />
                </label>
                <label className="check-field">
                  <input type="checkbox" checked={draft.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />
                  Show in the home slideshow
                </label>
              </div>
              <div className="preview-actions">
                <button className="admin-button ghost" onClick={() => setDraft(null)}>
                  Cancel
                </button>
                <button className="admin-button primary" onClick={save} disabled={busy || !draft.title.trim()}>
                  {busy ? "Saving..." : "Save activity"}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div>
          <button className="admin-button primary" onClick={() => setDraft({ ...EMPTY, sort_order: (data?.length ?? 0) + 1 })}>
            Add an activity
          </button>
        </div>
      )}

      <section className="admin-card">
        <h2>On the home page</h2>
        {live.length === 0 ? <p className="admin-empty">No activity on the home page.</p> : <div className="activity-admin-grid">{live.map(renderCard)}</div>}
      </section>
      <section className="admin-card">
        <h2>Archive</h2>
        <p className="admin-hint">Past activities no longer shown on the home page. They are kept here and can be put back at any time.</p>
        {archived.length === 0 ? <p className="admin-empty">No archived activity.</p> : <div className="activity-admin-grid">{archived.map(renderCard)}</div>}
      </section>
      {deleted.length > 0 && (
        <details className="admin-card team-hidden">
          <summary>
            <h2>Deleted, kept for the record ({deleted.length})</h2>
          </summary>
          <p className="admin-hint">Nothing is erased. {isSuper ? "You can restore any of these." : "A super admin can restore them."}</p>
          <div className="activity-admin-grid">{deleted.map(renderCard)}</div>
        </details>
      )}
    </div>
  );
}
