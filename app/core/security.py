import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import text

from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ADMIN_SESSION_COOKIE_NAME, JWT_SECRET_KEY
from app.db.session import SessionLocal
from app.models.user_session import UserSession
from app.models.user import User

ALGORITHM = "HS256"
APP_SESSION_EPOCH = int(datetime.utcnow().timestamp())

# Use pbkdf2_sha256 for new hashes to avoid the broken bcrypt backend in the
# current runtime, while still verifying existing bcrypt hashes already stored.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def ensure_user_auth_schema(db) -> None:
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token_hash VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER",
    ]

    for statement in statements:
        try:
            db.execute(text(statement))
            db.commit()
        except Exception:
            db.rollback()


def get_password_hash(password: str):
    return pwd_context.hash(password)


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)


def create_session_id() -> str:
    return secrets.token_urlsafe(32)


def hash_session_id(session_id: str) -> str:
    return hashlib.sha256(session_id.encode("utf-8")).hexdigest()


def create_access_token(data: dict, expires_delta: timedelta | None = None, session_id: str | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.utcnow(),
            "session_epoch": APP_SESSION_EPOCH,
        }
    )
    if session_id:
        to_encode["sid"] = session_id
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)


def create_user_session(
    *,
    db,
    user_id: int,
    session_id: str,
    session_type: str = "web",
    user_agent: str | None = None,
    ip_address: str | None = None,
    expires_at: datetime | None = None,
) -> UserSession:
    session = UserSession(
        user_id=user_id,
        session_id_hash=hash_session_id(session_id),
        session_type=session_type,
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=expires_at or (datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)),
    )
    db.add(session)
    db.flush()
    return session


def get_user_from_token(token: str, db) -> User:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    except ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.") from exc
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    if payload.get("session_epoch") != APP_SESSION_EPOCH:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")

    session_id = payload.get("sid")
    if session_id:
        session = (
            db.query(UserSession)
            .filter(UserSession.session_id_hash == hash_session_id(str(session_id)))
            .first()
        )
        if not session or session.revoked_at is not None or session.expires_at < datetime.utcnow():
            raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
        session.last_seen_at = datetime.utcnow()
        db.commit()

    ensure_user_auth_schema(db)
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def get_current_user(token: str = Depends(oauth2_scheme)):
    db = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
        if role_value in {"admin", "super_admin"} and not user.admin_approved:
            raise HTTPException(status_code=403, detail="Admin account awaiting super admin approval")
        return user
    finally:
        db.close()


def require_role(required_role: str):
    def role_checker(current_user: User = Depends(get_current_user)):
        current_role = (
            current_user.role.value
            if hasattr(current_user.role, "value")
            else str(current_user.role)
        )
        if current_role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized for this action",
            )
        return current_user

    return role_checker


def require_any_role(*required_roles: str):
    normalized_roles = {str(role).strip().lower() for role in required_roles}

    def role_checker(current_user: User = Depends(get_current_user)):
        current_role = (
            current_user.role.value
            if hasattr(current_user.role, "value")
            else str(current_user.role)
        ).lower()
        if current_role not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized for this action",
            )
        return current_user

    return role_checker


def get_admin_user_from_cookie(
    admin_token: str | None = Cookie(default=None, alias=ADMIN_SESSION_COOKIE_NAME),
):
    if not admin_token:
        raise HTTPException(status_code=401, detail="Admin session required")

    db = SessionLocal()
    try:
        user = get_user_from_token(admin_token, db)
        role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
        if role_value not in {"admin", "super_admin"} or not user.admin_approved:
            raise HTTPException(status_code=403, detail="Admin access denied")
        return user
    finally:
        db.close()


def get_request_metadata(request: Request | None) -> tuple[str | None, str | None]:
    if not request:
        return None, None
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    client_ip = forwarded_for or (request.client.host if request.client else None)
    return request.headers.get("user-agent"), client_ip


