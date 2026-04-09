from sqlalchemy import Column, Integer, Float, ForeignKey
from app.db.session import Base

class BarberWallet(Base):
    __tablename__ = "barber_wallets"

    id = Column(Integer, primary_key=True, index=True)
    barber_id = Column(Integer, ForeignKey("barbers.id"))
    
    available_balance = Column(Float, default=0)
    total_earned = Column(Float, default=0)
    total_withdrawn = Column(Float, default=0)