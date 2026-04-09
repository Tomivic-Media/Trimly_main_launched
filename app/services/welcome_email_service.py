import anyio

from app.core.config import FRONTEND_URL, RESEND_API_KEY

WELCOME_FROM = "Trimly <hello@trimly.com.ng>"


async def send_customer_welcome_email(to_email: str, full_name: str) -> None:
    subject = "Welcome to Trimly 🎉 Your grooming just became easier"
    html = _build_customer_welcome_html(full_name)
    await anyio.to_thread.run_sync(_send_resend_email, to_email, subject, html)


async def send_barber_welcome_email(to_email: str, full_name: str) -> None:
    subject = "Welcome to Trimly Barber Network ✂️ Start getting customers"
    html = _build_barber_welcome_html(full_name)
    await anyio.to_thread.run_sync(_send_resend_email, to_email, subject, html)


def _build_customer_welcome_html(full_name: str) -> str:
    first_name = _first_name(full_name)
    cta_url = FRONTEND_URL.rstrip("/")
    return _wrap_email(
        eyebrow="Trimly",
        headline=f"Welcome to Trimly, {first_name}",
        intro=(
            "Your grooming routine just got easier. Trimly helps you discover trusted barbers, "
            "book without the back-and-forth, and track every appointment from request to haircut."
        ),
        sections=[
            (
                "Discover Barbers",
                "Browse barber profiles, compare haircut prices, read bios, and check shop locations before you decide who to book.",
            ),
            (
                "Book Easily",
                "Choose the time that works for you and send a booking request in just a few taps.",
            ),
            (
                "Smart Booking Flow",
                "Your barber reviews the request first, so every appointment is confirmed by the person who will actually serve you.",
            ),
            (
                "Secure Payments",
                "Payment only opens after the barber approves your booking, so you never pay for an unconfirmed slot.",
            ),
            (
                "Booking Tracking",
                "Follow each appointment through its full journey: pending, approved, and completed.",
            ),
            (
                "Rate & Review",
                "After your haircut, leave a rating and review to help other customers book with confidence.",
            ),
            (
                "Convenience",
                "No more long waits or guessing who is available. Trimly keeps your next cut organized from start to finish.",
            ),
        ],
        cta_label="Start Booking Now",
        cta_url=cta_url,
        footer=(
            "Ready when you are. Open Trimly, find your next barber, and book in minutes."
        ),
    )


def _build_barber_welcome_html(full_name: str) -> str:
    first_name = _first_name(full_name)
    cta_url = f"{FRONTEND_URL.rstrip('/')}/barber/profile"
    return _wrap_email(
        eyebrow="Trimly Barber Network",
        headline=f"Welcome to Trimly Barber Network, {first_name}",
        intro=(
            "You are now part of a platform built to help barbers grow, stay organized, and turn more availability into real income."
        ),
        sections=[
            (
                "Create Your Barber Profile",
                "Complete your profile with your shop name, location, bio, and haircut price so customers can see exactly what you offer.",
            ),
            (
                "Receive Booking Requests",
                "Once your profile is live, customers can discover you and send booking requests directly through Trimly.",
            ),
            (
                "Approve Bookings",
                "You stay in control of your schedule by approving or rejecting requests before any payment is made.",
            ),
            (
                "Earn Money",
                "Trimly supports the payment flow and commissions process so you can focus on delivering great service.",
            ),
            (
                "Set Working Hours",
                "Define your availability so customers only request slots that match your real working schedule.",
            ),
            (
                "Grow Visibility",
                "A strong profile helps you attract more customers, get discovered faster, and build trust through your presence on the platform.",
            ),
            (
                "Manage Income",
                "Track incoming bookings, completed appointments, and earnings in one place as your business grows.",
            ),
        ],
        cta_label="Complete Your Barber Profile",
        cta_url=cta_url,
        footer=(
            "Finish your profile setup and position yourself to start receiving customers through Trimly."
        ),
    )


def _wrap_email(
    *,
    eyebrow: str,
    headline: str,
    intro: str,
    sections: list[tuple[str, str]],
    cta_label: str,
    cta_url: str,
    footer: str,
) -> str:
    sections_html = "".join(
        f"""
        <div style="padding:18px 0;border-top:1px solid #273140;">
          <h2 style="margin:0 0 8px;font-size:18px;line-height:1.3;color:#ffffff;">{title}</h2>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#c8d1dc;">{copy}</p>
        </div>
        """
        for title, copy in sections
    )

    return f"""
    <div style="background:#0b0f14;padding:32px 16px;font-family:Arial,sans-serif;color:#f5f7fa;">
      <div style="max-width:620px;margin:0 auto;background:#131a22;border:1px solid #273140;border-radius:18px;overflow:hidden;">
        <div style="padding:32px;background:linear-gradient(135deg,#111827 0%,#171f2b 60%,#221404 100%);border-bottom:1px solid #273140;">
          <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#f59e0b;">{eyebrow}</p>
          <h1 style="margin:0 0 16px;font-size:32px;line-height:1.15;color:#ffffff;">{headline}</h1>
          <p style="margin:0;font-size:15px;line-height:1.8;color:#d5dde7;">{intro}</p>
        </div>

        <div style="padding:0 32px 12px;">
          {sections_html}
        </div>

        <div style="padding:12px 32px 32px;">
          <div style="margin:12px 0 24px;padding:18px;border:1px solid #2f3948;border-radius:14px;background:#0f141c;">
            <p style="margin:0;font-size:14px;line-height:1.7;color:#b5c0cd;">{footer}</p>
          </div>
          <a href="{cta_url}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#f59e0b;color:#111827;text-decoration:none;font-weight:700;font-size:15px;">{cta_label}</a>
        </div>
      </div>
    </div>
    """.strip()


def _send_resend_email(to_email: str, subject: str, html: str) -> None:
    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured")

    try:
        import resend
    except ImportError as exc:
        raise RuntimeError("The resend package is not installed") from exc

    resend.api_key = RESEND_API_KEY
    resend.Emails.send(
        {
            "from": WELCOME_FROM,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
    )


def _first_name(full_name: str) -> str:
    cleaned = str(full_name or "").strip()
    return cleaned.split()[0] if cleaned else "there"
