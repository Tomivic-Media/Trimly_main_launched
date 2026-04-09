from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class BarberService(Base):
    __tablename__ = "barber_services"

    id = Column(Integer, primary_key=True, index=True)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False, default=0)
    is_home_service = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)

    barber = relationship("Barber", back_populates="services")
    booking_services = relationship("BookingService", back_populates="service")
