from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import requests
from jose import JWTError, jwt
from sqlalchemy.orm import Session, joinedload

from app.core.config import (
    FRONTEND_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    JWT_SECRET_KEY,
)
from app.core.security import ALGORITHM
from app.enums.booking_status import BookingStatus
from app.enums.payment_status import PaymentStatus
from app.models.barber import Barber
from app.models.booking import Booking
from app.models.booking_service import BookingService
from app.models.user import User

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_CALENDAR_EVENTS_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
GOOGLE_CALENDAR_SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.events",
]
GOOGLE_STATE_TTL_MINUTES = 15
GOOGLE_CALENDAR_TIMEZONE = "Africa/Lagos"
GOOGLE_CALENDAR_SYNC_STATUS_VALUES = {
    BookingStatus.paid.value,
    BookingStatus.completed.value,
    BookingStatus.no_show.value,
    BookingStatus.disputed.value,
}


def is_google_calendar_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI)


def _frontend_settings_url(**params: str) -> str:
    base = FRONTEND_URL.rstrip("/")
    if base.endswith("/static"):
        target = f"{base}/settings.html"
    else:
        target = f"{base}/static/settings.html"
    query = urlencode({key: value for key, value in params.items() if value})
    return f"{target}?{query}" if query else target


def google_calendar_settings_redirect_url(status: str) -> str:
    return _frontend_settings_url(google_calendar=status)


def create_google_calendar_connect_state(user: User) -> str:
    expires_at = datetime.utcnow() + timedelta(minutes=GOOGLE_STATE_TTL_MINUTES)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "purpose": "google_calendar_connect",
        "exp": expires_at,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)


def decode_google_calendar_connect_state(state_token: str) -> int:
    try:
        payload = jwt.decode(state_token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired Google Calendar state.") from exc
    if payload.get("purpose") != "google_calendar_connect":
        raise ValueError("Invalid Google Calendar state.")
    try:
        return int(payload.get("sub"))
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid Google Calendar state.") from exc


def build_google_calendar_auth_url(state_token: str) -> str:
    if not is_google_calendar_configured():
        raise ValueError("Google Calendar integration is not configured yet.")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "scope": " ".join(GOOGLE_CALENDAR_SCOPES),
        "state": state_token,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def _token_request(payload: dict[str, str]) -> dict:
    response = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=30)
    try:
        data = response.json()
    except ValueError:
        data = {}
    if response.status_code >= 400:
        detail = data.get("error_description") or data.get("error") or "Unable to connect Google Calendar right now."
        raise ValueError(detail)
    return data


def exchange_google_calendar_code(code: str) -> dict:
    if not is_google_calendar_configured():
        raise ValueError("Google Calendar integration is not configured yet.")
    return _token_request(
        {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }
    )


def refresh_google_calendar_access_token(refresh_token: str) -> dict:
    if not is_google_calendar_configured():
        raise ValueError("Google Calendar integration is not configured yet.")
    return _token_request(
        {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    )


def _expiry_from_token_payload(token_payload: dict) -> datetime | None:
    try:
        expires_in = int(token_payload.get("expires_in") or 0)
    except (TypeError, ValueError):
        return None
    if expires_in <= 0:
        return None
    return datetime.utcnow() + timedelta(seconds=max(expires_in - 60, 0))


def store_google_calendar_tokens(user: User, token_payload: dict, connected_email: str | None = None) -> None:
    refresh_token = token_payload.get("refresh_token") or user.google_calendar_refresh_token
    user.google_calendar_access_token = token_payload.get("access_token")
    user.google_calendar_refresh_token = refresh_token
    user.google_calendar_token_expires_at = _expiry_from_token_payload(token_payload)
    user.google_calendar_connected = bool(user.google_calendar_access_token and refresh_token)
    user.google_calendar_connected_at = datetime.utcnow() if user.google_calendar_connected else None
    user.google_calendar_email = connected_email or user.google_calendar_email or user.email


def fetch_google_calendar_profile(access_token: str) -> dict:
    response = requests.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    try:
        data = response.json()
    except ValueError:
        data = {}
    if response.status_code >= 400:
        detail = data.get("error_description") or data.get("error") or "Unable to read your Google account details."
        raise ValueError(detail)
    return data


def disconnect_google_calendar(user: User) -> None:
    user.google_calendar_connected = False
    user.google_calendar_email = None
    user.google_calendar_access_token = None
    user.google_calendar_refresh_token = None
    user.google_calendar_token_expires_at = None
    user.google_calendar_connected_at = None


def ensure_google_calendar_access_token(user: User) -> str:
    if not user.google_calendar_connected or not user.google_calendar_refresh_token:
        raise ValueError("Google Calendar is not connected for this account.")
    expires_at = user.google_calendar_token_expires_at
    if user.google_calendar_access_token and expires_at and expires_at > datetime.utcnow():
        return user.google_calendar_access_token

    token_payload = refresh_google_calendar_access_token(user.google_calendar_refresh_token)
    store_google_calendar_tokens(user, token_payload, connected_email=user.google_calendar_email)
    if not user.google_calendar_access_token:
        raise ValueError("Unable to refresh Google Calendar access.")
    return user.google_calendar_access_token


def _booking_sync_status(booking: Booking) -> str:
    raw = str(booking.status.value if hasattr(booking.status, "value") else booking.status or "").lower()
    return BookingStatus.approved.value if raw == BookingStatus.accepted.value else raw


def _booking_is_calendar_confirmed(booking: Booking) -> bool:
    payment_status = str(booking.payment_status.value if hasattr(booking.payment_status, "value") else booking.payment_status or "").lower()
    return payment_status == PaymentStatus.paid.value and _booking_sync_status(booking) in GOOGLE_CALENDAR_SYNC_STATUS_VALUES


def _booking_duration_minutes(booking: Booking) -> int:
    booking_services = list(getattr(booking, "booking_services", []) or [])
    total_minutes = 0
    for item in booking_services:
        service = getattr(item, "service", None)
        try:
            minutes = int(getattr(service, "duration_minutes", 60) or 60)
        except (TypeError, ValueError):
            minutes = 60
        total_minutes += max(minutes, 15)
    return total_minutes or 60


def _booking_datetime_bounds(booking: Booking) -> tuple[datetime, datetime]:
    local_tz = ZoneInfo(GOOGLE_CALENDAR_TIMEZONE)
    start = booking.scheduled_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=local_tz)
    else:
        start = start.astimezone(local_tz)
    end = start + timedelta(minutes=_booking_duration_minutes(booking))
    return start, end


