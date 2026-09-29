# Author: Khadim Gueye

import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from db import execute, query_one

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-only-secret-change-me-in-production")
JWT_ALGORITHM = "HS256"
TOKEN_HOURS = int(os.environ.get("TOKEN_HOURS", "8"))
MAX_FAILED_ATTEMPTS = 5
LOCK_MINUTES = 15

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def password_problem(password: str):
    if len(password) < 8:
        return "Password must have at least 8 characters."
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        return "Password must contain letters and numbers."
    return None


def temporary_password() -> str:
    return secrets.token_urlsafe(9)


def create_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": expires}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "is_owner": bool(user["is_owner"]),
        "must_change_password": bool(user["must_change_password"]),
    }


TRUST_PROXY = os.environ.get("TRUST_PROXY", "0") == "1"


def client_ip(request: Request):
    if TRUST_PROXY:
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        real = forwarded or request.headers.get("x-real-ip", "").strip()
        if real:
            return real[:45]
    return request.client.host if request.client else None


def audit(user, action, entity=None, entity_id=None, details=None, ip=None):
    execute(
        """
        INSERT INTO audit_log (user_id, user_email, action, entity, entity_id, details, ip_address)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (
            user["id"] if user else None,
            user["email"] if user else None,
            action,
            entity,
            str(entity_id) if entity_id is not None else None,
            json.dumps(details, default=str) if details is not None else None,
            ip,
        ),
    )


def _load_user(credentials: HTTPAuthorizationCredentials | None):
    if credentials is None:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(401, "Session expired, please sign in again")
    user = query_one("SELECT * FROM admin_users WHERE id = %s", (user_id,))
    if not user or not user["is_active"]:
        raise HTTPException(401, "Account disabled")
    return user


def current_user_allow_password_change(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    return _load_user(credentials)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    user = _load_user(credentials)
    if user["must_change_password"]:
        raise HTTPException(403, "password_change_required")
    return user


def super_admin(user=Depends(current_user)):
    if user["role"] != "super_admin":
        raise HTTPException(403, "Super admin only")
    return user
