import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ADMIN_SESSION_COOKIE_MAX_AGE,
    ADMIN_SESSION_COOKIE_NAME,
    DEBUG_SECURITY_ENDPOINTS_ENABLED,
    EMAIL_VERIFICATION_FAILURE_URL,
    EMAIL_VERIFICATION_REQUIRED,
    EMAIL_VERIFICATION_SUCCESS_URL,
    EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS,
    PASSWORD_RESET_URL,
    SESSION_COOKIE_SAMESITE,
    SESSION_COOKIE_SECURE,
    USER_SESSION_COOKIE_MAX_AGE,
    USER_SESSION_COOKIE_NAME,
)
from app.core.rate_limit import enforce_rate_limit
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
    verify_and_update_password,
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
from app.utils.email import send_email_verification_email
from app.services.referral_service import generate_referral_code

router = APIRouter()
logger = logging.getLogger(__name__)

RESET_TOKEN_EXPIRY_MINUTES = 30
GENERIC_RESET_MESSAGE = "If an account exists for that email, a reset link has been sent."
GENERIC_VERIFICATION_MESSAGE = "If an account exists for that email, a verification email has been sent."


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _hash_one_time_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _password_matches(plain_password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    try:
        valid, _updated_hash = verify_and_update_password(plain_password, hashed_password)
        return bool(valid)
    except Exception as exc:
        logger.warning("Password verification failed due to stored hash error: %s", type(exc).__name__)
        return False


def _rehash_password_if_needed(user: User, plain_password: str, db: Session) -> None:
    if not user.hashed_password:
        return
    try:
        valid, updated_hash = verify_and_update_password(plain_password, user.hashed_password)
    except Exception as exc:
        logger.warning("Password rehash check failed for user_id=%s: %s", user.id, type(exc).__name__)
        return
    if valid and updated_hash and updated_hash != user.hashed_password:
        user.hashed_password = updated_hash
        db.add(user)
        db.commit()


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


def _revoke_user_sessions(db: Session, user_id: int) -> None:
    db.query(UserSession).filter(
        UserSession.user_id == int(user_id),
        UserSession.revoked_at.is_(None),
    ).update(
        {"revoked_at": datetime.utcnow()},
        synchronize_session=False,
    )


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=USER_SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite=SESSION_COOKIE_SAMESITE,
        path="/",
        max_age=USER_SESSION_COOKIE_MAX_AGE,
    )


async def _issue_email_verification(user: User, db: Session) -> None:
    raw_token = secrets.token_urlsafe(32)
    user.email_verification_token_hash = _hash_one_time_token(raw_token)
    user.email_verification_expires_at = datetime.utcnow() + timedelta(hours=EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS)
    db.commit()
    await send_email_verification_email(user.email, raw_token)


@router.post("/register", response_model=UserResponse)
async def register_user(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    enforce_rate_limit(request, action="register", limit=5, window_seconds=15 * 60)
    enforce_rate_limit(
        request,
        action="register-email",
        limit=3,
        window_seconds=60 * 60,
        subject=user.email,
    )
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
        is_active=not EMAIL_VERIFICATION_REQUIRED,
        email_verified=not EMAIL_VERIFICATION_REQUIRED,
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

    if EMAIL_VERIFICATION_REQUIRED:
        try:
            await _issue_email_verification(new_user, db)
        except Exception as exc:
            logger.error("Email verification send failed for user_id=%s: %s", new_user.id, type(exc).__name__)
            raise HTTPException(
                status_code=500,
                detail="We could not send your verification email right now. Please try again shortly.",
            ) from exc

    role_value = new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role)
    try:
        if role_value == "customer":
            await send_customer_welcome_email(new_user.email, new_user.full_name)
        elif role_value == "barber":
            await send_barber_welcome_email(new_user.email, new_user.full_name)
    except Exception as exc:
        logger.warning("Welcome email failed for user_id=%s: %s", new_user.id, type(exc).__name__)

    return new_user


@router.post("/login", response_model=LoginResponse)
def login_user(
    response: Response,
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, action="login", limit=8, window_seconds=15 * 60)
    enforce_rate_limit(
        request,
        action="login-email",
        limit=12,
        window_seconds=30 * 60,
        subject=form_data.username,
    )
    ensure_user_auth_schema(db)
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not _password_matches(form_data.password, user.hashed_password):
        logger.warning("Failed login attempt for email=%s", form_data.username)
        raise HTTPException(status_code=400, detail="Invalid credentials")
    _rehash_password_if_needed(user, form_data.password, db)

    if not user.is_active:
        if not bool(getattr(user, "email_verified", True)):
            raise HTTPException(status_code=403, detail="Please verify your email before signing in.")
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
    _set_auth_cookie(response, access_token)
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
        address_line=current_user.address_line,
        address_area=current_user.address_area,
        address_landmark=current_user.address_landmark,
        address_note=current_user.address_note,
        accepted_terms=current_user.accepted_terms,
        admin_approved=current_user.admin_approved,
        referral_code=current_user.referral_code,
        loyalty_points=int(current_user.loyalty_points or 0),
    )


