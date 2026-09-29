# Visitor tracking, PDF report requests and lab activities
# Author: Khadim Gueye

import csv
import hashlib
import io
import re
import threading
import time
from collections import defaultdict, deque
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

import geo_lookup
from db import execute, query, query_one, transaction
from security import JWT_SECRET, audit, client_ip, current_user, super_admin

router = APIRouter()

BOTS = re.compile(r"bot|crawl|spider|slurp|preview|headless|monitor|curl|wget|python-requests|httpx", re.I)
EMAIL = re.compile(r"^[^@\s<>]+@[^@\s<>]+\.[A-Za-z]{2,}$")
IMAGE = re.compile(r"^/(api/media|home|team)/[A-Za-z0-9_.-]+$")

_hits = defaultdict(deque)
_hits_lock = threading.Lock()


def too_many(bucket, limit, seconds):
    now = time.monotonic()
    with _hits_lock:
        hits = _hits[bucket]
        while hits and hits[0] < now - seconds:
            hits.popleft()
        if len(hits) >= limit:
            return True
        hits.append(now)
        if len(_hits) > 20000:
            _hits.clear()
    return False


def device_of(user_agent):
    ua = user_agent.lower()
    if "ipad" in ua or "tablet" in ua:
        return "tablet"
    if "mobi" in ua or "android" in ua or "iphone" in ua:
        return "mobile"
    return "desktop"


def clip(value, size):
    value = (value or "").strip()
    return value[:size] or None


class VisitBody(BaseModel):
    visitor_id: str
    path: str
    referrer: Optional[str] = None


@router.post("/api/track", status_code=204)
def track(body: VisitBody, request: Request):
    user_agent = request.headers.get("user-agent", "")
    ip = client_ip(request) or ""
    path = body.path.split("#")[0][:255]
    if (BOTS.search(user_agent) or not re.match(r"^[A-Za-z0-9-]{8,64}$", body.visitor_id)
            or not path.startswith("/") or path.startswith("/admin") or too_many(f"visit:{ip}", 60, 60)):
        return Response(status_code=204)
    recent = query_one(
        "SELECT id FROM site_visits WHERE visitor_id = %s AND path = %s AND created_at > NOW() - INTERVAL 10 MINUTE LIMIT 1",
        (body.visitor_id, path),
    )
    if recent:
        return Response(status_code=204)
    geo = geo_lookup.lookup(ip)
    referrer = clip(body.referrer, 255)
    if referrer and request.headers.get("host", "") in referrer:
        referrer = None
    execute(
        """
        INSERT INTO site_visits (visitor_id, ip_hash, country_code, region, city, latitude, longitude, path, referrer, device)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (body.visitor_id, hashlib.sha256(f"{JWT_SECRET}:{ip}".encode()).hexdigest(), geo["country_code"],
         clip(geo["region"], 120), clip(geo["city"], 160), geo["latitude"], geo["longitude"], path, referrer,
         device_of(user_agent)),
    )
    return Response(status_code=204)


class ReportRequest(BaseModel):
    name: str
    email: str
    organization: Optional[str] = None
    page: Optional[str] = None


@router.post("/api/report-requests")
def report_request(body: ReportRequest, request: Request):
    name = body.name.strip()
    email = body.email.strip().lower()
    if len(name) < 2 or len(name) > 160:
        raise HTTPException(400, "Please enter your full name")
    if len(email) > 200 or not EMAIL.match(email):
        raise HTTPException(400, "Please enter a valid email address")
    ip = client_ip(request) or ""
    if too_many(f"report:{ip}", 30, 3600):
        raise HTTPException(429, "Too many downloads from this network. Please try again later.")
    geo = geo_lookup.lookup(ip)
    execute(
        """
        INSERT INTO report_downloads (name, email, organization, ip_address, country_code, region, city,
                                      latitude, longitude, page, user_agent)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (name, email, clip(body.organization, 200), ip[:45] or None, geo["country_code"], clip(geo["region"], 120),
         clip(geo["city"], 160), geo["latitude"], geo["longitude"], clip(body.page, 255),
         clip(request.headers.get("user-agent"), 400)),
    )
    return {"ok": True}


