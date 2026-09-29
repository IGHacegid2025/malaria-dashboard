# Author: Khadim Gueye

import os
from contextlib import contextmanager

import pymysql
import pymysql.cursors

import config  # noqa: F401

CONN_INFO = dict(
    host=os.environ.get("DB_HOST", "127.0.0.1"),
    port=int(os.environ.get("DB_PORT", "3306")),
    database=os.environ.get("DB_NAME", "malaria_dashboard"),
    user=os.environ.get("DB_USER", "malaria_app"),
    password=os.environ.get("DB_PASSWORD", "malaria_pass_2026"),
    charset="utf8mb4",
    cursorclass=pymysql.cursors.DictCursor,
)


def connect():
    return pymysql.connect(**CONN_INFO)


def query(sql, params=None):
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            return list(cur.fetchall())
    finally:
        conn.close()


def query_one(sql, params=None):
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql, params=None):
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            conn.commit()
            return cur.lastrowid, cur.rowcount
    finally:
        conn.close()


@contextmanager
def transaction():
    conn = connect()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