def _location_text_for_owner(booking: Booking, owner_kind: Literal["customer", "barber"]) -> str:
    service_mode = str(booking.service_mode or "").lower()
    barber = booking.barber
    barber_name = getattr(barber, "barber_name", None) or getattr(barber, "shop_name", None) or "your barber"
    if service_mode == "home_service":
        address_parts = [
            booking.customer_address_line,
            booking.customer_address_landmark,
            booking.customer_address_area,
        ]
        return ", ".join(part.strip() for part in address_parts if part and str(part).strip()) or f"Home service with {barber_name}"
    address_parts = [
        booking.barber_shop_address,
        booking.barber_shop_landmark,
        getattr(barber, "location", None),
    ]
    return ", ".join(part.strip() for part in address_parts if part and str(part).strip()) or f"{barber_name} studio"


def _description_text_for_owner(booking: Booking, owner_kind: Literal["customer", "barber"]) -> str:
    barber = booking.barber
    customer = booking.customer
    barber_name = getattr(barber, "barber_name", None) or getattr(barber, "shop_name", None) or "your barber"
    customer_name = getattr(customer, "full_name", None) or "your customer"
    selected_services = [
        str(getattr(getattr(item, "service", None), "name", "") or booking.service_name or "Haircut").strip()
        for item in list(getattr(booking, "booking_services", []) or [])
    ]
    services_text = ", ".join(service for service in selected_services if service) or booking.service_name or "Haircut"
    service_mode = "Home service" if str(booking.service_mode or "").lower() == "home_service" else "Shop visit"
    counterpart = customer_name if owner_kind == "barber" else barber_name
    booking_manage_url = f"{FRONTEND_URL.rstrip('/')}/static/dashboard-bookings.html?booking={booking.id}"
    return (
        f"Trimly booking with {counterpart}\n"
        f"Services: {services_text}\n"
        f"Mode: {service_mode}\n"
        f"Booking ID: {booking.id}\n"
        f"Manage, reschedule, or cancel in Trimly: {booking_manage_url}"
    )


def _event_summary_for_owner(booking: Booking, owner_kind: Literal["customer", "barber"]) -> str:
    barber = booking.barber
    customer = booking.customer
    barber_name = getattr(barber, "barber_name", None) or getattr(barber, "shop_name", None) or "barber"
    customer_name = getattr(customer, "full_name", None) or "customer"
    if owner_kind == "barber":
        return f"Trimly booking: {customer_name}"
    return f"Trimly appointment with {barber_name}"


def _event_payload_for_owner(booking: Booking, owner_kind: Literal["customer", "barber"]) -> dict:
    start, end = _booking_datetime_bounds(booking)
    return {
        "summary": _event_summary_for_owner(booking, owner_kind),
        "description": _description_text_for_owner(booking, owner_kind),
        "location": _location_text_for_owner(booking, owner_kind),
        "start": {
            "dateTime": start.isoformat(),
            "timeZone": GOOGLE_CALENDAR_TIMEZONE,
        },
        "end": {
            "dateTime": end.isoformat(),
            "timeZone": GOOGLE_CALENDAR_TIMEZONE,
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email", "minutes": 1440},
                {"method": "popup", "minutes": 60},
            ],
        },
        "source": {
            "title": "Trimly",
            "url": _frontend_settings_url(),
        },
    }


