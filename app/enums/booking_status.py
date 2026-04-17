from enum import Enum


class BookingStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    paid = "paid"
    accepted = "accepted"
    expired = "expired"
    rejected = "rejected"
    completed = "completed"
    cancelled = "cancelled"
    disputed = "disputed"
    refunded = "refunded"
    no_show = "no_show"
