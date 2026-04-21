from datetime import datetime

from app.core.config import BOOKINGS_REQUIRE_BARBER_APPROVAL, FRONTEND_URL, RESEND_API_KEY

BOOKING_EMAIL_FROM = "Trimly <hello@trimly.com.ng>"


def send_booking_approved_payment_email(
    to_email: str,
    customer_name: str,
    service_name: str,
    scheduled_time: datetime | None,
    payment_due_at: datetime | None,
    booking_link: str,
) -> None:
    due_copy = (
        f"Complete payment before {payment_due_at.strftime('%b %d, %I:%M %p')} to keep your slot."
        if payment_due_at
        else "Complete payment now to keep your slot."
    )
    subject = "Your Trimly booking was approved. Pay now to secure it."
    html = _wrap_email(
        eyebrow="Trimly Booking Update",
        headline=f"Your booking is approved, { _first_name(customer_name) }",
        intro=(
            f"Your {service_name} booking for {scheduled_time.strftime('%b %d, %I:%M %p') if scheduled_time else 'your selected time'} "
            f"has been approved. {due_copy}"
        ),
        cta_label="Pay Now",
        cta_url=booking_link,
        footer="Once payment is completed, the appointment becomes fully locked in on Trimly.",
    )
    _send_resend_email(to_email, subject, html)


def send_booking_payment_ready_email(
    to_email: str,
    customer_name: str,
    service_name: str,
    scheduled_time: datetime | None,
    payment_due_at: datetime | None,
    booking_link: str,
) -> None:
    due_copy = (
        f"Complete payment before {payment_due_at.strftime('%b %d, %I:%M %p')} to keep your slot."
        if payment_due_at
        else "Complete payment now to keep your slot."
    )
    subject = "Pay now to secure your Trimly booking"
    html = _wrap_email(
        eyebrow="Trimly Booking Update",
        headline=f"Your booking is ready, {_first_name(customer_name)}",
        intro=(
            f"Your {service_name} booking for {scheduled_time.strftime('%b %d, %I:%M %p') if scheduled_time else 'your selected time'} "
            f"is waiting for payment. {due_copy}"
        ),
        cta_label="Pay Now",
        cta_url=booking_link,
        footer="Once payment is completed, the appointment becomes fully locked in on Trimly.",
    )
    _send_resend_email(to_email, subject, html)


def send_booking_payment_reminder_email(
    to_email: str,
    customer_name: str,
    service_name: str,
    scheduled_time: datetime | None,
    payment_due_at: datetime | None,
    booking_link: str,
    reminder_label: str,
) -> None:
    subject = f"Trimly reminder: pay now to keep your {service_name} booking"
    html = _wrap_email(
        eyebrow="Trimly Payment Reminder",
        headline=f"{reminder_label}: your slot is still waiting",
        intro=(
            f"{_first_name(customer_name)}, your {service_name} booking for "
            f"{scheduled_time.strftime('%b %d, %I:%M %p') if scheduled_time else 'your selected time'} "
            f"is {'approved but not yet paid' if BOOKINGS_REQUIRE_BARBER_APPROVAL else 'still waiting for payment'}."
        ),
        cta_label="Complete Payment",
        cta_url=booking_link,
        footer=(
            f"Payment window ends {payment_due_at.strftime('%b %d, %I:%M %p')}." if payment_due_at else
            "Complete payment as soon as possible to prevent the slot from being released."
        ),
    )
    _send_resend_email(to_email, subject, html)


def send_booking_expired_email(
    to_email: str,
    customer_name: str,
    service_name: str,
    scheduled_time: datetime | None,
    rebook_link: str,
) -> None:
    subject = "Your Trimly payment window expired"
    html = _wrap_email(
        eyebrow="Trimly Booking Update",
        headline=f"Your booking slot was released, {_first_name(customer_name)}",
        intro=(
            f"The payment window for your {service_name} booking "
            f"on {scheduled_time.strftime('%b %d, %I:%M %p') if scheduled_time else 'your selected time'} expired before payment was completed."
        ),
        cta_label="Book Another Slot",
        cta_url=rebook_link,
        footer="You can return to Trimly anytime to choose another available slot.",
    )
    _send_resend_email(to_email, subject, html)


def _wrap_email(*, eyebrow: str, headline: str, intro: str, cta_label: str, cta_url: str, footer: str) -> str:
    return f"""
    <div style="background:#0b0f14;padding:32px 16px;font-family:Arial,sans-serif;color:#f5f7fa;">
      <div style="max-width:620px;margin:0 auto;background:#131a22;border:1px solid #273140;border-radius:18px;overflow:hidden;">
        <div style="padding:32px;background:linear-gradient(135deg,#111827 0%,#171f2b 60%,#221404 100%);border-bottom:1px solid #273140;">
          <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#f59e0b;">{eyebrow}</p>
          <h1 style="margin:0 0 16px;font-size:32px;line-height:1.15;color:#ffffff;">{headline}</h1>
          <p style="margin:0;font-size:15px;line-height:1.8;color:#d5dde7;">{intro}</p>
        </div>
        <div style="padding:24px 32px 32px;">
          <a href="{cta_url}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#f59e0b;color:#111827;text-decoration:none;font-weight:700;font-size:15px;">{cta_label}</a>
          <div style="margin-top:20px;padding:18px;border:1px solid #2f3948;border-radius:14px;background:#0f141c;">
            <p style="margin:0;font-size:14px;line-height:1.7;color:#b5c0cd;">{footer}</p>
          </div>
        </div>
      </div>
    </div>
    """.strip()


def _send_resend_email(to_email: str, subject: str, html: str) -> None:
    if not RESEND_API_KEY:
        return

    try:
        import resend
    except ImportError:
        return

    resend.api_key = RESEND_API_KEY
    resend.Emails.send(
        {
            "from": BOOKING_EMAIL_FROM,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
    )


def _first_name(full_name: str) -> str:
    cleaned = str(full_name or "").strip()
    return cleaned.split()[0] if cleaned else "there"