def _calendar_api_request(method: str, url: str, access_token: str, *, payload: dict | None = None) -> dict | None:
    response = requests.request(
        method=method,
        url=url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if response.status_code == 204:
        return None
    try:
        data = response.json()
    except ValueError:
        data = {}
    if response.status_code >= 400:
        detail = data.get("error", {}).get("message") or data.get("error_description") or "Google Calendar request failed."
        raise ValueError(detail)
    return data


def _upsert_google_calendar_event(user: User, booking: Booking, owner_kind: Literal["customer", "barber"], existing_event_id: str | None) -> str:
    access_token = ensure_google_calendar_access_token(user)
    payload = _event_payload_for_owner(booking, owner_kind)
    if existing_event_id:
        url = f"{GOOGLE_CALENDAR_EVENTS_BASE}/{existing_event_id}"
        data = _calendar_api_request("PUT", url, access_token, payload=payload)
    else:
        data = _calendar_api_request("POST", GOOGLE_CALENDAR_EVENTS_BASE, access_token, payload=payload)
    event_id = (data or {}).get("id")
    if not event_id:
        raise ValueError("Google Calendar did not return an event id.")
    return event_id


def _delete_google_calendar_event(user: User, event_id: str) -> None:
    access_token = ensure_google_calendar_access_token(user)
    _calendar_api_request("DELETE", f"{GOOGLE_CALENDAR_EVENTS_BASE}/{event_id}", access_token)


def _booking_query(db: Session):
    return db.query(Booking).options(
        joinedload(Booking.customer),
        joinedload(Booking.barber).joinedload(Barber.user),
        joinedload(Booking.booking_services).joinedload(BookingService.service),
    )


def sync_google_calendar_for_booking(db: Session, booking_id: int) -> bool:
    booking = _booking_query(db).filter(Booking.id == booking_id).first()
    if not booking:
        return False
    if not _booking_is_calendar_confirmed(booking):
        return clear_google_calendar_for_booking(db, booking_id)

    changed = False
    try:
        customer = booking.customer
        if customer and customer.google_calendar_connected and customer.google_calendar_refresh_token:
            booking.customer_google_calendar_event_id = _upsert_google_calendar_event(
                customer,
                booking,
                "customer",
                booking.customer_google_calendar_event_id,
            )
            changed = True
    except Exception:
        pass

    barber_user = booking.barber.user if booking.barber and booking.barber.user else None
    try:
        if barber_user and barber_user.google_calendar_connected and barber_user.google_calendar_refresh_token:
            booking.barber_google_calendar_event_id = _upsert_google_calendar_event(
                barber_user,
                booking,
                "barber",
                booking.barber_google_calendar_event_id,
            )
            changed = True
    except Exception:
        pass

    if changed:
        booking.calendar_last_synced_at = datetime.utcnow()
        db.commit()
    return changed


def clear_google_calendar_for_booking(db: Session, booking_id: int) -> bool:
    booking = _booking_query(db).filter(Booking.id == booking_id).first()
    if not booking:
        return False

    changed = False
    customer = booking.customer
    if booking.customer_google_calendar_event_id and customer and customer.google_calendar_connected and customer.google_calendar_refresh_token:
        try:
            _delete_google_calendar_event(customer, booking.customer_google_calendar_event_id)
        except Exception:
            pass
    if booking.customer_google_calendar_event_id:
        booking.customer_google_calendar_event_id = None
        changed = True

    barber_user = booking.barber.user if booking.barber and booking.barber.user else None
    if booking.barber_google_calendar_event_id and barber_user and barber_user.google_calendar_connected and barber_user.google_calendar_refresh_token:
        try:
            _delete_google_calendar_event(barber_user, booking.barber_google_calendar_event_id)
        except Exception:
            pass
    if booking.barber_google_calendar_event_id:
        booking.barber_google_calendar_event_id = None
        changed = True

    if changed:
        booking.calendar_last_synced_at = datetime.utcnow()
        db.commit()
    return changed


def google_calendar_status_payload(user: User) -> dict:
    return {
        "configured": is_google_calendar_configured(),
        "connected": bool(user.google_calendar_connected and user.google_calendar_refresh_token),
        "connected_email": user.google_calendar_email,
        "connected_at": user.google_calendar_connected_at.isoformat() if user.google_calendar_connected_at else None,
        "redirect_uri": GOOGLE_REDIRECT_URI if is_google_calendar_configured() else None,
    }


def sync_connected_user_google_calendar_bookings(db: Session, user_id: int) -> int:
    now = datetime.utcnow() - timedelta(hours=6)
    booking_ids: set[int] = set()

    customer_booking_ids = (
        db.query(Booking.id)
        .filter(Booking.customer_id == user_id, Booking.scheduled_time >= now)
        .all()
    )
    booking_ids.update(int(row[0]) for row in customer_booking_ids)

    barber_booking_ids = (
        db.query(Booking.id)
        .join(Barber, Booking.barber_id == Barber.id)
        .filter(Barber.user_id == user_id, Booking.scheduled_time >= now)
        .all()
    )
    booking_ids.update(int(row[0]) for row in barber_booking_ids)

    synced = 0
    for booking_id in booking_ids:
        try:
            if sync_google_calendar_for_booking(db, booking_id):
                synced += 1
        except Exception:
            continue
    return synced