@router.get("/api/admin/visitors")
def visitors(days: int = 7, user=Depends(current_user)):
    days = max(1, min(days, 365))
    window = "created_at >= CURDATE() - INTERVAL %s DAY"
    today = query_one(
        "SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors FROM site_visits WHERE created_at >= CURDATE()"
    )
    total = query_one(
        f"""
        SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors,
               COUNT(DISTINCT CASE WHEN country_code <> 'LOCAL' THEN country_code END) AS countries
        FROM site_visits WHERE {window}
        """,
        (days - 1,),
    )
    online = query_one(
        "SELECT COUNT(DISTINCT visitor_id) AS n FROM site_visits WHERE created_at > NOW() - INTERVAL 5 MINUTE"
    )["n"]
    points = query(
        f"""
        SELECT ROUND(latitude, 2) AS lat, ROUND(longitude, 2) AS lon, MAX(city) AS city, MAX(region) AS region,
               MAX(country_code) AS country_code, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors,
               MAX(created_at) AS last_visit
        FROM site_visits WHERE {window} AND latitude IS NOT NULL
        GROUP BY ROUND(latitude, 2), ROUND(longitude, 2)
        ORDER BY visits DESC LIMIT 2000
        """,
        (days - 1,),
    )
    countries = query(
        f"""
        SELECT COALESCE(country_code, 'UNKNOWN') AS country_code, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors
        FROM site_visits WHERE {window}
        GROUP BY COALESCE(country_code, 'UNKNOWN') ORDER BY visits DESC LIMIT 12
        """,
        (days - 1,),
    )
    pages = query(
        f"""
        SELECT SUBSTRING_INDEX(path, '?', 1) AS path, COUNT(*) AS visits
        FROM site_visits WHERE {window}
        GROUP BY SUBSTRING_INDEX(path, '?', 1) ORDER BY visits DESC LIMIT 10
        """,
        (days - 1,),
    )
    devices = query(
        f"SELECT device, COUNT(*) AS visits FROM site_visits WHERE {window} GROUP BY device ORDER BY visits DESC",
        (days - 1,),
    )
    daily = query(
        f"""
        SELECT DATE(created_at) AS day, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors
        FROM site_visits WHERE {window} GROUP BY DATE(created_at) ORDER BY day
        """,
        (days - 1,),
    )
    recent = query(
        """
        SELECT created_at, LEFT(visitor_id, 8) AS visitor, country_code, region, city, path, device, referrer
        FROM site_visits ORDER BY id DESC LIMIT 100
        """
    )
    return {
        "days": days,
        "today": today,
        "total": total,
        "online": online,
        "points": points,
        "countries": countries,
        "pages": pages,
        "devices": devices,
        "daily": daily,
        "recent": recent,
        "geo_ready": geo_lookup.available(),
    }


def _downloads(search):
    sql = "SELECT * FROM report_downloads WHERE 1 = 1"
    params = []
    if search:
        like = f"%{search.strip()}%"
        sql += " AND (name LIKE %s OR email LIKE %s OR organization LIKE %s OR country_code LIKE %s OR city LIKE %s)"
        params += [like] * 5
    return sql, params


@router.get("/api/admin/report-downloads")
def report_downloads(search: Optional[str] = None, limit: int = 50, offset: int = 0, user=Depends(current_user)):
    sql, params = _downloads(search)
    total = query_one(sql.replace("SELECT *", "SELECT COUNT(*) AS n", 1), params)["n"]
    rows = query(sql + " ORDER BY id DESC LIMIT %s OFFSET %s", [*params, max(1, min(limit, 200)), max(0, offset)])
    stats = query_one(
        """
        SELECT COUNT(*) AS downloads, COUNT(DISTINCT email) AS people,
               COUNT(DISTINCT CASE WHEN country_code <> 'LOCAL' THEN country_code END) AS countries,
               SUM(created_at >= CURDATE() - INTERVAL 29 DAY) AS last_30_days
        FROM report_downloads
        """
    )
    countries = query(
        """
        SELECT COALESCE(country_code, 'UNKNOWN') AS country_code, COUNT(*) AS downloads
        FROM report_downloads GROUP BY COALESCE(country_code, 'UNKNOWN') ORDER BY downloads DESC LIMIT 8
        """
    )
    return {"total": total, "rows": rows, "stats": stats, "countries": countries}


@router.get("/api/admin/report-downloads.csv")
def report_downloads_csv(request: Request, search: Optional[str] = None, user=Depends(current_user)):
    sql, params = _downloads(search)
    rows = query(sql + " ORDER BY id DESC", params)
    out = io.StringIO()
    writer = csv.writer(out)
    columns = ["created_at", "name", "email", "organization", "country_code", "region", "city", "ip_address", "page"]
    writer.writerow(columns)
    for r in rows:
        writer.writerow([r[c] if r[c] is not None else "" for c in columns])
    audit(user, "report_downloads_exported", "report_downloads", None, {"rows": len(rows)}, client_ip(request))
    return Response(
        "﻿" + out.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="report_downloads_{date.today()}.csv"'},
    )


class ActivityBody(BaseModel):
    title: str
    category: Optional[str] = None
    description: Optional[str] = None
    activity_date: Optional[date] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    is_featured: bool = False
    sort_order: int = 0


