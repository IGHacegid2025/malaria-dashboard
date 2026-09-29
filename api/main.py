#!/usr/bin/env python3
# Author: Khadim Gueye

import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from admin_routes import MEDIA_DIR, load_settings, router as admin_router
from audience_routes import router as audience_router
from genomics_routes import router as genomics_router
from partners_routes import router as partners_router
from db import query

app = FastAPI(title="Malaria Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(audience_router)
app.include_router(genomics_router)
app.include_router(partners_router)
os.makedirs(MEDIA_DIR, exist_ok=True)
app.mount("/api/media", StaticFiles(directory=MEDIA_DIR), name="media")

VISIBLE_PUBLICATION = "(p.id IS NULL OR p.is_hidden = 0)"


def add_filters(sql, params, filters):
    for clause, value in filters:
        if value is not None and value != "":
            sql += f" AND {clause}"
            params.append(value)
    return sql


@app.get("/api/health")
def health():
    query("SELECT 1")
    return {"status": "ok"}


@app.get("/api/settings")
def settings():
    return load_settings()


@app.get("/api/states")
def list_states():
    return query("SELECT code, name FROM states ORDER BY name")


@app.get("/api/genes")
def list_genes():
    return query("SELECT id, name FROM genes ORDER BY name")


@app.get("/api/mutations")
def list_mutations(gene: Optional[str] = None):
    params = []
    sql = """
        SELECT m.id, m.mutation_code, g.name AS gene
        FROM mutations m
        JOIN genes g ON g.id = m.gene_id
        WHERE 1 = 1
    """
    sql = add_filters(sql, params, [("g.name = %s", gene)])
    sql += " ORDER BY g.name, m.mutation_code"
    return query(sql, params)


@app.get("/api/observations")
def list_observations(
    state: Optional[str] = None,
    gene: Optional[str] = None,
    mutation: Optional[str] = None,
    year: Optional[int] = None,
):
    params = []
    sql = f"""
        SELECT
            s.code AS state,
            s.name AS state_name,
            o.year,
            g.name AS gene,
            m.mutation_code AS mutation,
            o.prevalence,
            o.sample_count,
            o.source_type,
            o.city,
            p.author,
            p.year_of_publication,
            p.doi
        FROM observations o
        JOIN states s ON s.id = o.state_id
        JOIN mutations m ON m.id = o.mutation_id
        JOIN genes g ON g.id = m.gene_id
        LEFT JOIN publications p ON p.id = o.publication_id
        WHERE o.is_hidden = 0 AND {VISIBLE_PUBLICATION}
    """
    sql = add_filters(sql, params, [
        ("s.code = %s", state),
        ("g.name = %s", gene),
        ("m.mutation_code = %s", mutation),
        ("o.year = %s", year),
    ])
    sql += " ORDER BY o.year, s.name, o.prevalence DESC"
    return query(sql, params)


@app.get("/api/mutation-timeline")
def mutation_timeline(gene: str, mutation: str, state: Optional[str] = None):
    params = [gene, mutation]
    sql = f"""
        SELECT s.code AS state, s.name AS state_name, o.year, o.prevalence, o.sample_count, o.source_type
        FROM observations o
        JOIN states s ON s.id = o.state_id
        JOIN mutations m ON m.id = o.mutation_id
        JOIN genes g ON g.id = m.gene_id
        LEFT JOIN publications p ON p.id = o.publication_id
        WHERE g.name = %s AND m.mutation_code = %s AND o.is_hidden = 0 AND {VISIBLE_PUBLICATION}
    """
    sql = add_filters(sql, params, [("s.code = %s", state)])
    sql += " ORDER BY o.year"
    return query(sql, params)


@app.get("/api/species")
def list_species(state: Optional[str] = None, year: Optional[int] = None):
    params = []
    sql = f"""
        SELECT s.code AS state, s.name AS state_name, so.year, so.species_combination,
               so.sample_count, so.source_type
        FROM species_observations so
        JOIN states s ON s.id = so.state_id
        LEFT JOIN publications p ON p.id = so.publication_id
        WHERE so.is_hidden = 0 AND {VISIBLE_PUBLICATION}
    """
    sql = add_filters(sql, params, [("s.code = %s", state), ("so.year = %s", year)])
    sql += " ORDER BY so.year, s.name, so.sample_count DESC"
    return query(sql, params)


@app.get("/api/hrp-deletions")
def list_hrp_deletions(state: Optional[str] = None, year: Optional[int] = None):
    params = []
    sql = f"""
        SELECT s.code AS state, s.name AS state_name, h.year, h.deletion_type, h.any_hrp_mutation,
               h.location, h.sample_count, h.source_type, p.author, p.year_of_publication
        FROM hrp_deletions h
        JOIN states s ON s.id = h.state_id
        LEFT JOIN publications p ON p.id = h.publication_id
        WHERE h.is_hidden = 0 AND {VISIBLE_PUBLICATION}
    """
    sql = add_filters(sql, params, [("s.code = %s", state), ("h.year = %s", year)])
    sql += " ORDER BY h.year, s.name"
    return query(sql, params)


@app.get("/api/mis-cases")
def list_mis_cases(year: Optional[int] = None):
    params = []
    sql = """
        SELECT s.code AS state, s.name AS state_name, mp.year, mp.prevalence
        FROM mis_prevalence mp
        JOIN states s ON s.id = mp.state_id
        WHERE mp.is_hidden = 0
          AND mp.id = (
            SELECT MAX(x.id) FROM mis_prevalence x
            WHERE x.state_id = mp.state_id AND x.year = mp.year AND x.is_hidden = 0
          )
    """
    sql = add_filters(sql, params, [("mp.year = %s", year)])
    sql += " ORDER BY mp.prevalence DESC"
    return query(sql, params)


@app.get("/api/moi")
def list_moi(state: Optional[str] = None, year: Optional[int] = None):
    params = []
    sql = """
        SELECT s.code AS state, s.name AS state_name, sb.year, md.moi_value, SUM(md.sample_count) AS sample_count
        FROM moi_distribution md
        JOIN sequencing_batches sb ON sb.id = md.sequencing_batch_id
        JOIN states s ON s.id = sb.state_id
        WHERE md.is_hidden = 0
    """
    sql = add_filters(sql, params, [("s.code = %s", state), ("sb.year = %s", year)])
    sql += " GROUP BY s.code, s.name, sb.year, md.moi_value ORDER BY sb.year, s.name, md.moi_value"
    return query(sql, params)


@app.get("/api/publications")
def list_publications():
    return query(
        """
        SELECT p.id, p.author, p.year_of_publication, p.doi, p.title,
               COUNT(o.id) AS observation_count
        FROM publications p
        LEFT JOIN observations o ON o.publication_id = p.id AND o.is_hidden = 0
        WHERE p.is_hidden = 0
        GROUP BY p.id
        ORDER BY p.year_of_publication DESC, p.author
        """
    )


@app.get("/api/alerts")
def list_alerts():
    rules = query(
        """
        SELECT id, gene, mutation_pattern, who_status, antimalarial, resistance_level, reference_text
        FROM alert_rules
        ORDER BY gene, mutation_pattern
        """
    )
    levels = query(
        """
        SELECT alert_rule_id, level_order, max_prevalence, classification, message, summary
        FROM alert_levels
        ORDER BY alert_rule_id, level_order
        """
    )
    by_rule = {}
    for level in levels:
        by_rule.setdefault(level.pop("alert_rule_id"), []).append(level)
    for rule in rules:
        rule["levels"] = by_rule.get(rule["id"], [])
    return rules


@app.get("/api/team")
def list_team():
    return query(
        """
        SELECT id, name, title, affiliation, bio, photo_url, email, linkedin_url, is_lead, is_alumni
        FROM team_members WHERE is_hidden = 0 AND is_deleted = 0
        ORDER BY is_alumni, is_lead DESC, sort_order, name
        """
    )


@app.get("/api/years")
def list_years():
    return query(
        f"""
        SELECT DISTINCT o.year FROM observations o
        LEFT JOIN publications p ON p.id = o.publication_id
        WHERE o.is_hidden = 0 AND {VISIBLE_PUBLICATION}
        ORDER BY o.year
        """
    )


FRONTEND_DIR = os.path.realpath(
    os.environ.get("FRONTEND_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist"))
)
INDEX_FILE = os.path.join(FRONTEND_DIR, "index.html")

if os.path.isfile(INDEX_FILE):

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        target = os.path.realpath(os.path.join(FRONTEND_DIR, path))
        if path and target.startswith(FRONTEND_DIR + os.sep) and os.path.isfile(target):
            return FileResponse(target)
        if "." in path.rsplit("/", 1)[-1]:
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(INDEX_FILE, headers={"Cache-Control": "no-cache"})
