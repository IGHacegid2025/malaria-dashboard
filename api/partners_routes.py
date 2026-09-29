# Projects and partners of the lab, shown on the Projects page
# Author: Khadim Gueye

import re
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from db import execute, query, query_one, transaction
from security import audit, client_ip, current_user

router = APIRouter()

LOGO = re.compile(r"^/(api/media|team|home)/[A-Za-z0-9_.-]+$")
PUBLIC = "id, kind, name, description, logo_url, link_url"


class PartnerBody(BaseModel):
    kind: Literal["project", "partner"]
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    link_url: Optional[str] = None
    is_visible: bool = False


def _clean(body: PartnerBody):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    logo = (body.logo_url or "").strip() or None
    if logo and not LOGO.match(logo):
        raise HTTPException(400, "Upload the logo from this page")
    link = (body.link_url or "").strip() or None
    if link and (not re.match(r"^https://\S+$", link) or any(c in link for c in "\"'<>")):
        raise HTTPException(400, "The link must start with https://")
    return body.kind, name[:200], (body.description or "").strip() or None, logo, link, 1 if body.is_visible else 0


def _get(partner_id):
    row = query_one("SELECT * FROM partners WHERE id = %s", (partner_id,))
    if not row:
        raise HTTPException(404, "Project or partner not found")
    return row


@router.get("/api/partners")
def list_partners():
    return query(f"SELECT {PUBLIC} FROM partners WHERE is_visible = 1 AND is_deleted = 0 ORDER BY kind DESC, sort_order, name")


@router.get("/api/admin/partners")
def admin_partners(user=Depends(current_user)):
    return query("SELECT * FROM partners ORDER BY is_deleted, kind DESC, sort_order, name")


@router.post("/api/admin/partners")
def create_partner(body: PartnerBody, request: Request, user=Depends(current_user)):
    values = _clean(body)
    position = query_one("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM partners WHERE kind = %s", (values[0],))["n"]
    new_id, _ = execute(
        "INSERT INTO partners (kind, name, description, logo_url, link_url, is_visible, sort_order) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (*values, position),
    )
    audit(user, "partner_added", "partner", new_id, {"name": values[1], "kind": values[0]}, client_ip(request))
    return {"id": new_id}


@router.put("/api/admin/partners/{partner_id}")
def update_partner(partner_id: int, body: PartnerBody, request: Request, user=Depends(current_user)):
    before = _get(partner_id)
    values = _clean(body)
    execute(
        "UPDATE partners SET kind = %s, name = %s, description = %s, logo_url = %s, link_url = %s, is_visible = %s WHERE id = %s",
        (*values, partner_id),
    )
    audit(user, "partner_updated", "partner", partner_id, {"before": before, "after": body.model_dump()}, client_ip(request))
    return {"ok": True}


class VisibilityBody(BaseModel):
    visible: bool


@router.post("/api/admin/partners/{partner_id}/visibility")
def partner_visibility(partner_id: int, body: VisibilityBody, request: Request, user=Depends(current_user)):
    row = _get(partner_id)
    if row["is_deleted"]:
        raise HTTPException(400, "Restore this entry first")
    execute("UPDATE partners SET is_visible = %s WHERE id = %s", (1 if body.visible else 0, partner_id))
    audit(user, "partner_shown" if body.visible else "partner_hidden", "partner", partner_id, {"name": row["name"]}, client_ip(request))
    return {"ok": True}


class OrderBody(BaseModel):
    ids: list[int]


@router.post("/api/admin/partners/reorder")
def reorder_partners(body: OrderBody, request: Request, user=Depends(current_user)):
    known = {r["id"] for r in query("SELECT id FROM partners")}
    if not body.ids or len(set(body.ids)) != len(body.ids) or not set(body.ids) <= known:
        raise HTTPException(400, "Unknown or duplicated entry in the new order")
    with transaction() as cur:
        for position, partner_id in enumerate(body.ids, start=1):
            cur.execute("UPDATE partners SET sort_order = %s WHERE id = %s", (position, partner_id))
    audit(user, "partners_reordered", "partner", None, {"order": body.ids}, client_ip(request))
    return {"ok": True}


@router.delete("/api/admin/partners/{partner_id}")
def delete_partner(partner_id: int, request: Request, user=Depends(current_user)):
    row = _get(partner_id)
    execute("UPDATE partners SET is_deleted = 1, is_visible = 0, deleted_at = NOW() WHERE id = %s", (partner_id,))
    audit(user, "partner_deleted", "partner", partner_id, {"before": row}, client_ip(request))
    return {"ok": True}


@router.post("/api/admin/partners/{partner_id}/restore")
def restore_partner(partner_id: int, request: Request, user=Depends(current_user)):
    row = _get(partner_id)
    execute("UPDATE partners SET is_deleted = 0, deleted_at = NULL WHERE id = %s", (partner_id,))
    audit(user, "partner_restored", "partner", partner_id, {"name": row["name"]}, client_ip(request))
    return {"ok": True}
