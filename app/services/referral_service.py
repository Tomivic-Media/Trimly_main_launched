import secrets
import string

from app.models.booking import Booking
from app.models.user import User

LOYALTY_POINTS_PER_COMPLETED_BOOKING = 20
REFERRAL_REWARD_POINTS = 50


def generate_referral_code(seed_text: str = "") -> str:
    cleaned = "".join(ch for ch in (seed_text or "").upper() if ch.isalnum())[:4]
    suffix = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    return f"{cleaned}{suffix}" if cleaned else suffix


def award_completion_points(user: User | None) -> None:
    if not user:
        return
    user.loyalty_points = int(user.loyalty_points or 0) + LOYALTY_POINTS_PER_COMPLETED_BOOKING


def maybe_award_referral_bonus(referred_user: User | None, referrer: User | None, completed_bookings_count: int) -> bool:
    if not referred_user or not referrer:
        return False
    if referred_user.referral_reward_granted:
        return False
    if completed_bookings_count != 1:
        return False

    referrer.loyalty_points = int(referrer.loyalty_points or 0) + REFERRAL_REWARD_POINTS
    referred_user.referral_reward_granted = True
    return True
