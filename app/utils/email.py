import anyio
from urllib.parse import urlencode

from app.core.config import EMAIL_FROM, PASSWORD_RESET_URL, PUBLIC_API_URL, RESEND_API_KEY

PASSWORD_RESET_EMAIL_FROM_FALLBACK = "Trimly <hello@trimly.com.ng>"
VERIFICATION_EMAIL_FROM_FALLBACK = "Trimly <hello@trimly.com.ng>"


async def send_password_reset_email(to_email: str, token: str) -> None:
    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured")

    query = urlencode({"token": token})
    separator = "&" if "?" in PASSWORD_RESET_URL else "?"
    reset_link = f"{PASSWORD_RESET_URL}{separator}{query}"

    html = f"""
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

    await _send_with_fallback(
        to_email=to_email,
        subject="Reset your Trimly password",
        html=html,
        fallback_sender=PASSWORD_RESET_EMAIL_FROM_FALLBACK,
    )


async def send_email_verification_email(to_email: str, token: str) -> None:
    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured")

    verify_link = f"{PUBLIC_API_URL}/auth/verify-email?{urlencode({'token': token})}"
    html = f"""
    <div style=\"background:#0b0f14;padding:32px 16px;font-family:Arial,sans-serif;color:#f5f7fa;\">
      <div style=\"max-width:560px;margin:0 auto;background:#131a22;border:1px solid #273140;border-radius:16px;padding:32px;\">
        <p style=\"margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#f59e0b;\">Trimly</p>
        <h1 style=\"margin:0 0 16px;font-size:28px;line-height:1.2;color:#ffffff;\">Verify your email</h1>
        <p style=\"margin:0 0 16px;font-size:15px;line-height:1.7;color:#c8d1dc;\">
          Confirm your email address to activate your Trimly account and start booking securely.
        </p>
        <p style=\"margin:24px 0;\">
          <a href=\"{verify_link}\" style=\"display:inline-block;padding:14px 22px;border-radius:10px;background:#f59e0b;color:#111827;text-decoration:none;font-weight:700;\">Verify Email</a>
        </p>
        <p style=\"margin:0;font-size:13px;line-height:1.7;color:#94a3b8;word-break:break-all;\">
          If the button does not work, copy and paste this link into your browser:<br />
          <a href=\"{verify_link}\" style=\"color:#f8b84e;text-decoration:none;\">{verify_link}</a>
        </p>
      </div>
    </div>
    """.strip()

    await _send_with_fallback(
        to_email=to_email,
        subject="Verify your Trimly email",
        html=html,
        fallback_sender=VERIFICATION_EMAIL_FROM_FALLBACK,
    )


async def _send_with_fallback(*, to_email: str, subject: str, html: str, fallback_sender: str) -> None:
    senders: list[str] = []
    configured_sender = str(EMAIL_FROM or "").strip()
    if configured_sender:
        senders.append(configured_sender)
    if fallback_sender not in senders:
        senders.append(fallback_sender)

    if not senders:
        raise RuntimeError("No email sender is configured")

    last_error: Exception | None = None
    for from_address in senders:
        try:
            await anyio.to_thread.run_sync(
                _send_resend_html_email,
                from_address,
                to_email,
                subject,
                html,
            )
            return
        except Exception as exc:
            last_error = exc
            continue

    if last_error:
        raise last_error

    raise RuntimeError("Unable to send email")


def _send_resend_html_email(from_address: str, to_email: str, subject: str, html: str) -> None:
    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured")

    try:
        import resend
    except ImportError as exc:
        raise RuntimeError("The resend package is not installed") from exc

    resend.api_key = RESEND_API_KEY
    result = resend.Emails.send(
        {
            "from": from_address,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
    )
    if not result:
        raise RuntimeError("Resend returned an empty response")