@router.post("/session/logout")
def session_logout(response: Response):
    response.delete_cookie(USER_SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(ADMIN_SESSION_COOKIE_NAME, path="/")
    return {"message": "Session cleared"}


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
    user.address_line = str(payload.address_line or "").strip() or None
    user.address_area = str(payload.address_area or "").strip() or None
    user.address_landmark = str(payload.address_landmark or "").strip() or None
    user.address_note = str(payload.address_note or "").strip() or None
    db.commit()
    db.refresh(user)

    return CurrentUserResponse(
        logged_in_as=user.email,
        role=user.role,
        full_name=user.full_name,
        phone=user.phone,
        address_line=user.address_line,
        address_area=user.address_area,
        address_landmark=user.address_landmark,
        address_note=user.address_note,
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
    _revoke_user_sessions(db, user.id)
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
    enforce_rate_limit(request, action="admin-login", limit=5, window_seconds=15 * 60)
    enforce_rate_limit(
        request,
        action="admin-login-email",
        limit=8,
        window_seconds=30 * 60,
        subject=form_data.username,
    )
    ensure_user_auth_schema(db)
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not _password_matches(form_data.password, user.hashed_password):
        logger.warning("Failed admin login attempt for email=%s", form_data.username)
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
        secure=SESSION_COOKIE_SECURE,
        samesite=SESSION_COOKIE_SAMESITE,
        path="/",
        max_age=ADMIN_SESSION_COOKIE_MAX_AGE,
    )
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/admin/session-logout")
def admin_session_logout(response: Response):
    response.delete_cookie(ADMIN_SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(USER_SESSION_COOKIE_NAME, path="/")
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
        is_active=True,
        email_verified=True,
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
    if not DEBUG_SECURITY_ENDPOINTS_ENABLED:
        raise HTTPException(status_code=404, detail="Not found")
    return HTMLResponse(content=_build_reset_preview_html(token))


@router.get("/auth/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    token_hash = _hash_one_time_token(token)
    user = db.query(User).filter(User.email_verification_token_hash == token_hash).first()
    if not user or not user.email_verification_expires_at or datetime.utcnow() > user.email_verification_expires_at:
        return RedirectResponse(url=EMAIL_VERIFICATION_FAILURE_URL, status_code=303)

    user.email_verified = True
    user.is_active = True
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    db.commit()
    return RedirectResponse(url=EMAIL_VERIFICATION_SUCCESS_URL, status_code=303)


@router.post("/auth/resend-verification")
async def resend_verification_email(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    enforce_rate_limit(request, action="resend-verification", limit=5, window_seconds=15 * 60)
    enforce_rate_limit(
        request,
        action="resend-verification-email",
        limit=3,
        window_seconds=60 * 60,
        subject=payload.email,
    )
    ensure_user_auth_schema(db)
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or bool(getattr(user, "email_verified", True)):
        return {"message": GENERIC_VERIFICATION_MESSAGE}

    try:
        await _issue_email_verification(user, db)
        logger.info("Verification email resent for user_id=%s", user.id)
    except Exception as exc:
        logger.error("Verification resend failed for user_id=%s: %s", user.id if user else "unknown", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Unable to send verification email right now.") from exc

    return {"message": GENERIC_VERIFICATION_MESSAGE}


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@router.post("/auth/forgot-password", response_model=ForgotPasswordResponse, include_in_schema=False)
async def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    enforce_rate_limit(request, action="forgot-password", limit=5, window_seconds=15 * 60)
    enforce_rate_limit(
        request,
        action="forgot-password-email",
        limit=3,
        window_seconds=60 * 60,
        subject=payload.email,
    )
    ensure_user_auth_schema(db)
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return ForgotPasswordResponse(message=GENERIC_RESET_MESSAGE)

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_reset_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES)

    user.reset_password_token_hash = token_hash
    user.reset_password_expires_at = expires_at
    user.reset_otp = None
    user.reset_otp_expires_at = None
    db.commit()

    try:
        await send_password_reset_email(user.email, raw_token)
        logger.info("Password reset email sent for user_id=%s", user.id)
    except Exception as exc:
        user.reset_password_token_hash = None
        user.reset_password_expires_at = None
        db.commit()
        logger.error("Password reset email failed for user_id=%s: %s", user.id, type(exc).__name__)
        raise HTTPException(status_code=500, detail="Unable to send reset email at the moment") from exc

    return ForgotPasswordResponse(message=GENERIC_RESET_MESSAGE)


@router.post("/reset-password", response_model=ResetPasswordResponse)
@router.post("/auth/reset-password", response_model=ResetPasswordResponse, include_in_schema=False)
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    enforce_rate_limit(request, action="reset-password", limit=10, window_seconds=15 * 60)
    ensure_user_auth_schema(db)
    token_hash = _hash_reset_token(payload.token)
    user = db.query(User).filter(User.reset_password_token_hash == token_hash).first()

    if not user:
        logger.warning("Invalid password reset token submitted")
        raise HTTPException(status_code=400, detail="Invalid token")

    if not user.reset_password_expires_at or datetime.utcnow() > user.reset_password_expires_at:
        logger.info("Expired password reset token used for user_id=%s", user.id)
        raise HTTPException(status_code=400, detail="Expired token")

    try:
        user.hashed_password = get_password_hash(payload.new_password)
        user.reset_password_token_hash = None
        user.reset_password_expires_at = None
        user.reset_otp = None
        user.reset_otp_expires_at = None
        _revoke_user_sessions(db, user.id)
        db.commit()
        logger.info("Password reset completed for user_id=%s", user.id)
    except Exception as exc:
        db.rollback()
        logger.error("Password reset failed for user_id=%s: %s", user.id, type(exc).__name__)
        raise

    return ResetPasswordResponse(message="Password reset successful")
