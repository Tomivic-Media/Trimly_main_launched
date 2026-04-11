from datetime import date, datetime, time, timedelta
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.core.config import FRONTEND_URL, PAYSTACK_SECRET_KEY
from app.core.security import get_current_user, require_any_role, require_role
from app.db.session import get_db
from app.enums.booking_status import BookingStatus
from app.enums.payment_status import PaymentStatus
from app.models.barber import Barber
from app.models.barber_service import BarberService
from app.models.booking import Booking
from app.models.booking_service import BookingService
from app.models.user import User, UserRole
from app.schemas.booking import BookingCreate, BookingResponse, BookingServiceSelection
from app.services.escrow_service import (
    COMMISSION_RATE,
    PAYOUT_STATUS_PAYMENT_INITIALIZED,
    apply_paid_booking_state,
    calculate_split_amounts,
    mark_booking_completed,
)
from app.services.notification_service import create_notifications, format_notification_time, notify_admins
from app.services.referral_service import award_completion_points, maybe_award_referral_bonus
from app.services.reminder_service import dispatch_due_booking_reminders
from app.services.paystack_subaccount_service import ensure_barber_subaccount
from app.models.barber_kyc import BarberKYC
from app.routes.barber import (
    DEFAULT_HAIRCUT_SERVICE_NAME,
    _sync_default_barber_services,
)






router = APIRouter()


def _ensure_booking_status_schema(db: Session) -> None:
    statement = (
        "DO $$ BEGIN "
        "IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bookingstatus') THEN "
        "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'approved'; "
        "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'paid'; "
        "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'disputed'; "
        "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'refunded'; "
        "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'no_show'; "
        "END IF; "
        "END $$;"
    )

    try:
        db.execute(text(statement))
        db.commit()
    except Exception:
        db.rollback()


def _normalize_role(role_value) -> str:
    if role_value is None:
        return ""
    if hasattr(role_value, "value"):
        return str(role_value.value).lower()
    role_text = str(role_value).strip().lower()
    if "." in role_text:
        role_text = role_text.split(".")[-1]
    return role_text


ADMIN_ROLES = {UserRole.admin.value, UserRole.super_admin.value}


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone().replace(tzinfo=None)
    return value


def _parse_available_days(raw_days: str | None) -> list[str]:
    if not raw_days:
        return []
    return [item.strip().lower() for item in raw_days.split(",") if item.strip()]


def _booking_window_for_barber(barber: Barber, barber_user: User) -> tuple[time | None, time | None]:
    start_time = barber.available_start_time or barber_user.work_start
    end_time = barber.available_end_time or barber_user.work_end
    return start_time, end_time


def _logic_status(status: BookingStatus | str | None) -> str:
    value = str(status.value if hasattr(status, "value") else status or "").lower()
    if value == BookingStatus.accepted.value:
        return BookingStatus.approved.value
    return value


def _assert_verified_barber(barber: Barber | None) -> None:
    if not barber or barber.kyc_status != "verified":
        raise HTTPException(status_code=400, detail="Barber is not verified")


def _assert_within_availability(barber: Barber, barber_user: User, scheduled_time: datetime) -> None:
    _assert_verified_barber(barber)

    if not barber.is_available:
        raise HTTPException(status_code=400, detail="Barber is currently offline")

    day_name = scheduled_time.strftime("%A").lower()
    configured_days = _parse_available_days(barber.available_days)
    if configured_days and day_name not in configured_days:
        raise HTTPException(status_code=400, detail="Barber is unavailable on this day")

    start_time, end_time = _booking_window_for_barber(barber, barber_user)
    if not start_time or not end_time:
        raise HTTPException(status_code=400, detail="Barber working hours not set")

    booking_time = scheduled_time.time().replace(tzinfo=None)
    if start_time >= end_time:
        raise HTTPException(status_code=400, detail="Barber availability is invalid")

    if not (start_time <= booking_time <= end_time):
        raise HTTPException(status_code=400, detail="Booking time is outside barber working hours")


def _booking_query(db: Session):
    return db.query(Booking).options(
        joinedload(Booking.customer),
        joinedload(Booking.barber).joinedload(Barber.user),
        joinedload(Booking.booking_services).joinedload(BookingService.service),
        joinedload(Booking.review),
    )


