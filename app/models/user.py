import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Time
from sqlalchemy.sql import func

from app.db.session import Base


class UserRole(str, enum.Enum):
    customer = "customer"
    barber = "barber"
    admin = "admin"
    super_admin = "super_admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.customer)
    is_active = Column(Boolean, default=True)
    accepted_terms = Column(Boolean, default=False, nullable=False)
    admin_approved = Column(Boolean, default=False, nullable=False)
    admin_approved_at = Column(DateTime, nullable=True)
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    work_start = Column(Time, nullable=True)
    work_end = Column(Time, nullable=True)
    reset_otp = Column(String, nullable=True)
    reset_otp_expires_at = Column(DateTime, nullable=True)
    reset_password_token_hash = Column(String, nullable=True)
    reset_password_expires_at = Column(DateTime, nullable=True)
    referral_code = Column(String, unique=True, nullable=True, index=True)
    referred_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    loyalty_points = Column(Integer, default=0, nullable=False)
    referral_reward_granted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
