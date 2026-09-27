"""Backend tests: admin PIN login self-promotes fresh non-owner device."""
import os
import uuid
import requests
import pytest

def _load_frontend_env():
    p = "/app/frontend/.env"
    if os.path.exists(p):
        with open(p) as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ.setdefault(k, v)


_load_frontend_env()
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"


def _new_device():
    return f"TEST_dev_{uuid.uuid4().hex[:10]}"


class TestAdminLoginSelfPromote:
    def test_wrong_pin_returns_401(self):
        r = requests.post(f"{API}/gate/admin/login", json={
            "device_id": _new_device(),
            "token": "",
            "admin_pin": "0000",
        })
        assert r.status_code == 401, r.text
        body = r.json()
        assert "Wrong admin PIN" in (body.get("detail") or "")

    def test_correct_pin_self_promotes_new_device(self):
        device_id = _new_device()
        r = requests.post(f"{API}/gate/admin/login", json={
            "device_id": device_id,
            "token": "",
            "admin_pin": "9876",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("is_owner") is True
        assert isinstance(data.get("token"), str) and len(data["token"]) > 0
        # Ensure no "Not the owner device" leak
        assert "not the owner" not in r.text.lower()

        # Verify session is really owner via /gate/verify-device
        v = requests.post(f"{API}/gate/verify-device", json={
            "device_id": device_id,
            "token": data["token"],
        })
        assert v.status_code == 200, v.text
        vd = v.json()
        assert vd.get("valid") is True
        assert vd.get("is_owner") is True

    def test_owner_can_generate_invite_after_selfpromote(self):
        device_id = _new_device()
        r = requests.post(f"{API}/gate/admin/login", json={
            "device_id": device_id, "token": "", "admin_pin": "9876",
        })
        assert r.status_code == 200
        tok = r.json()["token"]
        g = requests.post(f"{API}/gate/admin/generate", json={
            "device_id": device_id, "token": tok,
        })
        assert g.status_code == 200, g.text
        gd = g.json()
        pin = gd.get("pin") or gd.get("code") or gd.get("invite_pin")
        assert pin and len(str(pin)) == 4 and str(pin).isdigit(), gd

    def test_gate_status_remains_disabled(self):
        s = requests.get(f"{API}/gate/status")
        assert s.status_code == 200
        assert s.json().get("enabled") is False
