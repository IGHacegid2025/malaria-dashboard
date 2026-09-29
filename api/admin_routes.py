# Author: Khadim Gueye

import io
import json
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps
from pydantic import BaseModel

import uploads
from db import execute, query, query_one, transaction
from security import (
    LOCK_MINUTES,
    MAX_FAILED_ATTEMPTS,
    audit,
    client_ip,
    create_token,
    current_user,
    current_user_allow_password_change,
    hash_password,
    password_problem,
    public_user,
    super_admin,
    temporary_password,
    verify_password,
)

router = APIRouter()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024

ENTITIES = {
    "observations": "observations",
    "publications": "publications",
    "species": "species_observations",
    "diagnostics": "hrp_deletions",
    "moi": "moi_distribution",
    "mis": "mis_prevalence",
}

RECORD_QUERIES = {
    "observations": """
        SELECT o.id, s.name AS state, o.year, g.name AS gene, m.mutation_code AS mutation, o.prevalence,
               o.sample_count, o.source_type, p.author, p.year_of_publication, o.upload_id, o.is_hidden
        FROM observations o
        JOIN states s ON s.id = o.state_id
        JOIN mutations m ON m.id = o.mutation_id
        JOIN genes g ON g.id = m.gene_id
        LEFT JOIN publications p ON p.id = o.publication_id
    """,
    "publications": """
        SELECT p.id, p.author, p.year_of_publication AS year, p.doi, p.title, p.upload_id, p.is_hidden,
               (SELECT COUNT(*) FROM observations o WHERE o.publication_id = p.id) AS observation_count
        FROM publications p
    """,
    "species": """
        SELECT x.id, s.name AS state, x.year, x.species_combination AS species, x.sample_count, x.source_type,
               p.author, x.upload_id, x.is_hidden
        FROM species_observations x
        JOIN states s ON s.id = x.state_id
        LEFT JOIN publications p ON p.id = x.publication_id
    """,
    "diagnostics": """
        SELECT x.id, s.name AS state, x.year, x.deletion_type, x.sample_count, x.source_type, x.location,
               p.author, x.upload_id, x.is_hidden
        FROM hrp_deletions x
        JOIN states s ON s.id = x.state_id
        LEFT JOIN publications p ON p.id = x.publication_id
    """,
    "moi": """
        SELECT x.id, s.name AS state, b.year, x.moi_value AS moi, x.sample_count, x.upload_id, x.is_hidden
        FROM moi_distribution x
        JOIN sequencing_batches b ON b.id = x.sequencing_batch_id
        JOIN states s ON s.id = b.state_id
    """,
    "mis": """
        SELECT x.id, s.name AS state, x.year, x.prevalence, x.upload_id, x.is_hidden
        FROM mis_prevalence x
        JOIN states s ON s.id = x.state_id
    """,
}

SEARCH_COLUMNS = {
    "observations": ["s.name", "g.name", "m.mutation_code", "p.author", "CAST(o.year AS CHAR)"],
    "publications": ["p.author", "p.doi", "p.title", "CAST(p.year_of_publication AS CHAR)"],
    "species": ["s.name", "x.species_combination", "p.author", "CAST(x.year AS CHAR)"],
    "diagnostics": ["s.name", "x.deletion_type", "p.author", "x.location", "CAST(x.year AS CHAR)"],
    "moi": ["s.name", "CAST(b.year AS CHAR)"],
    "mis": ["s.name", "CAST(x.year AS CHAR)"],
}

HIDDEN_COLUMN = {
    "observations": "o.is_hidden",
    "publications": "p.is_hidden",
    "species": "x.is_hidden",
    "diagnostics": "x.is_hidden",
    "moi": "x.is_hidden",
    "mis": "x.is_hidden",
}

SETTING_KEYS = {
    "site.title": str,
    "site.lab": str,
    "site.institute": str,
    "site.announcement": str,
    "site.about": list,
    "nav.hidden": list,
    "site.github_url": str,
    "site.linkedin_url": str,
    "site.default_year": (str, int),
    "site.website_url": str,
    "site.public_url": str,
    "theme.primary": str,
    "theme.hero_from": str,
    "theme.hero_via": str,
    "theme.hero_to": str,
    "theme.status_high": str,
    "theme.status_watch": str,
    "theme.status_low": str,
    "theme.tile_1": str,
    "theme.tile_2": str,
    "theme.tile_3": str,
    "theme.tile_4": str,
    "theme.map_color": str,
    "theme.page_bg": str,
    "hero.color": str,
    "hero.mode": str,
    "hero.media_url": str,
    "hero.overlay": (int, float),
    "theme.font_scale": (int, float),
    "size.title": (int, float),
    "size.kpi": (int, float),
    "size.card_value": (int, float),
    "size.card_title": (int, float),
    "size.panel_title": (int, float),
    "size.map": (int, float),
    "size.trend_chart": (int, float),
    "size.trend_map": (int, float),
    "size.ranking": (int, float),
    "size.explorer_map": (int, float),
}

