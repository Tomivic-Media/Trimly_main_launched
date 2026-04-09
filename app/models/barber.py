from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Time
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.session import Base


class Barber(Base):
    __tablename__ = "barbers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shop_name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    bio = Column(String, nullable=True)
    haircut_price = Column(Float, nullable=False)
    beard_trim_price = Column(Float, nullable=True)
    other_services = Column(String, nullable=True)
    barber_name = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)
    cover_image_url = Column(String, nullable=True)
    portfolio_image_urls = Column(String, nullable=True)
    is_available = Column(Boolean, default=True)
    available_days = Column(String, nullable=False, default="")
    available_start_time = Column(Time, nullable=True)
    available_end_time = Column(Time, nullable=True)
    kyc_status = Column(String, nullable=False, default="pending")
    kyc_submitted_at = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String, nullable=True)

    # Paystack transfer recipient code used for automatic payouts.
    transfer_recipient_code = Column(String, nullable=True)
    paystack_subaccount_code = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    kyc_records = relationship("BarberKYC", back_populates="barber", cascade="all, delete-orphan")
    disputes = relationship("Dispute", back_populates="barber", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="barber", cascade="all, delete-orphan")
    services = relationship("BarberService", back_populates="barber", cascade="all, delete-orphan")
