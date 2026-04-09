from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.enums.booking_status import BookingStatus
from app.models.booking import Booking
from app.models.user import UserRole
from app.services.notification_service import create_notifications, format_notification_time

REMINDER_WINDOW_MINUTES = 120


def _booking_logic_status(status) -> str:
    value = str(status.value if hasattr(status, "value") else status or "").lower()
    return "approved" if value == "accepted" else value


def dispatch_due_booking_reminders(db: Session) -> int:
    now = datetime.utcnow()
    upper_bound = now + timedelta(minutes=REMINDER_WINDOW_MINUTES)
    bookings = (
        db.query(Booking)
        .filter(
            Booking.scheduled_time >= now,
            Booking.scheduled_time <= upper_bound,
        )
        .all()
    )

    reminders_created = 0
    for booking in bookings:
        if _booking_logic_status(booking.status) not in {BookingStatus.approved.value, BookingStatus.paid.value}:
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
                link=f"/static/dashboard.html?booking={booking.id}&focus=booking",
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
                link=f"/static/dashboard.html?booking={booking.id}&focus=booking",
                booking_id=booking.id,
            )
            booking.barber_reminder_sent_at = now
            reminders_created += 1

    if reminders_created:
        db.commit()
    return reminders_created