SIZE_LIMITS = {
    "theme.font_scale": (0.85, 1.25),
    "size.title": (20, 48),
    "size.kpi": (16, 44),
    "size.card_value": (16, 44),
    "size.card_title": (12, 24),
    "size.panel_title": (12, 24),
    "size.map": (240, 640),
    "size.trend_chart": (180, 520),
    "size.trend_map": (180, 520),
    "size.ranking": (160, 640),
    "size.explorer_map": (280, 900),
    "hero.overlay": (0, 0.85),
}

HERO_MODES = {"gradient", "color", "image", "video"}
NAV_TABS = {"map", "trends", "genomics", "sources", "team", "projects"}
MEDIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media")
MEDIA_TYPES = {
    ".jpg": ("image", 25), ".jpeg": ("image", 25), ".png": ("image", 25), ".webp": ("image", 25),
    ".mp4": ("video", 25), ".webm": ("video", 25),
}

IMAGE_MAX_SIDE = 2400


def prepare_image(content: bytes):
    try:
        with Image.open(io.BytesIO(content)) as im:
            im.load()
            im = ImageOps.exif_transpose(im)
            has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
            im = im.convert("RGBA" if has_alpha else "RGB")
            im.thumbnail((IMAGE_MAX_SIDE, IMAGE_MAX_SIDE), Image.LANCZOS)
            out = io.BytesIO()
            if has_alpha:
                im.save(out, "WEBP", quality=86, method=4)
                return out.getvalue(), ".webp"
            im.save(out, "JPEG", quality=85, optimize=True, progressive=True)
            return out.getvalue(), ".jpg"
    except (OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(400, "This file is not a readable image")


COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")


class LoginBody(BaseModel):
    email: str
    password: str


class PasswordBody(BaseModel):
    current_password: str
    new_password: str


class NewUserBody(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: str = "admin"


class UserPatchBody(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class LevelBody(BaseModel):
    id: int
    max_prevalence: float
    classification: str
    message: Optional[str] = None
    summary: Optional[str] = None
    guideline: Optional[str] = None


class RuleBody(BaseModel):
    who_status: Optional[str] = None
    antimalarial: Optional[str] = None
    reference_text: Optional[str] = None
    levels: list[LevelBody]


class NewRuleBody(BaseModel):
    gene: str
    mutation: str


def load_settings():
    rows = query("SELECT setting_key, setting_value FROM site_settings WHERE setting_key NOT LIKE %s", ("migration.%",))
    return {r["setting_key"]: json.loads(r["setting_value"]) for r in rows}


@router.post("/api/auth/login")
def login(body: LoginBody, request: Request):
    email = body.email.strip().lower()
    user = query_one("SELECT * FROM admin_users WHERE LOWER(email) = %s", (email,))
    ip = client_ip(request)
    if not user or not user["is_active"]:
        audit(None, "login_failed", "user", None, {"email": email}, ip)
        raise HTTPException(401, "Wrong email or password")
    if user["locked_until"] and user["locked_until"] > datetime.now():
        raise HTTPException(423, f"Too many attempts. Try again after {user['locked_until']:%H:%M}.")
    if not verify_password(body.password, user["password_hash"]):
        attempts = user["failed_attempts"] + 1
        locked = datetime.now() + timedelta(minutes=LOCK_MINUTES) if attempts >= MAX_FAILED_ATTEMPTS else None
        execute(
            "UPDATE admin_users SET failed_attempts = %s, locked_until = %s WHERE id = %s",
            (0 if locked else attempts, locked, user["id"]),
        )
        audit(user, "login_failed", "user", user["id"], {"attempt": attempts}, ip)
        raise HTTPException(401, "Wrong email or password")
    execute(
        "UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = %s",
        (user["id"],),
    )
    audit(user, "login", "user", user["id"], None, ip)
    return {"token": create_token(user["id"]), "user": public_user(user)}


@router.get("/api/auth/me")
def me(user=Depends(current_user_allow_password_change)):
    return public_user(user)


@router.post("/api/auth/change-password")
def change_password(body: PasswordBody, request: Request, user=Depends(current_user_allow_password_change)):
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    problem = password_problem(body.new_password)
    if problem:
        raise HTTPException(400, problem)
    if body.new_password == body.current_password:
        raise HTTPException(400, "The new password must be different")
    execute(
        "UPDATE admin_users SET password_hash = %s, must_change_password = 0 WHERE id = %s",
        (hash_password(body.new_password), user["id"]),
    )
    audit(user, "password_changed", "user", user["id"], None, client_ip(request))
    return {"ok": True}


@router.get("/api/admin/overview")
def overview(user=Depends(current_user)):
    counts = {}
    for key, table in ENTITIES.items():
        row = query_one(f"SELECT COUNT(*) AS total, SUM(is_hidden) AS hidden FROM {table}")
        counts[key] = {"total": row["total"], "hidden": int(row["hidden"] or 0)}
    recent_uploads = query(
        """
        SELECT u.id, u.kind, u.filename, u.rows_inserted, u.is_hidden, u.created_at, a.email
        FROM uploads u LEFT JOIN admin_users a ON a.id = u.user_id
        ORDER BY u.created_at DESC LIMIT 5
        """
    )
    activity_sql = "SELECT id, user_email, action, entity, entity_id, created_at FROM audit_log"
    params: list[Any] = []
    if user["role"] != "super_admin":
        activity_sql += " WHERE user_id = %s"
        params.append(user["id"])
    activity = query(activity_sql + " ORDER BY created_at DESC LIMIT 8", params)
    return {"counts": counts, "recent_uploads": recent_uploads, "activity": activity}


@router.get("/api/admin/users")
def list_users(user=Depends(super_admin)):
    return query(
        """
        SELECT u.id, u.email, u.full_name, u.role, u.is_owner, u.is_active, u.must_change_password,
               u.last_login_at, u.created_at, c.email AS created_by
        FROM admin_users u LEFT JOIN admin_users c ON c.id = u.created_by
        ORDER BY u.is_owner DESC, u.role DESC, u.email
        """
    )


@router.post("/api/admin/users")
def create_user(body: NewUserBody, request: Request, user=Depends(super_admin)):
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(400, "Invalid email")
    if body.role not in ("admin", "super_admin"):
        raise HTTPException(400, "Invalid role")
    if query_one("SELECT id FROM admin_users WHERE LOWER(email) = %s", (email,)):
        raise HTTPException(409, "An account with this email already exists")
    password = temporary_password()
    new_id, _ = execute(
        """
        INSERT INTO admin_users (email, password_hash, full_name, role, must_change_password, created_by)
        VALUES (%s, %s, %s, %s, 1, %s)
        """,
        (email, hash_password(password), body.full_name, body.role, user["id"]),
    )
    audit(user, "user_created", "user", new_id, {"email": email, "role": body.role}, client_ip(request))
    return {"id": new_id, "temporary_password": password}


def _target_user(user_id: int, actor: dict):
    target = query_one("SELECT * FROM admin_users WHERE id = %s", (user_id,))
    if not target:
        raise HTTPException(404, "User not found")
    if target["is_owner"]:
        raise HTTPException(403, "This account is protected and cannot be modified")
    if target["id"] == actor["id"]:
        raise HTTPException(400, "You cannot change your own role or status")
    return target


@router.patch("/api/admin/users/{user_id}")
def update_user(user_id: int, body: UserPatchBody, request: Request, user=Depends(super_admin)):
    target = _target_user(user_id, user)
    changes = {}
    if body.role is not None:
        if body.role not in ("admin", "super_admin"):
            raise HTTPException(400, "Invalid role")
        changes["role"] = body.role
    if body.is_active is not None:
        changes["is_active"] = 1 if body.is_active else 0
    if body.full_name is not None:
        changes["full_name"] = body.full_name
    if not changes:
        return {"ok": True}
    sets = ", ".join(f"{k} = %s" for k in changes)
    execute(f"UPDATE admin_users SET {sets} WHERE id = %s", (*changes.values(), user_id))
    before = {k: target[k] for k in changes}
    action = "user_role_changed" if "role" in changes else "user_updated"
    if "is_active" in changes:
        action = "user_reactivated" if changes["is_active"] else "user_removed"
    audit(user, action, "user", user_id, {"email": target["email"], "before": before, "after": changes}, client_ip(request))
    return {"ok": True}


@router.post("/api/admin/users/{user_id}/reset-password")
def reset_password(user_id: int, request: Request, user=Depends(super_admin)):
    target = _target_user(user_id, user)
    password = temporary_password()
    execute(
        "UPDATE admin_users SET password_hash = %s, must_change_password = 1, failed_attempts = 0, locked_until = NULL WHERE id = %s",
        (hash_password(password), user_id),
    )
    audit(user, "password_reset", "user", user_id, {"email": target["email"]}, client_ip(request))
    return {"temporary_password": password}


@router.get("/api/admin/audit")
def audit_log(
    user=Depends(super_admin),
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    sql = "SELECT id, user_id, user_email, action, entity, entity_id, details, ip_address, created_at FROM audit_log WHERE 1 = 1"
    params: list[Any] = []
    if user_id:
        sql += " AND user_id = %s"
        params.append(user_id)
    if action:
        sql += " AND action = %s"
        params.append(action)
    total = query_one(sql.replace("SELECT id, user_id, user_email, action, entity, entity_id, details, ip_address, created_at", "SELECT COUNT(*) AS n"), params)["n"]
    rows = query(sql + " ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s", [*params, min(limit, 200), offset])
    for r in rows:
        r["details"] = json.loads(r["details"]) if r["details"] else None
    actions = [r["action"] for r in query("SELECT DISTINCT action FROM audit_log ORDER BY action")]
    return {"total": total, "rows": rows, "actions": actions}


@router.get("/api/admin/templates")
def template_list(user=Depends(current_user)):
    return [
        {"kind": kind, "label": spec["label"], "description": spec["description"],
         "columns": [{"name": c[1], "required": c[2], "help": c[3]} for c in spec["columns"]]}
        for kind, spec in uploads.KINDS.items()
    ]


@router.get("/api/admin/templates/{kind}")
def template_file(kind: str, user=Depends(current_user)):
    if kind not in uploads.KINDS:
        raise HTTPException(404, "Unknown template")
    return Response(
        uploads.build_template(kind),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="template_{kind}.xlsx"'},
    )


async def _read_upload(kind: str, file: UploadFile):
    if kind not in uploads.KINDS:
        raise HTTPException(400, "Unknown data type")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is larger than 10 MB")
    try:
        return content, uploads.validate(kind, file.filename or "upload.xlsx", content)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/api/admin/uploads/preview")
async def upload_preview(kind: str = Form(...), file: UploadFile = File(...), user=Depends(current_user)):
    _, result = await _read_upload(kind, file)
    return {
        "kind": kind,
        "filename": file.filename,
        "total_rows": result["total_rows"],
        "valid_rows": result["valid_rows"],
        "errors": result["errors"][:200],
        "error_count": len(result["errors"]),
        "warnings": result["warnings"][:200],
        "warning_count": len(result["warnings"]),
        "sample": [{k: v for k, v in r.items() if not k.endswith("_id")} for r in result["rows"][:15]],
    }


@router.post("/api/admin/uploads/commit")
async def upload_commit(request: Request, kind: str = Form(...), file: UploadFile = File(...), user=Depends(current_user)):
    _, result = await _read_upload(kind, file)
    if result["errors"]:
        raise HTTPException(400, f"The file still has {len(result['errors'])} error(s). Fix them and upload again.")
    if not result["rows"]:
        raise HTTPException(400, "No rows to import")
    with transaction() as cur:
        cur.execute(
            "INSERT INTO uploads (user_id, kind, filename, summary) VALUES (%s, %s, %s, %s)",
            (user["id"], kind, file.filename, json.dumps({"warnings": len(result["warnings"])})),
        )
        upload_id = cur.lastrowid
        inserted = uploads.commit(cur, kind, result["rows"], upload_id)
        cur.execute("UPDATE uploads SET rows_inserted = %s WHERE id = %s", (inserted, upload_id))
    audit(user, "data_uploaded", "upload", upload_id, {"kind": kind, "filename": file.filename, "rows": inserted}, client_ip(request))
    return {"upload_id": upload_id, "rows_inserted": inserted}


@router.get("/api/admin/uploads")
def upload_list(user=Depends(current_user)):
    return query(
        """
        SELECT u.id, u.kind, u.filename, u.rows_inserted, u.is_hidden, u.created_at, a.email
        FROM uploads u LEFT JOIN admin_users a ON a.id = u.user_id
        ORDER BY u.created_at DESC
        """
    )


def _set_upload_hidden(upload_id: int, hidden: int):
    with transaction() as cur:
        cur.execute("UPDATE uploads SET is_hidden = %s WHERE id = %s", (hidden, upload_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "Upload not found")
        for table in ENTITIES.values():
            cur.execute(f"UPDATE {table} SET is_hidden = %s WHERE upload_id = %s", (hidden, upload_id))


@router.post("/api/admin/uploads/{upload_id}/hide")
def upload_hide(upload_id: int, request: Request, user=Depends(current_user)):
    _set_upload_hidden(upload_id, 1)
    audit(user, "upload_hidden", "upload", upload_id, None, client_ip(request))
    return {"ok": True}


@router.post("/api/admin/uploads/{upload_id}/restore")
def upload_restore(upload_id: int, request: Request, user=Depends(super_admin)):
    _set_upload_hidden(upload_id, 0)
    audit(user, "upload_restored", "upload", upload_id, None, client_ip(request))
    return {"ok": True}


@router.get("/api/admin/records/{entity}")
def records(
    entity: str,
    user=Depends(current_user),
    q: str = "",
    status: str = "all",
    limit: int = 50,
    offset: int = 0,
):
    if entity not in RECORD_QUERIES:
        raise HTTPException(404, "Unknown data type")
    base = RECORD_QUERIES[entity]
    where = ["1 = 1"]
    params: list[Any] = []
    if q.strip():
        like = f"%{q.strip()}%"
        where.append("(" + " OR ".join(f"{c} LIKE %s" for c in SEARCH_COLUMNS[entity]) + ")")
        params.extend([like] * len(SEARCH_COLUMNS[entity]))
    if status == "visible":
        where.append(f"{HIDDEN_COLUMN[entity]} = 0")
    elif status == "hidden":
        where.append(f"{HIDDEN_COLUMN[entity]} = 1")
    sql = f"{base} WHERE {' AND '.join(where)}"
    total = query_one(f"SELECT COUNT(*) AS n FROM ({sql}) t", params)["n"]
    rows = query(f"{sql} ORDER BY 1 DESC LIMIT %s OFFSET %s", [*params, min(limit, 200), offset])
    return {"total": total, "rows": rows}


def _set_record_hidden(entity: str, record_id: int, hidden: int):
    if entity not in ENTITIES:
        raise HTTPException(404, "Unknown data type")
    _, count = execute(f"UPDATE {ENTITIES[entity]} SET is_hidden = %s WHERE id = %s", (hidden, record_id))
    if count == 0 and not query_one(f"SELECT id FROM {ENTITIES[entity]} WHERE id = %s", (record_id,)):
        raise HTTPException(404, "Record not found")


@router.post("/api/admin/records/{entity}/{record_id}/hide")
def record_hide(entity: str, record_id: int, request: Request, user=Depends(current_user)):
    _set_record_hidden(entity, record_id, 1)
    audit(user, "record_hidden", entity, record_id, None, client_ip(request))
    return {"ok": True}


@router.post("/api/admin/records/{entity}/{record_id}/restore")
def record_restore(entity: str, record_id: int, request: Request, user=Depends(super_admin)):
    _set_record_hidden(entity, record_id, 0)
    audit(user, "record_restored", entity, record_id, None, client_ip(request))
    return {"ok": True}


@router.get("/api/admin/alerts")
def admin_alerts(user=Depends(current_user)):
    rules = query("SELECT * FROM alert_rules ORDER BY gene, mutation_pattern")
    levels = query("SELECT * FROM alert_levels ORDER BY alert_rule_id, level_order")
    by_rule: dict[int, list] = {}
    for level in levels:
        by_rule.setdefault(level["alert_rule_id"], []).append(level)
    for rule in rules:
        rule["levels"] = by_rule.get(rule["id"], [])
    return rules


DEFAULT_LEVELS = [
    (0.3, "low", "Low prevalence of this marker.", "No change in treatment expected."),
    (0.6, "intermediate", "Prevalence of this marker is increasing and should be monitored.", "Monitor closely."),
    (1.0, "high", "High prevalence of this marker.", "Action may be needed."),
]


@router.post("/api/admin/alerts")
def create_alert(body: NewRuleBody, request: Request, user=Depends(current_user)):
    gene = body.gene.strip().lower()
    mutation = body.mutation.strip().upper()
    if not gene or not mutation or mutation == "*":
        raise HTTPException(400, "Choose a gene and a mutation")
    if not query_one(
        "SELECT m.id FROM mutations m JOIN genes g ON g.id = m.gene_id WHERE g.name = %s AND m.mutation_code = %s",
        (gene, mutation),
    ):
        raise HTTPException(404, "This mutation is not in the database yet")
    if query_one("SELECT id FROM alert_rules WHERE gene = %s AND mutation_pattern = %s", (gene, mutation)):
        raise HTTPException(409, "This mutation already has its own rule")
    base = query_one("SELECT * FROM alert_rules WHERE gene = %s AND mutation_pattern = '*'", (gene,))
    base_levels = query("SELECT * FROM alert_levels WHERE alert_rule_id = %s ORDER BY level_order", (base["id"],)) if base else []
    with transaction() as cur:
        cur.execute(
            "INSERT INTO alert_rules (gene, mutation_pattern, antimalarial, resistance_level, reference_text) VALUES (%s, %s, %s, %s, %s)",
            (gene, mutation, base["antimalarial"] if base else None, None, base["reference_text"] if base else None),
        )
        rule_id = cur.lastrowid
        if base_levels:
            for level in base_levels:
                cur.execute(
                    """
                    INSERT INTO alert_levels (alert_rule_id, level_order, max_prevalence, classification, guideline, message, summary)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (rule_id, level["level_order"], level["max_prevalence"], level["classification"], level["guideline"], level["message"], level["summary"]),
                )
        else:
            for order, (threshold, classification, message, summary) in enumerate(DEFAULT_LEVELS, start=1):
                cur.execute(
                    """
                    INSERT INTO alert_levels (alert_rule_id, level_order, max_prevalence, classification, message, summary)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (rule_id, order, threshold, classification, message, summary),
                )
    audit(user, "threshold_created", "alert_rule", rule_id, {"rule": f"{gene} {mutation}", "copied_from": "general rule" if base else "defaults"}, client_ip(request))
    return {"id": rule_id}


@router.delete("/api/admin/alerts/{rule_id}")
def delete_alert(rule_id: int, request: Request, user=Depends(current_user)):
    rule = query_one("SELECT * FROM alert_rules WHERE id = %s", (rule_id,))
    if not rule:
        raise HTTPException(404, "Rule not found")
    if rule["mutation_pattern"] == "*":
        raise HTTPException(400, "The general rule of a gene cannot be removed")
    levels = query("SELECT * FROM alert_levels WHERE alert_rule_id = %s ORDER BY level_order", (rule_id,))
    with transaction() as cur:
        cur.execute("DELETE FROM alert_rules WHERE id = %s", (rule_id,))
    audit(user, "threshold_removed", "alert_rule", rule_id, {"rule": f"{rule['gene']} {rule['mutation_pattern']}", "before": {"rule": rule, "levels": levels}}, client_ip(request))
    return {"ok": True}


@router.put("/api/admin/alerts/{rule_id}")
def update_alert(rule_id: int, body: RuleBody, request: Request, user=Depends(current_user)):
    rule = query_one("SELECT * FROM alert_rules WHERE id = %s", (rule_id,))
    if not rule:
        raise HTTPException(404, "Rule not found")
    before_levels = query("SELECT * FROM alert_levels WHERE alert_rule_id = %s ORDER BY level_order", (rule_id,))
    ids = {l["id"] for l in before_levels}
    if body.who_status is not None and body.who_status not in ("validated", "candidate", "none"):
        raise HTTPException(400, "WHO status must be validated, candidate or none")
    previous = -1.0
    for level in sorted(body.levels, key=lambda l: next((b["level_order"] for b in before_levels if b["id"] == l.id), 0)):
        if level.id not in ids:
            raise HTTPException(400, "Unknown level")
        if level.classification not in ("low", "intermediate", "high"):
            raise HTTPException(400, "Classification must be low, intermediate or high")
        if not 0 <= level.max_prevalence <= 1:
            raise HTTPException(400, "Thresholds must be between 0 and 1")
        if level.max_prevalence <= previous:
            raise HTTPException(400, "Thresholds must increase from one level to the next")
        previous = level.max_prevalence
    with transaction() as cur:
        cur.execute(
            "UPDATE alert_rules SET antimalarial = %s, reference_text = %s, who_status = %s WHERE id = %s",
            (body.antimalarial, body.reference_text, body.who_status or rule["who_status"], rule_id),
        )
        for level in body.levels:
            cur.execute(
                """
                UPDATE alert_levels SET max_prevalence = %s, classification = %s, message = %s, summary = %s, guideline = %s
                WHERE id = %s AND alert_rule_id = %s
                """,
                (level.max_prevalence, level.classification, level.message, level.summary, level.guideline, level.id, rule_id),
            )
    audit(
        user,
        "threshold_updated",
        "alert_rule",
        rule_id,
        {
            "rule": f"{rule['gene']} {rule['mutation_pattern']}",
            "before": {"antimalarial": rule["antimalarial"], "who_status": rule["who_status"], "levels": before_levels},
            "after": body.model_dump(),
        },
        client_ip(request),
    )
    return {"ok": True}


@router.put("/api/admin/settings")
def update_settings(body: dict[str, Any], request: Request, user=Depends(current_user)):
    current = load_settings()
    changed = {}
    for key, value in body.items():
        expected = SETTING_KEYS.get(key)
        if expected is None:
            raise HTTPException(400, f"Unknown setting {key}")
        if not isinstance(value, expected) or isinstance(value, bool):
            raise HTTPException(400, f"Invalid value for {key}")
        if key in SIZE_LIMITS:
            low, high = SIZE_LIMITS[key]
            if not low <= float(value) <= high:
                raise HTTPException(400, f"{key} must be between {low} and {high}")
        elif key == "site.default_year":
            if value != "auto" and not (isinstance(value, int) and 1980 <= value <= datetime.now().year + 1):
                raise HTTPException(400, "Default year must be auto or a valid year")
        elif key in ("site.github_url", "site.website_url", "site.linkedin_url", "site.public_url"):
            if value and (not re.match(r"^https://\S+$", value) or any(ch in value for ch in "<>'\"")):
                raise HTTPException(400, "Links must start with https://")
        elif key == "nav.hidden":
            if any(not isinstance(v, str) or v not in NAV_TABS for v in value):
                raise HTTPException(400, "Unknown menu tab")
        elif key == "hero.mode":
            if value not in HERO_MODES:
                raise HTTPException(400, "Banner style must be gradient, color, image or video")
        elif key == "hero.media_url":
            if value and not re.match(r"^/api/media/[A-Za-z0-9_.-]+$", value):
                raise HTTPException(400, "Upload the image or video from the settings page")
        elif (key.startswith("theme.") or key == "hero.color") and not COLOR_PATTERN.match(str(value)):
            raise HTTPException(400, f"{key} must be a colour like #2a78d6")
        if current.get(key) != value:
            changed[key] = {"before": current.get(key), "after": value}
    with transaction() as cur:
        for key in changed:
            cur.execute(
                """
                INSERT INTO site_settings (setting_key, setting_value, updated_by) VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)
                """,
                (key, json.dumps(body[key]), user["id"]),
            )
    if changed:
        audit(user, "settings_updated", "settings", None, changed, client_ip(request))
    return load_settings()


@router.post("/api/admin/media")
async def upload_media(request: Request, file: UploadFile = File(...), user=Depends(current_user)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in MEDIA_TYPES:
        raise HTTPException(400, "Use a JPG, PNG or WebP image, or an MP4 or WebM video")
    kind, max_mb = MEDIA_TYPES[ext]
    content = await file.read()
    if len(content) > max_mb * 1024 * 1024:
        raise HTTPException(413, f"{kind.title()} files must be under {max_mb} MB")
    original = len(content)
    if kind == "image":
        content, ext = prepare_image(content)
    os.makedirs(MEDIA_DIR, exist_ok=True)
    name = f"{kind}_{uuid.uuid4().hex[:12]}{ext}"
    with open(os.path.join(MEDIA_DIR, name), "wb") as f:
        f.write(content)
    audit(user, "media_uploaded", "media", name, {"filename": file.filename, "bytes": len(content), "original_bytes": original}, client_ip(request))
    return {"url": f"/api/media/{name}", "kind": kind}

class TeamBody(BaseModel):
    name: str
    title: Optional[str] = None
    affiliation: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    is_lead: bool = False
    sort_order: int = 0


def _clean_team(body: TeamBody):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    photo = (body.photo_url or "").strip() or None
    if photo and not re.match(r"^/(api/media|team)/[A-Za-z0-9_.-]+$", photo):
        raise HTTPException(400, "Upload the photo from the team page")
    email = (body.email or "").strip() or None
    if email and "@" not in email:
        raise HTTPException(400, "Invalid email")
    linkedin = (body.linkedin_url or "").strip() or None
    if linkedin and not re.match(r"^https://([a-z]{2,3}\.)?linkedin\.com/[A-Za-z0-9_/%.-]+$", linkedin):
        raise HTTPException(400, "The LinkedIn link must look like https://www.linkedin.com/in/your-name")
    return (name, (body.title or "").strip() or None, (body.affiliation or "").strip() or None,
            (body.bio or "").strip() or None, photo, email, linkedin, 1 if body.is_lead else 0, body.sort_order)


@router.get("/api/admin/team")
def admin_team(user=Depends(current_user)):
    return query("SELECT * FROM team_members ORDER BY is_deleted, is_hidden, is_alumni, is_lead DESC, sort_order, name")


@router.post("/api/admin/team")
def create_member(body: TeamBody, request: Request, user=Depends(current_user)):
    values = _clean_team(body)
    new_id, _ = execute(
        """
        INSERT INTO team_members (name, title, affiliation, bio, photo_url, email, linkedin_url, is_lead, sort_order)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        values,
    )
    audit(user, "team_member_added", "team_member", new_id, {"name": values[0]}, client_ip(request))
    return {"id": new_id}


@router.put("/api/admin/team/{member_id}")
def update_member(member_id: int, body: TeamBody, request: Request, user=Depends(current_user)):
    before = query_one("SELECT * FROM team_members WHERE id = %s", (member_id,))
    if not before:
        raise HTTPException(404, "Member not found")
    values = _clean_team(body)
    execute(
        """
        UPDATE team_members SET name = %s, title = %s, affiliation = %s, bio = %s, photo_url = %s,
               email = %s, linkedin_url = %s, is_lead = %s, sort_order = %s
        WHERE id = %s
        """,
        (*values, member_id),
    )
    audit(user, "team_member_updated", "team_member", member_id, {"before": before, "after": body.model_dump()}, client_ip(request))
    return {"ok": True}


class TeamOrderBody(BaseModel):
    ids: list[int]


@router.post("/api/admin/team/reorder")
def reorder_team(body: TeamOrderBody, request: Request, user=Depends(current_user)):
    known = {r["id"] for r in query("SELECT id FROM team_members")}
    if not body.ids or len(set(body.ids)) != len(body.ids) or not set(body.ids) <= known:
        raise HTTPException(400, "Unknown or duplicated member in the new order")
    with transaction() as cur:
        for position, member_id in enumerate(body.ids, start=1):
            cur.execute("UPDATE team_members SET sort_order = %s WHERE id = %s", (position, member_id))
    audit(user, "team_reordered", "team_member", None, {"order": body.ids}, client_ip(request))
    return {"ok": True}


@router.post("/api/admin/team/{member_id}/alumni")
def member_to_alumni(member_id: int, request: Request, user=Depends(current_user)):
    return _set_alumni(member_id, 1, user, request)


@router.post("/api/admin/team/{member_id}/active")
def member_back_to_team(member_id: int, request: Request, user=Depends(current_user)):
    return _set_alumni(member_id, 0, user, request)


def _set_alumni(member_id, value, user, request):
    member = query_one("SELECT id, name, is_lead, is_deleted FROM team_members WHERE id = %s", (member_id,))
    if not member:
        raise HTTPException(404, "Member not found")
    if member["is_deleted"]:
        raise HTTPException(400, "Restore this member first")
    if value and member["is_lead"]:
        raise HTTPException(400, "The lab lead cannot be moved to alumni. Choose another lab lead first.")
    execute("UPDATE team_members SET is_alumni = %s, is_hidden = 0 WHERE id = %s", (value, member_id))
    audit(user, "team_member_to_alumni" if value else "team_member_back_to_team", "team_member", member_id, {"name": member["name"]}, client_ip(request))
    return {"ok": True}


@router.post("/api/admin/team/{member_id}/hide")
def hide_member(member_id: int, request: Request, user=Depends(current_user)):
    _, count = execute("UPDATE team_members SET is_hidden = 1 WHERE id = %s", (member_id,))
    if not count and not query_one("SELECT id FROM team_members WHERE id = %s", (member_id,)):
        raise HTTPException(404, "Member not found")
    audit(user, "team_member_removed", "team_member", member_id, None, client_ip(request))
    return {"ok": True}


@router.post("/api/admin/team/{member_id}/restore")
def restore_member(member_id: int, request: Request, user=Depends(current_user)):
    member = query_one("SELECT is_deleted FROM team_members WHERE id = %s", (member_id,))
    if not member:
        raise HTTPException(404, "Member not found")
    if member["is_deleted"] and user["role"] != "super_admin":
        raise HTTPException(403, "Only a super admin can restore a deleted member")
    execute("UPDATE team_members SET is_hidden = 0, is_deleted = 0, deleted_at = NULL WHERE id = %s", (member_id,))
    audit(user, "team_member_restored", "team_member", member_id, None, client_ip(request))
    return {"ok": True}


@router.delete("/api/admin/team/{member_id}")
def delete_member(member_id: int, request: Request, user=Depends(super_admin)):
    before = query_one("SELECT * FROM team_members WHERE id = %s", (member_id,))
    if not before:
        raise HTTPException(404, "Member not found")
    if not before["is_hidden"]:
        raise HTTPException(400, "Remove the member from the Team page first")
    execute("UPDATE team_members SET is_deleted = 1, deleted_at = NOW() WHERE id = %s", (member_id,))
    audit(user, "team_member_deleted", "team_member", member_id, {"before": before}, client_ip(request))
    return {"ok": True}