def _get_booking_or_404(db: Session, booking_id: int) -> Booking:
    booking = _booking_query(db).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


def _assert_barber_owns_booking(booking: Booking, current_user: User) -> None:
    barber = booking.barber
    if not barber or barber.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")


def _booking_to_response(booking: Booking) -> BookingResponse:
    customer = booking.customer
    barber = booking.barber
    barber_user = barber.user if barber else None

    barber_name = None
    barber_location = None
    if barber:
        barber_name = barber.barber_name or (barber_user.full_name if barber_user else barber.shop_name)
        barber_location = barber.location

    selected_services = [
        BookingServiceSelection(
            service_id=item.service_id,
            name=item.service.name if item.service else f"Service #{item.service_id}",
            price=float(item.price or 0),
            is_home_service=bool(item.service.is_home_service) if item.service else False,
        )
        for item in getattr(booking, "booking_services", []) or []
    ]

    return BookingResponse(
        id=booking.id,
        customer_id=booking.customer_id,
        barber_id=booking.barber_id,
        scheduled_time=booking.scheduled_time,
        service_name=booking.service_name or "Haircut",
        customer_name=customer.full_name if customer else None,
        customer_phone=customer.phone if customer else None,
        customer_email=customer.email if customer else None,
        barber_user_id=barber.user_id if barber else None,
        barber_name=barber_name,
        barber_location=barber_location,
        review_exists=bool(booking.review),
        review_id=booking.review.id if booking.review else None,
        service_ids=[item.service_id for item in selected_services],
        selected_services=selected_services,
        price=booking.price,
        commission_amount=booking.commission_amount,
        barber_earnings=booking.barber_earnings,
        escrow_amount=booking.escrow_amount,
        barber_payout_amount=booking.barber_payout_amount,
        escrow_released=bool(booking.escrow_released),
        refund_requested=bool(booking.refund_requested),
        status=booking.status,
        payment_status=booking.payment_status,
        payment_reference=booking.payment_reference,
        paid_at=booking.paid_at,
        payout_status=booking.payout_status,
        transfer_reference=booking.transfer_reference,
        transferred_at=booking.transferred_at,
        created_at=booking.created_at,
    )


def _resolve_selected_services(db: Session, barber: Barber, service_ids: list[int]) -> list[BarberService]:
    _sync_default_barber_services(barber, db)

    normalized_ids = [int(service_id) for service_id in service_ids if int(service_id)]
    if len(normalized_ids) != len(set(normalized_ids)):
        raise HTTPException(status_code=400, detail="Duplicate services selected")

    if not normalized_ids:
        fallback = (
            db.query(BarberService)
            .filter(
                BarberService.barber_id == barber.id,
                BarberService.is_active.is_(True),
                BarberService.name.ilike(DEFAULT_HAIRCUT_SERVICE_NAME),
            )
            .first()
        )
        if fallback:
            return [fallback]
        raise HTTPException(status_code=400, detail="At least one service must be selected")

    services = (
        db.query(BarberService)
        .filter(BarberService.id.in_(normalized_ids))
        .all()
    )
    if len(services) != len(normalized_ids):
        raise HTTPException(status_code=400, detail="One or more selected services do not exist")

    services_by_id = {service.id: service for service in services}
    ordered_services: list[BarberService] = []
    for service_id in normalized_ids:
        service = services_by_id.get(service_id)
        if not service:
            raise HTTPException(status_code=400, detail="One or more selected services do not exist")
        if service.barber_id != barber.id:
            raise HTTPException(status_code=400, detail="Cannot select a service from another barber")
        if not bool(service.is_active):
            raise HTTPException(status_code=400, detail=f"Service '{service.name}' is not available")
        ordered_services.append(service)
    return ordered_services


def _dashboard_link(**params) -> str:
    query = urlencode({key: value for key, value in params.items() if value is not None})
    return f"/static/dashboard.html{f'?{query}' if query else ''}"


def _chat_link(booking_id: int) -> str:
    return f"/static/messages.html?booking={booking_id}"


def _admin_link(**params) -> str:
    query = urlencode({key: value for key, value in params.items() if value is not None})
    return f"/admin{f'?{query}' if query else ''}"


def _frontend_public_base() -> str:
    base = FRONTEND_URL.rstrip("/")
    if base.endswith("/static"):
        base = base[: -len("/static")]
    return base


