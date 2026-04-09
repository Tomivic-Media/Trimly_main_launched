from sqlalchemy import Column, Float, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.db.session import Base


class BookingService(Base):
    __tablename__ = "booking_services"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("barber_services.id"), nullable=False, index=True)
    price = Column(Float, nullable=False, default=0)

    booking = relationship("Booking", back_populates="booking_services")
    service = relationship("BarberService", back_populates="booking_services")
