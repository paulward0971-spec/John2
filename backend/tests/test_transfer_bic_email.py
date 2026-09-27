"""
Tests for Send-Money regression:
- prepare_transfer honours manual BIC override + receipt_email
- confirm_transfer marks complete + email_sent when receipt_email provided
- Compliance: email builders use 'Demo Wallet' brand + MOCK banner + mock footer
  (no 'AIB' as sender), subjects are de-branded.
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

TEST_IBAN = "IE29AIBK93115212345678"
OVERRIDE_BIC = "BOFIIE2DXXX"
RECEIPT_EMAIL = "delivered@resend.dev"


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


# --- prepare_transfer honours manual BIC + receipt_email ---
def test_prepare_transfer_with_manual_bic_and_receipt_email(s):
    payload = {
        "recipient_name": "TEST Payee",
        "iban": TEST_IBAN,
        "bic": OVERRIDE_BIC,
        "amount_cents": 100,
        "receipt_email": RECEIPT_EMAIL,
        "note": "TEST override",
    }
    r = s.post(f"{API}/transfers/prepare", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    # bic stored (uppercased) equals override
    assert data["bic"] == OVERRIDE_BIC.upper(), data
    assert data["iban"].replace(" ", "").upper() == TEST_IBAN
    assert data["amount_cents"] == 100
    assert "id" in data


def test_prepare_transfer_bic_defaults_from_iban_when_omitted(s):
    payload = {
        "recipient_name": "TEST Auto",
        "iban": TEST_IBAN,
        "amount_cents": 50,
    }
    r = s.post(f"{API}/transfers/prepare", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    # AIBK IBAN -> AIBKIE2D detected
    assert data["bic"] == "AIBKIE2D", data


# --- confirm_transfer completes + email_sent when receipt_email present ---
def test_confirm_transfer_completes_and_sends_email(s):
    prep = s.post(f"{API}/transfers/prepare", json={
        "recipient_name": "TEST Confirm",
        "iban": TEST_IBAN,
        "bic": OVERRIDE_BIC,
        "amount_cents": 100,
        "receipt_email": RECEIPT_EMAIL,
    }).json()
    tid = prep["id"]

    r = s.post(f"{API}/transfers/confirm", json={"transfer_id": tid})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") == "complete", data
    assert data.get("email_sent") is True, data
    # bic override persisted through confirm
    assert data.get("bic") == OVERRIDE_BIC.upper()


# --- Compliance: email builders de-branded ---
def test_email_builders_debranded_demo_wallet():
    # Import the app module and invoke the private builders directly
    import sys
    sys.path.insert(0, "/app/backend")
    import server  # noqa

    profile = {
        "account_holder": "John Doe",
        "account_label": "AIB BANK ACCOUNT-017",
        "iban": "IE12AIBK93200170123456",
        "bic": "AIBKIE2D",
        "account_number": "01234567",
        "sort_code": "93-20-01",
        "balance_cents": 347500,
        "email": "john@example.com",
    }
    t = {
        "reference": "TEST-REF-001",
        "amount_cents": 100,
        "recipient_name": "TEST Payee",
        "iban": TEST_IBAN,
        "bic": OVERRIDE_BIC,
        "bank_name": "AIB",
        "note": "",
    }
    html = server._build_transfer_email_html(t, profile)
    linked = server._build_email_linked_html(profile, "TEST-REF-002", "user@example.com")

    for out in (html, linked):
        # header brand
        assert "Demo Wallet" in out
        # MOCK banner
        assert "MOCK" in out.upper()
        # small mock footer
        assert "mock" in out.lower()

    # Header must NOT use 'AIB' as brand — check the header block (first ~600 chars,
    # which contains the gradient header) doesn't contain 'AIB' as brand text.
    # 'AIB' may appear later only as the detected bank data field.
    header_slice_html = html.split("MOCK")[0]
    assert "AIB" not in header_slice_html, f"'AIB' leaked into transfer email header: {header_slice_html}"
    header_slice_linked = linked.split("MOCK")[0]
    assert "AIB" not in header_slice_linked, f"'AIB' leaked into linked-email header: {header_slice_linked}"


def test_env_email_from_name_is_demo_wallet_mock():
    # backend/.env should set EMAIL_FROM_NAME='Demo Wallet (Mock)'
    with open("/app/backend/.env") as f:
        env = f.read()
    assert "EMAIL_FROM_NAME=\"Demo Wallet (Mock)\"" in env or \
           "EMAIL_FROM_NAME='Demo Wallet (Mock)'" in env or \
           "EMAIL_FROM_NAME=Demo Wallet (Mock)" in env, env


def test_subjects_are_debranded():
    """Grep server.py for the two subject strings and ensure they use Demo Wallet."""
    with open("/app/backend/server.py") as f:
        src = f.read()
    assert 'Demo Wallet — Mock transfer receipt (demo)' in src
    assert 'Demo Wallet — Email linked (mock/demo)' in src
    # No subject using AIB as brand
    assert re.search(r'subject\s*=\s*["\'][^"\']*AIB', src) is None
