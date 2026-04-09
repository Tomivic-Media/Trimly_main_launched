import hashlib
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ADMIN_SESSION_COOKIE_NAME, PASSWORD_RESET_URL
from app.core.security import (
    create_session_id,
    create_user_session,
    create_access_token,
    ensure_user_auth_schema,
    get_current_user,
    get_request_metadata,
    get_password_hash,
    hash_password,
    require_role,
    verify_password,
)
from app.db.session import get_db
from app.models.user_session import UserSession
from app.models.user import User, UserRole
from app.schemas.user import (
    AdminAccountCreate,
    AdminApprovalUpdate,
    AdminUserResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    CurrentUserResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    UserProfileUpdateRequest,
    UserCreate,
    UserResponse,
)
from app.services.welcome_email_service import (
    send_barber_welcome_email,
    send_customer_welcome_email,
)
from app.utils.email import send_password_reset_email
from app.services.referral_service import generate_referral_code

router = APIRouter()

RESET_TOKEN_EXPIRY_MINUTES = 30
GENERIC_RESET_MESSAGE = "If an account exists for that email, a reset link has been sent."


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _password_matches(plain_password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    try:
        return bool(verify_password(plain_password, hashed_password))
    except Exception as exc:
        print(f"[auth] password verification failed for stored hash: {type(exc).__name__}: {exc}")
        return False


def _build_reset_link(token: str) -> str:
    query = urlencode({"token": token})
    separator = "&" if "?" in PASSWORD_RESET_URL else "?"
    return f"{PASSWORD_RESET_URL}{separator}{query}"


def _build_reset_preview_html(token: str) -> str:
    reset_link = _build_reset_link(token)
    return f"""
    <div style=\"background:#0b0f14;padding:32px 16px;font-family:Arial,sans-serif;color:#f5f7fa;\">
      <div style=\"max-width:560px;margin:0 auto;background:#131a22;border:1px solid #273140;border-radius:16px;padding:32px;\">
        <p style=\"margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#f59e0b;\">Trimly</p>
        <h1 style=\"margin:0 0 16px;font-size:28px;line-height:1.2;color:#ffffff;\">Reset your password</h1>
        <p style=\"margin:0 0 16px;font-size:15px;line-height:1.7;color:#c8d1dc;\">
          We received a request to reset your Trimly password. If you made this request, use the button below to set a new password.
        </p>
        <p style=\"margin:24px 0;\">
          <a href=\"{reset_link}\" style=\"display:inline-block;padding:14px 22px;border-radius:10px;background:#f59e0b;color:#111827;text-decoration:none;font-weight:700;\">Reset Password</a>
        </p>
        <p style=\"margin:0 0 12px;font-size:14px;line-height:1.7;color:#c8d1dc;\">
          This reset link will expire shortly for your security.
        </p>
        <p style=\"margin:0;font-size:13px;line-height:1.7;color:#94a3b8;word-break:break-all;\">
          If the button does not work, copy and paste this link into your browser:<br />
          <a href=\"{reset_link}\" style=\"color:#f8b84e;text-decoration:none;\">{reset_link}</a>
        </p>
      </div>
    </div>
    """.strip()


@router.post("/register", response_model=UserResponse)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    ensure_user_auth_schema(db)
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    if not user.accepted_terms:
        raise HTTPException(status_code=400, detail="You must accept the acceptable use policy")
    if user.role not in {UserRole.customer, UserRole.barber}:
        raise HTTPException(status_code=403, detail="Public registration is only available for customers and barbers")

    referred_by_user_id = None
    if user.referral_code:
        referrer = db.query(User).filter(User.referral_code == str(user.referral_code).strip().upper()).first()
        if not referrer:
            raise HTTPException(status_code=400, detail="Referral code is invalid")
        referred_by_user_id = referrer.id

    new_user = User(
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        hashed_password=hash_password(user.password),
        role=user.role,
        accepted_terms=True,
        admin_approved=False,
        referred_by_user_id=referred_by_user_id,
        referral_code=generate_referral_code(user.full_name),
        loyalty_points=0,
        referral_reward_granted=False,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    role_value = new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role)
    try:
        if role_value == "customer":
            await send_customer_welcome_email(new_user.email, new_user.full_name)
        elif role_value == "barber":
            await send_barber_welcome_email(new_user.email, new_user.full_name)
    except Exception as exc:
        print("Welcome email failed:", str(exc))

    return new_user


@router.post("/login", response_model=LoginResponse)
def login_user(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    ensure_user_auth_schema(db)
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not _password_matches(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    if role_value in {"admin", "super_admin"} and not user.admin_approved:
        raise HTTPException(status_code=403, detail="Admin account awaiting super admin approval")

    session_id = create_session_id()
    expires_at = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    user_agent, ip_address = get_request_metadata(request)
    create_user_session(
        db=db,
        user_id=user.id,
        session_id=session_id,
        session_type="web",
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=expires_at,
    )
    db.commit()

    access_token = create_access_token(data={"sub": user.email}, session_id=session_id)
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=CurrentUserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return CurrentUserResponse(
        logged_in_as=current_user.email,
        role=current_user.role,
        full_name=current_user.full_name,
        phone=current_user.phone,
        accepted_terms=current_user.accepted_terms,
        admin_approved=current_user.admin_approved,
        referral_code=current_user.referral_code,
        loyalty_points=int(current_user.loyalty_points or 0),
    )


@router.patch("/me/profile", response_model=CurrentUserResponse)
def update_current_user_profile(
    payload: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_user_auth_schema(db)
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    full_name = str(payload.full_name or "").strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")

    user.full_name = full_name
    user.phone = str(payload.phone or "").strip() or None
    db.commit()
    db.refresh(user)

    return CurrentUserResponse(
        logged_in_as=user.email,
        role=user.role,
        full_name=user.full_name,
        phone=user.phone,
        accepted_terms=user.accepted_terms,
        admin_approved=user.admin_approved,
        referral_code=user.referral_code,
        loyalty_points=int(user.loyalty_points or 0),
    )


@router.post("/me/change-password", response_model=ChangePasswordResponse)
def change_current_user_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_user_auth_schema(db)
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not _password_matches(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_password = str(payload.new_password or "")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    if payload.current_password == new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    user.hashed_password = get_password_hash(new_password)
    db.commit()

    return ChangePasswordResponse(message="Password updated successfully")


@router.get("/admin-only")
def admin_dashboard(current_user: User = Depends(require_role("admin"))):
    return {"message": f"Welcome Admin {current_user.full_name}"}


@router.post("/admin/session-login")
def admin_session_login(
    response: Response,
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    ensure_user_auth_schema(db)
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not _password_matches(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    if role_value not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="This login is restricted to administrator accounts.")
    if not user.admin_approved:
        raise HTTPException(status_code=403, detail="Admin account awaiting super admin approval")

    session_id = create_session_id()
    expires_at = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    user_agent, ip_address = get_request_metadata(request)
    create_user_session(
        db=db,
        user_id=user.id,
        session_id=session_id,
        session_type="admin",
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=expires_at,
    )
    db.commit()

    access_token = create_access_token(data={"sub": user.email}, session_id=session_id)
    response.set_cookie(
        key=ADMIN_SESSION_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/admin/session-logout")
def admin_session_logout(response: Response):
    response.delete_cookie(ADMIN_SESSION_COOKIE_NAME, path="/")
    return {"message": "Admin session cleared"}


@router.post("/super-admin/admin-users", response_model=AdminUserResponse)
def create_admin_user(
    payload: AdminAccountCreate,
    current_user: User = Depends(require_role("super_admin")),
    db: Session = Depends(get_db),
):
    if payload.role not in {UserRole.admin, UserRole.super_admin}:
        raise HTTPException(status_code=400, detail="Only admin and super_admin accounts can be created here")

    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        accepted_terms=True,
        admin_approved=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/super-admin/admin-users", response_model=list[AdminUserResponse])
def list_admin_users(
    current_user: User = Depends(require_role("super_admin")),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(User.role.in_([UserRole.admin, UserRole.super_admin])).order_by(User.created_at.desc()).all()
    return users


@router.patch("/super-admin/admin-users/{user_id}/approve", response_model=AdminUserResponse)
def approve_admin_user(
    user_id: int,
    payload: AdminApprovalUpdate,
    current_user: User = Depends(require_role("super_admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    if role_value not in {"admin", "super_admin"}:
        raise HTTPException(status_code=400, detail="Only admin-class users can be approved here")

    user.admin_approved = bool(payload.approved)
    user.admin_approved_at = datetime.utcnow() if payload.approved else None
    user.approved_by_user_id = current_user.id if payload.approved else None
    db.commit()
    db.refresh(user)
    return user


@router.get("/debug/reset-email-preview", response_class=HTMLResponse)
def debug_reset_email_preview(token: str = "debug-reset-token"):
    return HTMLResponse(content=_build_reset_preview_html(token))


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@router.post("/auth/forgot-password", response_model=ForgotPasswordResponse, include_in_schema=False)
async def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    ensure_user_auth_schema(db)
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return ForgotPasswordResponse(message=GENERIC_RESET_MESSAGE)

    print(f"[forgot_password] email exists for {user.email}")
    raw_token = secrets.token_urlsafe(32)
    print(f"[forgot_password] token generated for {user.email}")
    token_hash = _hash_reset_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES)
    reset_link = _build_reset_link(raw_token)
    print(f"[forgot_password] reset link for {user.email}: {reset_link}")

    user.reset_password_token_hash = token_hash
    user.reset_password_expires_at = expires_at
    user.reset_otp = None
    user.reset_otp_expires_at = None
    db.commit()

    try:
        print(f"[forgot_password] email sending started for {user.email}")
        await send_password_reset_email(user.email, raw_token)
        print(f"[forgot_password] email sent successfully to {user.email}")
    except Exception as exc:
        user.reset_password_token_hash = None
        user.reset_password_expires_at = None
        db.commit()
        raise HTTPException(status_code=500, detail="Unable to send reset email at the moment") from exc

    return ForgotPasswordResponse(message=GENERIC_RESET_MESSAGE)


@router.post("/reset-password", response_model=ResetPasswordResponse)
@router.post("/auth/reset-password", response_model=ResetPasswordResponse, include_in_schema=False)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    ensure_user_auth_schema(db)
    token_preview = f"{payload.token[:8]}..." if payload.token else "<missing>"
    print(f"[reset_password] request received token={token_preview}")

    token_hash = _hash_reset_token(payload.token)
    user = db.query(User).filter(User.reset_password_token_hash == token_hash).first()

    if not user:
        print("[reset_password] invalid token")
        raise HTTPException(status_code=400, detail="Invalid token")

    print(f"[reset_password] token matched user {user.email}")

    if not user.reset_password_expires_at or datetime.utcnow() > user.reset_password_expires_at:
        print(f"[reset_password] expired token for {user.email}")
        raise HTTPException(status_code=400, detail="Expired token")

    try:
        user.hashed_password = get_password_hash(payload.new_password)
        user.reset_password_token_hash = None
        user.reset_password_expires_at = None
        user.reset_otp = None
        user.reset_otp_expires_at = None
        db.commit()
        print(f"[reset_password] password updated for {user.email}")
    except Exception as exc:
        db.rollback()
        print(f"[reset_password] failed for {user.email}: {exc}")
        raise

    return ResetPasswordResponse(message="Password reset successful")
