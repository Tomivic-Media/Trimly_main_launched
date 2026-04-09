from datetime import datetime, timedelta
import hashlib
import secrets

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.user import User

email = 'ayokunleajepe@gmail.com'
raw_token = secrets.token_urlsafe(16)
token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == email).first()
    print('user_found', bool(user))
    if not user:
        raise SystemExit(0)
    user.reset_password_token_hash = token_hash
    user.reset_password_expires_at = datetime.utcnow() + timedelta(minutes=30)
    db.commit()
finally:
    db.close()

client = TestClient(app)
response = client.post('/reset-password', json={'token': raw_token, 'new_password': 'TrimlyTest123!'})
print('status', response.status_code)
print('body', response.text)
