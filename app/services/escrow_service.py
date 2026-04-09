from datetime import datetime

from fastapi import HTTPException

from app.enums.booking_status import BookingStatus
from app.enums.payment_status import PaymentStatus
from app.models.booking import Booking

COMMISSION_RATE = 0.15

PAYOUT_STATUS_PENDING = "pending"
PAYOUT_STATUS_PAYMENT_INITIALIZED = "payment_initialized"
PAYOUT_STATUS_SPLIT_MANAGED = "managed_by_paystack_split"
PAYOUT_STATUS_COMPLETED = "completed_on_platform"
PAYOUT_STATUS_REFUND_REQUESTED = "refund_requested"
PAYOUT_STATUS_REFUNDED = "refunded"


def calculate_split_amounts(amount: float | int | None) -> tuple[float, float]:
    booking_amount = float(amount or 0)
    commission_amount = round(booking_amount * COMMISSION_RATE, 2)
    barber_payout_amount = round(booking_amount - commission_amount, 2)
    return commission_amount, barber_payout_amount


def apply_paid_booking_state(booking: Booking) -> None:
    commission_amount, barber_payout_amount = calculate_split_amounts(booking.price)
    booking.status = BookingStatus.paid
    booking.payment_status = PaymentStatus.paid
    booking.paid_at = booking.paid_at or datetime.utcnow()
    booking.escrow_amount = 0
    booking.commission_amount = commission_amount
    booking.barber_payout_amount = barber_payout_amount
    booking.barber_earnings = barber_payout_amount
    booking.escrow_released = True
    booking.payout_status = PAYOUT_STATUS_SPLIT_MANAGED


def mark_booking_completed(booking: Booking) -> None:
    if booking.status != BookingStatus.paid:
        raise HTTPException(status_code=400, detail="Only paid bookings can be marked completed")

    booking.status = BookingStatus.completed
    booking.escrow_released = True
    if booking.payout_status == PAYOUT_STATUS_SPLIT_MANAGED:
        booking.payout_status = PAYOUT_STATUS_COMPLETED
    elif not booking.payout_status or booking.payout_status == PAYOUT_STATUS_PENDING:
        booking.payout_status = PAYOUT_STATUS_COMPLETED


def release_booking_escrow(booking: Booking) -> None:
    mark_booking_completed(booking)
