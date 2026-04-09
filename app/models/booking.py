from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base
from app.enums.booking_status import BookingStatus
from app.enums.payment_status import PaymentStatus


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=False)

    scheduled_time = Column(DateTime, nullable=False)
    service_name = Column(String, nullable=False, default="Haircut")

    price = Column(Float, nullable=False)
    commission_amount = Column(Float, nullable=True)
    barber_earnings = Column(Float, nullable=True)
    barber_payout_amount = Column(Float, nullable=True)
    escrow_amount = Column(Float, nullable=True)
    escrow_released = Column(Boolean, default=False, nullable=False)
    refund_requested = Column(Boolean, default=False, nullable=False)

    status = Column(Enum(BookingStatus), default=BookingStatus.pending, nullable=False)

    payment_reference = Column(String, nullable=True)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.unpaid, nullable=False)
    paid_at = Column(DateTime, nullable=True)

    payout_status = Column(String, default="pending", nullable=False)
    transfer_reference = Column(String, nullable=True)
    transferred_at = Column(DateTime, nullable=True)
    customer_reminder_sent_at = Column(DateTime, nullable=True)
    barber_reminder_sent_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("User")
    barber = relationship("Barber")
    disputes = relationship("Dispute", back_populates="booking", cascade="all, delete-orphan")
    review = relationship("Review", back_populates="booking", uselist=False, cascade="all, delete-orphan")
    booking_services = relationship("BookingService", back_populates="booking", cascade="all, delete-orphan")