def _clean_activity(body: ActivityBody):
    title = body.title.strip()
    if not title:
        raise HTTPException(400, "Title is required")
    image = (body.image_url or "").strip() or None
    if image and not IMAGE.match(image):
        raise HTTPException(400, "Upload the photo from the activities page")
    link = (body.link_url or "").strip() or None
    if link and (not re.match(r"^https://\S+$", link) or any(c in link for c in "\"'<>")):
        raise HTTPException(400, "The link must start with https://")
    return (title[:255], clip(body.category, 80), (body.description or "").strip() or None, body.activity_date,
            image, link, 1 if body.is_featured else 0, body.sort_order)


PUBLIC_ACTIVITY = "id, title, category, description, activity_date, image_url, link_url, is_featured"


@router.get("/api/activities")
def list_activities():
    return query(
        f"SELECT {PUBLIC_ACTIVITY} FROM lab_activities WHERE is_hidden = 0 AND is_deleted = 0 "
        "ORDER BY sort_order, activity_date DESC, id DESC"
    )


@router.get("/api/admin/activities")
def admin_activities(user=Depends(current_user)):
    return query("SELECT * FROM lab_activities ORDER BY is_deleted, is_hidden, sort_order, activity_date DESC, id DESC")


@router.post("/api/admin/activities")
def create_activity(body: ActivityBody, request: Request, user=Depends(current_user)):
    values = _clean_activity(body)
    new_id, _ = execute(
        """
        INSERT INTO lab_activities (title, category, description, activity_date, image_url, link_url, is_featured,
                                    sort_order, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (*values, user["id"]),
    )
    audit(user, "activity_added", "activity", new_id, {"title": values[0]}, client_ip(request))
    return {"id": new_id}


@router.put("/api/admin/activities/{activity_id}")
def update_activity(activity_id: int, body: ActivityBody, request: Request, user=Depends(current_user)):
    before = query_one("SELECT * FROM lab_activities WHERE id = %s", (activity_id,))
    if not before:
        raise HTTPException(404, "Activity not found")
    execute(
        """
        UPDATE lab_activities SET title = %s, category = %s, description = %s, activity_date = %s, image_url = %s,
               link_url = %s, is_featured = %s, sort_order = %s
        WHERE id = %s
        """,
        (*_clean_activity(body), activity_id),
    )
    audit(user, "activity_updated", "activity", activity_id, {"before": before, "after": body.model_dump()}, client_ip(request))
    return {"ok": True}


class ActivityOrderBody(BaseModel):
    ids: list[int]


@router.post("/api/admin/activities/reorder")
def reorder_activities(body: ActivityOrderBody, request: Request, user=Depends(current_user)):
    known = {r["id"] for r in query("SELECT id FROM lab_activities")}
    if not body.ids or len(set(body.ids)) != len(body.ids) or not set(body.ids) <= known:
        raise HTTPException(400, "Unknown or duplicated activity in the new order")
    with transaction() as cur:
        for position, activity_id in enumerate(body.ids, start=1):
            cur.execute("UPDATE lab_activities SET sort_order = %s WHERE id = %s", (position, activity_id))
    audit(user, "activities_reordered", "activity", None, {"order": body.ids}, client_ip(request))
    return {"ok": True}


@router.post("/api/admin/activities/{activity_id}/hide")
def hide_activity(activity_id: int, request: Request, user=Depends(current_user)):
    if not query_one("SELECT id FROM lab_activities WHERE id = %s", (activity_id,)):
        raise HTTPException(404, "Activity not found")
    execute("UPDATE lab_activities SET is_hidden = 1 WHERE id = %s", (activity_id,))
    audit(user, "activity_removed", "activity", activity_id, None, client_ip(request))
    return {"ok": True}


@router.post("/api/admin/activities/{activity_id}/restore")
def restore_activity(activity_id: int, request: Request, user=Depends(current_user)):
    activity = query_one("SELECT is_deleted FROM lab_activities WHERE id = %s", (activity_id,))
    if not activity:
        raise HTTPException(404, "Activity not found")
    if activity["is_deleted"] and user["role"] != "super_admin":
        raise HTTPException(403, "Only a super admin can restore a deleted activity")
    execute("UPDATE lab_activities SET is_hidden = 0, is_deleted = 0, deleted_at = NULL WHERE id = %s", (activity_id,))
    audit(user, "activity_restored", "activity", activity_id, None, client_ip(request))
    return {"ok": True}


@router.delete("/api/admin/activities/{activity_id}")
def delete_activity(activity_id: int, request: Request, user=Depends(super_admin)):
    before = query_one("SELECT * FROM lab_activities WHERE id = %s", (activity_id,))
    if not before:
        raise HTTPException(404, "Activity not found")
    if not before["is_hidden"]:
        raise HTTPException(400, "Archive the activity first")
    execute("UPDATE lab_activities SET is_deleted = 1, deleted_at = NOW() WHERE id = %s", (activity_id,))
    audit(user, "activity_deleted", "activity", activity_id, {"before": before}, client_ip(request))
    return {"ok": True}
