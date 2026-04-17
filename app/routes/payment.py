from datetime import datetime
import hashlib
import hmac
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import PAYSTACK_SECRET_KEY
from app.core.security import get_current_user, require_any_role, require_role
from app.db.session import get_db
from app.enums.booking_status import BookingStatus
from app.enums.payment_status import PaymentStatus
from app.models.barber import Barber
from app.models.booking import Booking
from app.models.user import UserRole
from app.services.escrow_service import (
    PAYOUT_STATUS_REFUNDED,
    PAYOUT_STATUS_REFUND_REQUESTED,
    apply_paid_booking_state,
)
from app.services.notification_service import create_notifications, format_notification_time, notify_admins

router = APIRouter()


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


def _get_booking_or_404(db: Session, booking_id: int) -> Booking:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


def _dashboard_link(section: str = "bookings", **params) -> str:
    query = urlencode({key: value for key, value in params.items() if value is not None})
    target = "/static/barber-queue.html" if section == "barber_queue" else "/static/dashboard-bookings.html"
    return f"{target}{f'?{query}' if query else ''}"


@router.post("/payment/webhook")
@router.post("/paystack/webhook")
async def paystack_webhook(request: Request, db: Session = Depends(get_db)):
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Payment gateway is not configured")

    payload = await request.body()
    signature = request.headers.get("x-paystack-signature")

    computed = hmac.new(
        PAYSTACK_SECRET_KEY.encode(),
        payload,
        hashlib.sha512,
    ).hexdigest()

    if computed != signature:
        raise HTTPException(status_code=400, detail="Invalid signature")

    data = await request.json()
    if data.get("event") != "charge.success":
        return {"status": "ignored"}

    reference = data.get("data", {}).get("reference")
    if not reference:
        return {"status": "ignored"}

    booking = db.query(Booking).filter(Booking.payment_reference == reference).first()
    if booking:
        barber = db.query(Barber).filter(Barber.id == booking.barber_id).first()
        if barber and barber.kyc_status == "verified":
            already_paid = booking.payment_status == PaymentStatus.paid
            apply_paid_booking_state(booking)
            if not already_paid:
                recipient_ids = [booking.customer_id]
                if barber.user_id:
                    recipient_ids.append(barber.user_id)
                create_notifications(
                    db,
                    user_ids=recipient_ids,
                    notification_type="booking_paid",
                    title="Payment confirmed",
                    message=(
                        f"Payment for {booking.service_name} on "
                        f"{format_notification_time(booking.scheduled_time)} has been confirmed."
                    ),
                    link=_dashboard_link(section="bookings", booking=booking.id, focus="booking"),
                    booking_id=booking.id,
                )
            db.commit()

    return {"status": "ok"}


@router.post("/payments/refund-request/{booking_id}")
def request_refund(
    booking_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_404(db, booking_id)
    role = _normalize_role(current_user.role)

    is_customer = booking.customer_id == current_user.id
    is_barber = bool(booking.barber and booking.barber.user_id == current_user.id)
    is_admin = role in ADMIN_ROLES
    if not (is_customer or is_barber or is_admin):
        raise HTTPException(status_code=403, detail="Not allowed")

    if booking.payment_status != PaymentStatus.paid:
        raise HTTPException(status_code=400, detail="Refund can only be requested for paid bookings")

    booking.refund_requested = True
    booking.payout_status = PAYOUT_STATUS_REFUND_REQUESTED
    notify_admins(
        db,
        notification_type="refund_requested",
        title="Refund request raised",
        message=(
            f"Booking #{booking.id} has a refund request for "
            f"{booking.service_name} on {format_notification_time(booking.scheduled_time)}."
        ),
        link=f"/admin?{urlencode({'booking': booking.id, 'focus': 'refund'})}",
        booking_id=booking.id,
    )
    db.commit()

    return {
        "message": "Refund request submitted",
        "booking_id": booking.id,
        "refund_requested": True,
        "requested_at": datetime.utcnow().isoformat(),
    }


@router.post("/admin/payments/{booking_id}/refund")
def admin_refund_booking(
    booking_id: int,
    current_user=Depends(require_any_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_404(db, booking_id)
    if booking.payment_status != PaymentStatus.paid:
        raise HTTPException(status_code=400, detail="Only paid bookings can be refunded")

    booking.payment_status = PaymentStatus.refunded
    booking.status = BookingStatus.refunded
    booking.refund_requested = False
    booking.escrow_released = False
    booking.payout_status = PAYOUT_STATUS_REFUNDED
    recipient_ids = [booking.customer_id]
    barber = db.query(Barber).filter(Barber.id == booking.barber_id).first()
    if barber and barber.user_id:
        recipient_ids.append(barber.user_id)
    create_notifications(
        db,
        user_ids=recipient_ids,
        notification_type="booking_refunded",
        title="Booking refunded",
        message=(
            f"Booking #{booking.id} for {booking.service_name} has been marked as refunded."
        ),
        link=_dashboard_link(section="barber_queue", booking=booking.id, focus="booking"),
        booking_id=booking.id,
    )
    notify_admins(
        db,
        notification_type="booking_refunded_admin",
        title="Refund completed",
        message=f"Booking #{booking.id} for {booking.service_name} was marked as refunded.",
        link=f"/admin?{urlencode({'booking': booking.id, 'focus': 'refund'})}",
        booking_id=booking.id,
    )
    db.commit()

    return {"message": "Booking refunded successfully", "booking_id": booking.id}
