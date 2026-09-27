"""Tests for owner recovery gate endpoints."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def owner_session():
    """Recover an owner session using master recovery code."""
    device_id = f"TEST_dev_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{API}/gate/recover-owner",
                      json={"device_id": device_id, "recovery_code": "recover-john"},
                      timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("is_owner") is True
    assert isinstance(data.get("token"), str) and len(data["token"]) > 0
    return {"device_id": device_id, "token": data["token"]}


def test_recover_owner_wrong_code():
    device_id = f"TEST_dev_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{API}/gate/recover-owner",
                      json={"device_id": device_id, "recovery_code": "wrong-code-xyz"},
                      timeout=15)
    assert r.status_code == 401, r.text


def test_recover_owner_correct_code(owner_session):
    # Fixture already validated success
    assert owner_session["token"]


def test_admin_config_returns_recovery_set(owner_session):
    r = requests.get(f"{API}/gate/admin/config",
                     params={"device_id": owner_session["device_id"],
                             "token": owner_session["token"]},
                     timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("recovery_set") is True


def test_set_recovery_too_short_returns_400(owner_session):
    r = requests.post(f"{API}/gate/admin/set-recovery",
                      json={"device_id": owner_session["device_id"],
                            "token": owner_session["token"],
                            "recovery_code": "abc"},
                      timeout=15)
    assert r.status_code == 400, r.text


def test_set_recovery_requires_owner_session():
    # No / bogus session
    r = requests.post(f"{API}/gate/admin/set-recovery",
                      json={"device_id": "TEST_bogus", "token": "bogus",
                            "recovery_code": "recover-john"},
                      timeout=15)
    assert r.status_code in (401, 403), r.text


def test_set_recovery_success_keeps_recover_john(owner_session):
    # Set to same value 'recover-john' so credentials remain valid.
    r = requests.post(f"{API}/gate/admin/set-recovery",
                      json={"device_id": owner_session["device_id"],
                            "token": owner_session["token"],
                            "recovery_code": "recover-john"},
                      timeout=15)
    assert r.status_code == 200, r.text

    # Verify recovery still works after reset
    device_id = f"TEST_dev_{uuid.uuid4().hex[:8]}"
    r2 = requests.post(f"{API}/gate/recover-owner",
                       json={"device_id": device_id, "recovery_code": "recover-john"},
                       timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("is_owner") is True


def test_gate_status_regression():
    r = requests.get(f"{API}/gate/status", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("enabled") is False
    assert data.get("has_owner") is True
