from datetime import datetime, timedelta

from sqlalchemy.orm import Session, joinedload

from app.enums.booking_status import BookingStatus
from app.enums.payment_status import PaymentStatus
from app.models.barber import Barber
from app.models.booking import Booking
from app.models.user import UserRole
from app.services.notification_service import create_notifications, format_notification_time
from app.services.booking_email_service import (
    send_booking_expired_email,
    send_booking_payment_reminder_email,
)

REMINDER_WINDOW_MINUTES = 120
PAYMENT_REMINDER_MINUTES = (15, 60)
FINAL_PAYMENT_REMINDER_BUFFER_MINUTES = 15


def _booking_logic_status(status) -> str:
    value = str(status.value if hasattr(status, "value") else status or "").lower()
    return "approved" if value == "accepted" else value


def dispatch_due_booking_reminders(db: Session) -> int:
    now = datetime.utcnow()
    upper_bound = now + timedelta(minutes=REMINDER_WINDOW_MINUTES)
    reminders_created = _reconcile_approved_payment_windows(db, now)
    bookings = (
        db.query(Booking)
        .options(joinedload(Booking.barber).joinedload(Barber.user), joinedload(Booking.customer))
        .filter(
            Booking.scheduled_time >= now,
            Booking.scheduled_time <= upper_bound,
        )
        .all()
    )

    for booking in bookings:
        if _booking_logic_status(booking.status) != BookingStatus.paid.value:
            continue

        customer_id = booking.customer_id
        barber_user_id = booking.barber.user_id if booking.barber and booking.barber.user_id else None
        message = (
            f"Reminder: your {booking.service_name} booking is scheduled for "
            f"{format_notification_time(booking.scheduled_time)}."
        )

        if customer_id and not booking.customer_reminder_sent_at:
            create_notifications(
                db,
                user_ids=[customer_id],
                notification_type="booking_reminder",
                title="Upcoming appointment reminder",
                message=message,
                link=f"/static/dashboard-bookings.html?booking={booking.id}&focus=booking",
                booking_id=booking.id,
            )
            booking.customer_reminder_sent_at = now
            reminders_created += 1

        if barber_user_id and not booking.barber_reminder_sent_at:
            create_notifications(
                db,
                user_ids=[barber_user_id],
                notification_type="booking_reminder",
                title="Upcoming customer appointment",
                message=message,
                link=f"/static/barber-queue.html?booking={booking.id}&focus=booking",
                booking_id=booking.id,
            )
            booking.barber_reminder_sent_at = now
            reminders_created += 1

    if reminders_created:
        db.commit()
    return reminders_created


def _reconcile_approved_payment_windows(db: Session, now: datetime) -> int:
    bookings = (
        db.query(Booking)
        .options(joinedload(Booking.barber).joinedload(Barber.user), joinedload(Booking.customer))
        .filter(
            Booking.payment_status == PaymentStatus.unpaid,
            Booking.status.in_([BookingStatus.approved, BookingStatus.accepted]),
        )
        .all()
    )

    changes = 0
    for booking in bookings:
        payment_due_at = booking.payment_due_at
        approved_at = booking.approved_at
        reminder_count = int(booking.payment_reminder_count or 0)
        barber_user_id = booking.barber.user_id if booking.barber and booking.barber.user_id else None
        customer_name = booking.customer.full_name if booking.customer else "there"
        booking_link = f"/static/dashboard-bookings.html?booking={booking.id}&focus=payment"
        rebook_link = f"/static/booking.html?barber={booking.barber_id}"

        if payment_due_at and payment_due_at <= now:
            booking.status = BookingStatus.expired
            booking.payment_due_at = None
            booking.payout_status = "payment_window_expired"
            create_notifications(
                db,
                user_ids=[booking.customer_id, barber_user_id] if barber_user_id else [booking.customer_id],
                notification_type="booking_expired",
                title="Payment window expired",
                message=(
                    f"The payment window for {booking.service_name} on "
                    f"{format_notification_time(booking.scheduled_time)} expired before payment was completed."
                ),
                link=booking_link,
                booking_id=booking.id,
            )
            if booking.customer and booking.customer.email:
                try:
                    send_booking_expired_email(
                        booking.customer.email,
                        customer_name,
                        booking.service_name,
                        booking.scheduled_time,
                        rebook_link,
                    )
                except Exception:
                    pass
            changes += 1
            continue

        if not payment_due_at or not approved_at:
            continue

        stage_to_send = None
        reminder_label = ""
        if reminder_count < 1 and now >= approved_at + timedelta(minutes=PAYMENT_REMINDER_MINUTES[0]):
            stage_to_send = 1
            reminder_label = "Friendly reminder"
        elif reminder_count < 2 and now >= approved_at + timedelta(minutes=PAYMENT_REMINDER_MINUTES[1]):
            stage_to_send = 2
            reminder_label = "Payment still pending"
        elif reminder_count < 3 and now >= payment_due_at - timedelta(minutes=FINAL_PAYMENT_REMINDER_BUFFER_MINUTES):
            stage_to_send = 3
            reminder_label = "Final reminder"

        if not stage_to_send:
            continue

        minutes_left = max(int((payment_due_at - now).total_seconds() // 60), 0)
        create_notifications(
            db,
            user_ids=[booking.customer_id],
            notification_type="booking_payment_reminder",
            title="Pay now to keep your booking",
            message=(
                f"Your {booking.service_name} booking for {format_notification_time(booking.scheduled_time)} is approved. "
                f"Complete payment in Trimly to secure your slot. {minutes_left} minute{'s' if minutes_left != 1 else ''} left."
            ),
            link=booking_link,
            booking_id=booking.id,
        )
        if booking.customer and booking.customer.email:
            try:
                send_booking_payment_reminder_email(
                    booking.customer.email,
                    customer_name,
                    booking.service_name,
                    booking.scheduled_time,
                    payment_due_at,
                    booking_link,
                    reminder_label,
                )
            except Exception:
                pass
        booking.payment_reminder_count = stage_to_send
        changes += 1

    return changes
