from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import SessionLocal, get_db
from app.models.user import User
from app.services.google_calendar_service import (
    build_google_calendar_auth_url,
    create_google_calendar_connect_state,
    decode_google_calendar_connect_state,
    disconnect_google_calendar,
    exchange_google_calendar_code,
    fetch_google_calendar_profile,
    google_calendar_status_payload,
    google_calendar_settings_redirect_url,
    is_google_calendar_configured,
    store_google_calendar_tokens,
    sync_connected_user_google_calendar_bookings,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/google-calendar/status")
def get_google_calendar_status(current_user: User = Depends(get_current_user)):
    return google_calendar_status_payload(current_user)


@router.post("/google-calendar/connect")
def start_google_calendar_connect(
    current_user: User = Depends(get_current_user),
):
    if not is_google_calendar_configured():
        raise HTTPException(status_code=503, detail="Google Calendar is not configured on Trimly yet.")
    state_token = create_google_calendar_connect_state(current_user)
    return {"auth_url": build_google_calendar_auth_url(state_token)}


@router.get("/google-calendar/callback")
def complete_google_calendar_connect(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
):
    if error:
        return RedirectResponse(url=google_calendar_settings_redirect_url("error"))
    if not code or not state:
        return RedirectResponse(url=google_calendar_settings_redirect_url("missing"))

    try:
        user_id = decode_google_calendar_connect_state(state)
    except ValueError:
        return RedirectResponse(url=google_calendar_settings_redirect_url("invalid"))

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return RedirectResponse(url=google_calendar_settings_redirect_url("missing-user"))

        token_payload = exchange_google_calendar_code(code)
        profile = fetch_google_calendar_profile(token_payload.get("access_token", ""))
        connected_email = str(profile.get("email") or user.email or "").strip() or None
        store_google_calendar_tokens(user, token_payload, connected_email=connected_email)
        db.commit()
        sync_connected_user_google_calendar_bookings(db, user.id)
    except Exception:
        db.rollback()
        return RedirectResponse(url=google_calendar_settings_redirect_url("error"))
    finally:
        db.close()

    return RedirectResponse(url=google_calendar_settings_redirect_url("connected"))


@router.delete("/google-calendar/connection")
def remove_google_calendar_connection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    disconnect_google_calendar(user)
    db.add(user)
    db.commit()
    return {"message": "Google Calendar disconnected."}
