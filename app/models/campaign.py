from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.db.session import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="draft")
    max_applications = Column(Integer, nullable=False, default=50)
    max_winners = Column(Integer, nullable=False, default=25)
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    selection_ran_at = Column(DateTime, nullable=True)
    application_count = Column(Integer, nullable=False, default=0)
    winner_count = Column(Integer, nullable=False, default=0)
    auto_notify_non_winners = Column(Boolean, nullable=False, default=True)
    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CampaignBarber(Base):
    __tablename__ = "campaign_barbers"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=False, index=True)
    allocation_limit = Column(Integer, nullable=True)
    allocation_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CampaignApplication(Base):
    __tablename__ = "campaign_applications"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    email = Column(String, nullable=False, index=True)
    first_name = Column(String, nullable=False)
    surname = Column(String, nullable=False)
    address = Column(Text, nullable=False)
    phone = Column(String, nullable=True)
    social_handles = Column(Text, nullable=True)
    how_heard_about_us = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="submitted")
    submitted_at = Column(DateTime, nullable=False, server_default=func.now())
    selected_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)


class CampaignWinner(Base):
    __tablename__ = "campaign_winners"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    application_id = Column(Integer, ForeignKey("campaign_applications.id"), nullable=False, unique=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=False, index=True)
    coupon_code = Column(String, nullable=False, unique=True, index=True)
    reward_status = Column(String(32), nullable=False, default="issued")
    coupon_expires_at = Column(DateTime, nullable=True)
    redeemed_at = Column(DateTime, nullable=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CampaignAuditLog(Base):
    __tablename__ = "campaign_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(64), nullable=False)
    payload_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