def _notify_booking_created(db: Session, booking: Booking, customer: User, barber_user: User) -> None:
    create_notifications(
        db,
        user_ids=[barber_user.id],
        notification_type="booking_created",
        title="New booking request",
        message=(
            f"{customer.full_name} requested {booking.service_name} for "
            f"{format_notification_time(booking.scheduled_time)}."
        ),
        link=_dashboard_link(booking=booking.id, focus="booking"),
        booking_id=booking.id,
    )


def _notify_booking_approved(db: Session, booking: Booking) -> None:
    create_notifications(
        db,
        user_ids=[booking.customer_id],
        notification_type="booking_approved",
        title="Booking approved",
        message=(
            f"Your booking for {booking.service_name} on "
            f"{format_notification_time(booking.scheduled_time)} has been approved."
        ),
        link=_dashboard_link(booking=booking.id, focus="booking"),
        booking_id=booking.id,
    )


def _notify_chat_available(db: Session, booking: Booking) -> None:
    recipient_ids = [booking.customer_id]
    if booking.barber:
        recipient_ids.append(booking.barber.user_id)

    create_notifications(
        db,
        user_ids=recipient_ids,
        notification_type="chat_available",
        title="Chat is now open",
        message=(
            f"Your {booking.service_name} booking for "
            f"{format_notification_time(booking.scheduled_time)} is approved. "
            "You can now chat directly inside Trimly."
        ),
        link=_chat_link(booking.id),
        booking_id=booking.id,
    )


def _notify_booking_rejected(db: Session, booking: Booking) -> None:
    create_notifications(
        db,
        user_ids=[booking.customer_id],
        notification_type="booking_rejected",
        title="Booking declined",
        message=(
            f"Your booking for {booking.service_name} on "
            f"{format_notification_time(booking.scheduled_time)} was declined by the barber."
        ),
        link=_dashboard_link(booking=booking.id, focus="booking"),
        booking_id=booking.id,
    )


def _notify_booking_cancelled(db: Session, booking: Booking, actor_role: str) -> None:
    recipient_ids = []
    if actor_role != UserRole.customer.value:
        recipient_ids.append(booking.customer_id)
    if actor_role != UserRole.barber.value and booking.barber:
        recipient_ids.append(booking.barber.user_id)

    actor_label = (
        "customer"
        if actor_role == UserRole.customer.value
        else "barber"
        if actor_role == UserRole.barber.value
        else "admin"
    )

    create_notifications(
        db,
        user_ids=recipient_ids,
        notification_type="booking_cancelled",
        title="Booking cancelled",
        message=(
            f"The {booking.service_name} booking scheduled for "
            f"{format_notification_time(booking.scheduled_time)} was cancelled by the {actor_label}."
        ),
        link=_dashboard_link(booking=booking.id, focus="booking"),
        booking_id=booking.id,
    )


def _notify_payment_confirmed(db: Session, booking: Booking) -> None:
    recipient_ids = [booking.customer_id]
    if booking.barber:
        recipient_ids.append(booking.barber.user_id)

    create_notifications(
        db,
        user_ids=recipient_ids,
        notification_type="booking_paid",
        title="Payment confirmed",
        message=(
            f"Payment for {booking.service_name} on "
            f"{format_notification_time(booking.scheduled_time)} has been confirmed."
        ),
        link=_dashboard_link(booking=booking.id, focus="booking"),
        booking_id=booking.id,
    )


