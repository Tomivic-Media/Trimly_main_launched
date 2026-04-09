from app.db.session import SessionLocal
from app.routes.barber import list_barbers, list_barbers_for_admin


db = SessionLocal()
try:
    public_barbers = list_barbers(location=None, available=None, min_price=None, max_price=None, db=db)
    print('public_barbers_count', len(public_barbers))
    for b in public_barbers:
        print('public', b.id, b.shop_name, b.location, b.kyc_status, b.is_available)
except Exception as exc:
    print('public_error', type(exc).__name__, exc)

try:
    from types import SimpleNamespace
    current = SimpleNamespace(role='admin')
    admin_barbers = list_barbers_for_admin(current_user=current, db=db)
    print('admin_barbers_count', len(admin_barbers))
    for b in admin_barbers:
        print('admin', b.barber_id, b.user_id, b.shop_name, b.kyc_status)
except Exception as exc:
    print('admin_error', type(exc).__name__, exc)
finally:
    db.close()
