from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class BarberKYC(Base):
    __tablename__ = "barber_kyc"

    id = Column(Integer, primary_key=True, index=True)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=False, index=True)
    phone_number = Column(String, nullable=False)
    shop_address = Column(String, nullable=False)
    shop_photo_url = Column(String, nullable=False)
    bank_account_number = Column(String, nullable=False)
    bank_name = Column(String, nullable=False)
    account_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    barber = relationship("Barber", back_populates="kyc_records")