def _verify_paystack_payment_reference(db: Session, booking: Booking, reference: str) -> dict:
    if booking.payment_status == PaymentStatus.paid or _logic_status(booking.status) in {
        BookingStatus.paid.value,
        BookingStatus.completed.value,
    }:
        return {"message": "Payment already verified", "booking_status": _logic_status(booking.status)}

    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Payment gateway is not configured")

    headers = {"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}
    try:
        response = requests.get(
            f"https://api.paystack.co/transaction/verify/{reference}",
            headers=headers,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Unable to verify payment with Paystack right now") from exc

    try:
        result = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid response returned during payment verification") from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=result.get("message") or result.get("detail") or "Payment verification failed",
        )

    if result.get("data", {}).get("status") != "success":
        raise HTTPException(status_code=400, detail="Payment not successful")

    _assert_verified_barber(booking.barber)
    already_paid = booking.payment_status == PaymentStatus.paid
    apply_paid_booking_state(booking)
    if not already_paid:
        _notify_payment_confirmed(db, booking)
    db.commit()

    return {
        "message": "Payment verified successfully",
        "booking_status": BookingStatus.paid.value,
        "payment_status": PaymentStatus.paid.value,
        "booking_id": booking.id,
    }


def _notify_booking_completed(db: Session, booking: Booking) -> None:
    recipient_ids = [booking.customer_id]
    if booking.barber:
        recipient_ids.append(booking.barber.user_id)

    create_notifications(
        db,
        user_ids=recipient_ids,
        notification_type="booking_completed",
        title="Booking completed",
        message=(
            f"The {booking.service_name} booking on "
            f"{format_notification_time(booking.scheduled_time)}."
        ),
        link=_dashboard_link(booking=booking.id, focus="booking"),
        booking_id=booking.id,
    )
    notify_admins(
        db,
        notification_type="booking_completed_admin",
        title="Booking completed",
        message=(
            f"Booking #{booking.id} was marked completed on the platform."
        ),
        link=_admin_link(booking=booking.id, focus="payout"),
        booking_id=booking.id,
    )


def _ensure_can_cancel(booking: Booking, current_user: User) -> None:
    role = _normalize_role(current_user.role)
    logic_status = _logic_status(booking.status)

    if role in ADMIN_ROLES:
        return

    if role == UserRole.customer.value:
        if booking.customer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed")
        if logic_status in {BookingStatus.completed.value, BookingStatus.refunded.value}:
            raise HTTPException(status_code=400, detail="Completed or refunded bookings cannot be cancelled")
        return

    if role == UserRole.barber.value:
        _assert_barber_owns_booking(booking, current_user)
        return

    raise HTTPException(status_code=403, detail="Not allowed")


def _cancel_booking(booking: Booking) -> None:
    if _logic_status(booking.status) == BookingStatus.refunded.value:
        raise HTTPException(status_code=400, detail="Refunded bookings cannot be cancelled")

    booking.status = BookingStatus.cancelled
    if booking.payment_status == PaymentStatus.paid:
        booking.refund_requested = True


@router.post("/bookings", response_model=BookingResponse)
def create_booking(
    booking_data: BookingCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _normalize_role(current_user.role) != UserRole.customer.value:
        raise HTTPException(status_code=403, detail="Only customers can create bookings")

    barber = db.query(Barber).filter(Barber.id == booking_data.barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barber not found")

    barber_user = db.query(User).filter(User.id == barber.user_id).first()
    if not barber_user:
        raise HTTPException(status_code=404, detail="Barber user not found")

    scheduled_time = _normalize_datetime(booking_data.scheduled_time)
    _assert_within_availability(barber, barber_user, scheduled_time)
    selected_services = _resolve_selected_services(db, barber, booking_data.service_ids)

    existing_booking = (
        db.query(Booking)
        .filter(
            Booking.barber_id == barber.id,
            Booking.scheduled_time == scheduled_time,
            Booking.status.notin_([BookingStatus.cancelled, BookingStatus.rejected, BookingStatus.refunded]),
        )
        .first()
    )
    if existing_booking:
        raise HTTPException(status_code=400, detail="This time slot is already booked")

    price = round(sum(float(service.price or 0) for service in selected_services), 2)
    commission, barber_earnings = calculate_split_amounts(price)
    service_name = ", ".join(str(service.name or "").strip() for service in selected_services) or (booking_data.service_name or "Haircut").strip() or "Haircut"

    new_booking = Booking(
        customer_id=current_user.id,
        barber_id=barber.id,
        scheduled_time=scheduled_time,
        service_name=service_name,
        price=price,
        commission_amount=commission,
        barber_earnings=barber_earnings,
        status=BookingStatus.pending,
        payment_status=PaymentStatus.unpaid,
        refund_requested=False,
        escrow_released=False,
    )

    db.add(new_booking)
    db.flush()
    for service in selected_services:
        db.add(
            BookingService(
                booking_id=new_booking.id,
                service_id=service.id,
                price=float(service.price or 0),
            )
        )
    _notify_booking_created(db, new_booking, current_user, barber_user)
    db.commit()
    db.refresh(new_booking)
    return _booking_to_response(_get_booking_or_404(db, new_booking.id))


@router.patch("/bookings/{booking_id}/approve", response_model=BookingResponse)
def approve_booking(
    booking_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_booking_status_schema(db)
    booking = _get_booking_or_404(db, booking_id)
    _assert_barber_owns_booking(booking, current_user)
    _assert_verified_barber(booking.barber)

    if _logic_status(booking.status) != BookingStatus.pending.value:
        raise HTTPException(status_code=400, detail="Only pending bookings can be approved")

    booking.status = BookingStatus.approved
    _notify_booking_approved(db, booking)
    _notify_chat_available(db, booking)
    db.commit()
    db.refresh(booking)
    return _booking_to_response(_get_booking_or_404(db, booking.id))


@router.patch("/bookings/{booking_id}/reject", response_model=BookingResponse)
def reject_booking(
    booking_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_404(db, booking_id)
    _assert_barber_owns_booking(booking, current_user)
    _assert_verified_barber(booking.barber)

    if _logic_status(booking.status) != BookingStatus.pending.value:
        raise HTTPException(status_code=400, detail="Only pending bookings can be rejected")

    booking.status = BookingStatus.rejected
    _notify_booking_rejected(db, booking)
    db.commit()
    db.refresh(booking)
    return _booking_to_response(_get_booking_or_404(db, booking.id))


@router.post("/bookings/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(
    booking_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_404(db, booking_id)
    actor_role = _normalize_role(current_user.role)
    _ensure_can_cancel(booking, current_user)
    _cancel_booking(booking)
    _notify_booking_cancelled(db, booking, actor_role)

    db.commit()
    db.refresh(booking)
    return _booking_to_response(_get_booking_or_404(db, booking.id))


@router.patch("/bookings/{booking_id}/status", response_model=BookingResponse)
def update_booking_status(
    booking_id: int,
    new_status: BookingStatus,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_booking_status_schema(db)
    booking = _get_booking_or_404(db, booking_id)
    normalized_target = BookingStatus.approved if new_status == BookingStatus.accepted else new_status

    if normalized_target == BookingStatus.cancelled:
        actor_role = _normalize_role(current_user.role)
        _ensure_can_cancel(booking, current_user)
        _cancel_booking(booking)
        _notify_booking_cancelled(db, booking, actor_role)
    elif normalized_target == BookingStatus.approved:
        _assert_barber_owns_booking(booking, current_user)
        _assert_verified_barber(booking.barber)
        if _logic_status(booking.status) != BookingStatus.pending.value:
            raise HTTPException(status_code=400, detail="Only pending bookings can be approved")
        booking.status = BookingStatus.approved
        _notify_booking_approved(db, booking)
        _notify_chat_available(db, booking)
    elif normalized_target == BookingStatus.rejected:
        _assert_barber_owns_booking(booking, current_user)
        _assert_verified_barber(booking.barber)
        if _logic_status(booking.status) != BookingStatus.pending.value:
            raise HTTPException(status_code=400, detail="Only pending bookings can be rejected")
        booking.status = BookingStatus.rejected
        _notify_booking_rejected(db, booking)
    elif normalized_target == BookingStatus.no_show:
        role = _normalize_role(current_user.role)
        if role not in {UserRole.barber.value, *ADMIN_ROLES}:
            raise HTTPException(status_code=403, detail="Not allowed")
        if role == UserRole.barber.value:
            _assert_barber_owns_booking(booking, current_user)
        if _logic_status(booking.status) not in {BookingStatus.approved.value, BookingStatus.paid.value}:
            raise HTTPException(status_code=400, detail="Only approved or paid bookings can be marked no_show")
        booking.status = BookingStatus.no_show
    else:
        raise HTTPException(status_code=400, detail="Use dedicated endpoints for this status change")

    db.commit()
    db.refresh(booking)
    return _booking_to_response(_get_booking_or_404(db, booking.id))


@router.post("/bookings/{booking_id}/pay")
@router.post("/bookings/{booking_id}/initialize-payment", include_in_schema=False)
def pay_for_booking(
    booking_id: int,
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_404(db, booking_id)

    if booking.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    _assert_verified_barber(booking.barber)

    if booking.payment_status == PaymentStatus.paid:
        raise HTTPException(status_code=400, detail="Booking already paid")

    logic_status = _logic_status(booking.status)
    if logic_status == BookingStatus.pending.value:
        raise HTTPException(status_code=400, detail="Booking not yet approved")
    if logic_status != BookingStatus.approved.value:
        raise HTTPException(status_code=400, detail="Booking cannot be paid for")

    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Payment gateway is not configured")

    amount = int(booking.price * 100)
    callback_base = str(request.base_url).rstrip("/")
    callback_url = (
        f"{callback_base}/payment-return?"
        f"{urlencode({'booking': booking.id, 'barber': booking.barber_id})}"
    )
    headers = {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "email": current_user.email,
        "amount": amount,
        "reference": booking.payment_reference or f"trimly-booking-{booking.id}-{int(datetime.utcnow().timestamp())}",
        "callback_url": callback_url,
        "metadata": {
            "booking_id": booking.id,
            "barber_id": booking.barber_id,
            "split_mode": "subaccount_percentage_charge",
            "commission_rate": COMMISSION_RATE,
        },
    }

    subaccount_code = str(booking.barber.paystack_subaccount_code or "").strip() if booking.barber else ""
    if not subaccount_code:
        kyc = db.query(BarberKYC).filter(BarberKYC.barber_id == booking.barber.id).first()
        if not kyc:
            raise HTTPException(status_code=400, detail="Barber payout details not set")
        try:
            subaccount_code = ensure_barber_subaccount(booking.barber, booking.barber.user, kyc)
        except RuntimeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        db.commit()
        db.refresh(booking.barber)

    payload["subaccount"] = subaccount_code

    try:
        response = requests.post(
            "https://api.paystack.co/transaction/initialize",
            json=payload,
            headers=headers,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Unable to reach Paystack") from exc

    try:
        result = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid response from Paystack") from exc

    if response.status_code != 200 or not result.get("status"):
        raise HTTPException(
            status_code=400,
            detail=result.get("message") or result.get("detail") or response.text or "Payment initialization failed",
        )

    booking.payment_reference = result["data"]["reference"]
    booking.payout_status = PAYOUT_STATUS_PAYMENT_INITIALIZED
    db.commit()

    return {
        "payment_url": result["data"]["authorization_url"],
        "authorization_url": result["data"]["authorization_url"],
        "reference": result["data"]["reference"],
        "callback_url": callback_url,
    }


@router.get("/payment/verify/{reference}")
def verify_payment(
    reference: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _booking_query(db).filter(Booking.payment_reference == reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_owner = booking.customer_id == current_user.id
    is_barber = bool(booking.barber and booking.barber.user_id == current_user.id)
    is_admin = _normalize_role(current_user.role) in ADMIN_ROLES
    if not (is_owner or is_barber or is_admin):
        raise HTTPException(status_code=403, detail="Not allowed")

    return _verify_paystack_payment_reference(db, booking, reference)


@router.get("/payment/verify-public/{reference}")
def verify_payment_public(reference: str, db: Session = Depends(get_db)):
    booking = _booking_query(db).filter(Booking.payment_reference == reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return _verify_paystack_payment_reference(db, booking, reference)


@router.get("/payment-return")
def payment_return(
    reference: str | None = None,
    trxref: str | None = None,
    booking: int | None = None,
    barber: int | None = None,
    db: Session = Depends(get_db),
):
    resolved_reference = str(reference or trxref or "").strip()
    destination = f"{_frontend_public_base()}/payment-status.html"
    params: dict[str, str | int] = {}
    if booking:
        params["booking"] = booking
    if barber:
        params["barber"] = barber
    if resolved_reference:
        params["reference"] = resolved_reference
    else:
        params["payment_error"] = "Payment reference missing"
        return RedirectResponse(url=f"{destination}?{urlencode(params)}", status_code=303)

    booking_record = _booking_query(db).filter(Booking.payment_reference == resolved_reference).first()
    if not booking_record:
        params["payment_error"] = "Booking not found for this payment"
        return RedirectResponse(url=f"{destination}?{urlencode(params)}", status_code=303)

    try:
        _verify_paystack_payment_reference(db, booking_record, resolved_reference)
        params["confirmed"] = "1"
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else "Payment verification failed"
        params["payment_error"] = detail

    return RedirectResponse(url=f"{destination}?{urlencode(params)}", status_code=303)


@router.post("/admin/bookings/{booking_id}/mark-completed", response_model=BookingResponse)
@router.post("/admin/bookings/{booking_id}/release-escrow", response_model=BookingResponse, include_in_schema=False)
def mark_booking_completed_for_admin(
    booking_id: int,
    current_user=Depends(require_any_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_404(db, booking_id)
    _assert_verified_barber(booking.barber)
    mark_booking_completed(booking)
    booking.refund_requested = False
    award_completion_points(booking.customer)
    if booking.customer and booking.customer.referred_by_user_id:
        referrer = db.query(User).filter(User.id == booking.customer.referred_by_user_id).first()
        customer_completed_count = (
            db.query(Booking)
            .filter(Booking.customer_id == booking.customer_id, Booking.status == BookingStatus.completed)
            .count()
        )
        maybe_award_referral_bonus(booking.customer, referrer, customer_completed_count)
    _notify_booking_completed(db, booking)

    db.commit()
    db.refresh(booking)
    return _booking_to_response(_get_booking_or_404(db, booking.id))


@router.get("/barber/{barber_id}/availability")
def get_availability(
    barber_id: int,
    selected_date: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
):
    barber_profile = db.query(Barber).filter(Barber.id == barber_id).first()
    if not barber_profile:
        raise HTTPException(status_code=404, detail="Barber not found")

    barber_user = db.query(User).filter(User.id == barber_profile.user_id).first()
    if not barber_user or _normalize_role(barber_user.role) != UserRole.barber.value:
        raise HTTPException(status_code=404, detail="Barber not found")

    if barber_profile.kyc_status != "verified" or not barber_profile.is_available:
        return []

    target_date = selected_date or datetime.now().date()
    day_name = target_date.strftime("%A").lower()
    configured_days = _parse_available_days(barber_profile.available_days)
    if configured_days and day_name not in configured_days:
        return []

    start_time, end_time = _booking_window_for_barber(barber_profile, barber_user)
    if not start_time or not end_time:
        raise HTTPException(status_code=400, detail="Barber working hours not set")

    if start_time >= end_time:
        raise HTTPException(status_code=400, detail="Barber availability is invalid")

    start_dt = datetime.combine(target_date, start_time)
    end_dt = datetime.combine(target_date, end_time)
    booked_slots = (
        db.query(Booking)
        .filter(
            Booking.barber_id == barber_profile.id,
            Booking.scheduled_time >= start_dt,
            Booking.scheduled_time < end_dt,
            Booking.status.notin_([BookingStatus.cancelled, BookingStatus.rejected, BookingStatus.refunded]),
        )
        .all()
    )
    booked_times = {
        _normalize_datetime(booking.scheduled_time).replace(second=0, microsecond=0)
        for booking in booked_slots
    }

    now = datetime.now()
    available_slots = []
    current_slot = start_dt
    while current_slot < end_dt:
        slot_key = current_slot.replace(second=0, microsecond=0)
        if slot_key not in booked_times and (target_date > now.date() or current_slot > now):
            available_slots.append(slot_key)
        current_slot += timedelta(hours=1)

    return available_slots


@router.get("/bookings", response_model=list[BookingResponse])
def get_all_bookings(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dispatch_due_booking_reminders(db)
    role = _normalize_role(current_user.role)
    base_query = _booking_query(db)

    if role in ADMIN_ROLES:
        bookings = base_query.order_by(Booking.created_at.desc()).all()
        return [_booking_to_response(booking) for booking in bookings]

    if role == UserRole.customer.value:
        bookings = base_query.filter(Booking.customer_id == current_user.id).order_by(Booking.created_at.desc()).all()
        return [_booking_to_response(booking) for booking in bookings]

    if role == UserRole.barber.value:
        barber_profile = db.query(Barber).filter(Barber.user_id == current_user.id).first()
        if not barber_profile:
            return []
        bookings = base_query.filter(Booking.barber_id == barber_profile.id).order_by(Booking.created_at.desc()).all()
        return [_booking_to_response(booking) for booking in bookings]

    raise HTTPException(status_code=403, detail="Not allowed")
