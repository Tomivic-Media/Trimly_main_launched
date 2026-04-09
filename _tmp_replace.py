from app.db.session import SessionLocal
from app.models.barber import Barber


db = SessionLocal()
try:
    for barber in db.query(Barber).all():
        print(barber.id, barber.user_id, barber.shop_name, barber.kyc_status, barber.is_available, barber.barber_name)
finally:
    db.close()
