from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)
r = c.get('/barbers')
print(r.status_code)
print(r.text[:2000])
