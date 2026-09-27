from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import ipaddress
import logging
import random
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Email — outbound emails are DE-BRANDED, clearly-labelled MOCK/DEMO receipts.
# We do NOT impersonate any real bank (no "AIB" sender identity in emails).
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Demo Wallet (Mock)")
EMAIL_ENABLED = True

app = FastAPI(title="AIB Demo Prototype API")
api_router = APIRouter(prefix="/api")

# ---------- Models ----------

class Profile(BaseModel):
    display_name: str = "John"
    account_holder: str = "John Guilfoyle"
    account_label: str = "AIB BANK ACCOUNT-017"
    balance_cents: int = 350000  # €3,500 starting balance
    available_cents: int = 350000
    monthly_spent_cents: int = 3632  # €36.32
    card_last4: str = "4412"
    card_holder: str = "John Guilfoyle"
    card_expiry: str = "07/29"
    iban: str = "IE12 AIBK 9320 0170 1234 56"
    bic: str = "AIBKIE2D"
    account_number: str = "17012345"
    sort_code: str = "93-20-01"
    email: Optional[EmailStr] = None
    passcode: str = "12345"

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    account_holder: Optional[str] = None
    account_label: Optional[str] = None
    balance_cents: Optional[int] = None
    available_cents: Optional[int] = None
    monthly_spent_cents: Optional[int] = None
    card_last4: Optional[str] = None
    card_holder: Optional[str] = None
    card_expiry: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    account_number: Optional[str] = None
    sort_code: Optional[str] = None
    email: Optional[EmailStr] = None
    passcode: Optional[str] = None

class Transaction(BaseModel):
    id: str
    merchant: str
    category: str = "shopping"
    icon: str = "cart-outline"
    amount_cents: int  # negative = debit, positive = credit
    date: str  # ISO
    status: str = "completed"  # completed | declined | pending
    account_label: str = "AIB BANK ACCOUNT-017"
    reference: Optional[str] = None
    note: Optional[str] = None

class TransferRequest(BaseModel):
    recipient_name: str
    iban: str
    amount_cents: int
    reference: Optional[str] = None
    bic: Optional[str] = None
    receipt_email: Optional[EmailStr] = None
    send_email: bool = True

class TransferConfirm(BaseModel):
    transfer_id: str

class Transfer(BaseModel):
    id: str
    reference: str
    recipient_name: str
    iban: str
    bic: str
    bank_name: str
    bank_slug: Optional[str] = None
    amount_cents: int
    status: str = "pending"  # pending | complete | failed
    created_at: str
    note: Optional[str] = None
    email_sent: bool = False
    currency: str = "EUR"
    fx_rate: float = 1.0
    converted_amount_cents: Optional[int] = None
    is_foreign: bool = False
    country_name: Optional[str] = None


class Payee(BaseModel):
    id: str
    name: str
    iban: str
    bic: str
    bank_name: str
    bank_slug: Optional[str] = None
    last_used_at: str
    times_used: int = 1


class Budget(BaseModel):
    id: str
    name: str
    monthly_cap_cents: int
    categories: List[str] = []  # empty = all spending
    created_at: str

class BudgetCreate(BaseModel):
    name: str
    monthly_cap_cents: int
    categories: List[str] = []


# ---------- Bank code map (Ireland + selected UK/EU digital banks) ----------
# The 4-letter "bank code" is characters 5-8 of an IBAN for IE/GB/NL/DE etc.
BANK_CODES = {
    # Ireland
    "AIBK": ("AIB", "AIBKIE2D", "aib"),
    "BOFI": ("Bank of Ireland", "BOFIIE2D", "boi"),
    "BKIR": ("Bank of Ireland", "BOFIIE2D", "boi"),
    "IPBS": ("Permanent TSB", "IPBSIE2D", "ptsb"),
    "EBSI": ("EBS", "EBSIIE2D", "ebs"),
    "ULSB": ("Ulster Bank", "ULSBIE2D", "ulster"),
    "CITI": ("Citibank Ireland", "CITIIE2X", ""),
    "AIPT": ("An Post Money", "AIPTIE21", "anpost"),
    "REVO": ("Revolut Ireland", "REVOIE23", "revolut"),
    "NTSB": ("N26 Ireland", "NTSBDEB1", "n26"),
    "KRED": ("KBC Ireland", "KREDIE22", ""),
    # UK digital banks
    "MONZ": ("Monzo", "MONZGB2L", "monzo"),
    # Netherlands digital banks
    "BUNQ": ("bunq", "BUNQNL2A", "bunq"),
    # Wider Revolut / N26 codes (used for their EU accounts)
    "REVOLT": ("Revolut", "REVOLT21", "revolut"),
    "NTSBDEB1": ("N26", "NTSBDEB1", "n26"),
}
# Backwards-compatible alias
IRISH_BANKS = {k: (v[0], v[1]) for k, v in BANK_CODES.items()}

# Country -> ISO currency (SEPA/euro countries use EUR; others their own)
CURRENCY_BY_COUNTRY = {
    "IE": "EUR", "DE": "EUR", "FR": "EUR", "ES": "EUR", "IT": "EUR", "BE": "EUR",
    "PT": "EUR", "NL": "EUR", "AT": "EUR", "FI": "EUR", "GR": "EUR", "LU": "EUR",
    "SK": "EUR", "SI": "EUR", "LT": "EUR", "LV": "EUR", "EE": "EUR", "CY": "EUR", "MT": "EUR",
    "GB": "GBP", "CH": "CHF", "PL": "PLN", "SE": "SEK", "NO": "NOK", "DK": "DKK",
    "CZ": "CZK", "HU": "HUF", "RO": "RON", "BG": "BGN", "HR": "EUR",
    "US": "USD", "CA": "CAD", "AU": "AUD", "JP": "JPY", "AE": "AED", "TR": "TRY",
}
# Static demo FX rates: 1 EUR -> X currency (for prototype conversion only)
FX_RATES = {
    "EUR": 1.0, "GBP": 0.855, "USD": 1.08, "CHF": 0.96, "PLN": 4.32, "SEK": 11.35,
    "NOK": 11.55, "DKK": 7.46, "CZK": 25.2, "HUF": 395.0, "RON": 4.97, "BGN": 1.96,
    "CAD": 1.47, "AUD": 1.63, "JPY": 168.0, "AED": 3.97, "TRY": 34.8,
}
CURRENCY_SYMBOLS = {
    "EUR": "\u20ac", "GBP": "\u00a3", "USD": "$", "CHF": "CHF ", "PLN": "z\u0142",
    "SEK": "kr", "NOK": "kr", "DKK": "kr", "CZK": "K\u010d", "HUF": "Ft", "RON": "lei",
    "BGN": "\u043b\u0432", "CAD": "C$", "AUD": "A$", "JPY": "\u00a5", "AED": "AED ", "TRY": "\u20ba",
}
COUNTRY_NAMES = {
    "IE": "Ireland", "GB": "United Kingdom", "DE": "Germany", "FR": "France",
    "ES": "Spain", "IT": "Italy", "BE": "Belgium", "PT": "Portugal", "NL": "Netherlands",
    "AT": "Austria", "FI": "Finland", "GR": "Greece", "LU": "Luxembourg", "CH": "Switzerland",
    "PL": "Poland", "SE": "Sweden", "NO": "Norway", "DK": "Denmark", "CZ": "Czechia",
    "HU": "Hungary", "RO": "Romania", "BG": "Bulgaria", "US": "United States",
    "CA": "Canada", "AU": "Australia", "JP": "Japan", "AE": "United Arab Emirates", "TR": "Türkiye",
}


def detect_bank(iban: str) -> dict:
    cleaned = re.sub(r"\s+", "", iban).upper()
    if len(cleaned) < 8:
        return {"bank_code": "", "bank_name": "", "bic": "", "slug": "", "is_valid": False,
                "country": "", "country_name": "", "currency": "EUR", "fx_rate": 1.0, "is_foreign": False}
    country = cleaned[:2]
    bank_code = cleaned[4:8]  # standard IBAN bank-identifier slice for IE/GB/NL
    LENGTHS = {"IE": 22, "GB": 22, "NL": 18, "DE": 22, "FR": 27, "ES": 24, "IT": 27, "BE": 16, "PT": 25}
    expected = LENGTHS.get(country)
    is_valid = expected is None or len(cleaned) == expected
    currency = CURRENCY_BY_COUNTRY.get(country, "EUR")
    fx_rate = FX_RATES.get(currency, 1.0)
    country_name = COUNTRY_NAMES.get(country, "")
    is_foreign = country != "" and country != "IE"

    base = {
        "bank_code": bank_code, "country": country, "country_name": country_name,
        "currency": currency, "fx_rate": fx_rate, "is_foreign": is_foreign, "is_valid": is_valid,
    }
    if not is_foreign and bank_code in BANK_CODES:
        name, bic, slug = BANK_CODES[bank_code]
        return {**base, "bank_name": name, "bic": bic, "slug": slug}
    # Foreign or unknown Irish code -> friendly country label, generic logo
    if is_foreign:
        label = f"{country_name} bank" if country_name else "Foreign bank"
    else:
        label = f"Irish bank ({bank_code})" if bank_code.isalpha() else "Irish bank"
    return {**base, "bank_name": label, "bic": "", "slug": ""}


# ---------- Email guardrail gate ----------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)

def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)

def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened/numeric-host/creds URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real host {real!r} (G3)")

async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    if not EMAIL_ENABLED:
        logger.info("Email sending is disabled; skipping send.")
        return None
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as client_h:
            resp = await client_h.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error(f"Email error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")


# ---------- Profile ----------

async def get_or_create_profile() -> dict:
    p = await db.profile.find_one({"_id": "singleton"}, {"_id": 0})
    if not p:
        default = Profile().model_dump()
        await db.profile.insert_one({"_id": "singleton", **default})
        p = default
    # One-off migration: if a legacy profile was seeded with a zero balance,
    # bring it up to the demo starting balance so the Home screen shows a real
    # amount that can then move as the user makes transfers.
    if int(p.get("balance_cents") or 0) == 0 and int(p.get("available_cents") or 0) == 0:
        await db.profile.update_one(
            {"_id": "singleton"},
            {"$set": {"balance_cents": 350000, "available_cents": 350000}},
        )
        p["balance_cents"] = 350000
        p["available_cents"] = 350000
    return p

@api_router.get("/profile", response_model=Profile)
async def read_profile():
    return Profile(**await get_or_create_profile())

@api_router.patch("/profile", response_model=Profile)
async def update_profile(update: ProfileUpdate):
    await get_or_create_profile()
    changes = {k: v for k, v in update.model_dump().items() if v is not None}
    if changes:
        await db.profile.update_one({"_id": "singleton"}, {"$set": changes})
    return Profile(**await get_or_create_profile())


class VerifyEmailRequest(BaseModel):
    email: EmailStr

@api_router.post("/profile/verify-email")
async def verify_email(req: VerifyEmailRequest):
    """Save the email on the profile and send an AIB-branded confirmation email
    with a reference number, showing the linked account details."""
    await get_or_create_profile()
    await db.profile.update_one({"_id": "singleton"}, {"$set": {"email": req.email}})
    profile = await get_or_create_profile()
    ref = f"DW-EL-{random.randint(100000000, 999999999)}"
    subject = "Demo Wallet — Email linked (mock/demo)"
    html = _build_email_linked_html(profile, ref, req.email)
    email_id = await send_email(to=req.email, subject=subject, html=html)
    return {"status": "success", "reference": ref, "email_id": email_id}


# ---------- Transactions ----------

DEFAULT_TXNS = [
    {"merchant": "Google Play", "category": "entertainment", "icon": "logo-google-playstore", "amount_cents": -749, "status": "declined", "date": "2025-09-25T10:11:00Z"},
    {"merchant": "Google Play", "category": "entertainment", "icon": "logo-google-playstore", "amount_cents": -749, "status": "declined", "date": "2025-09-25T10:09:00Z"},
    {"merchant": "Tesco Express", "category": "groceries", "icon": "cart-outline", "amount_cents": -1245, "status": "completed", "date": "2025-09-24T18:30:00Z"},
    {"merchant": "Spotify", "category": "entertainment", "icon": "musical-notes-outline", "amount_cents": -999, "status": "completed", "date": "2025-09-23T09:00:00Z"},
    {"merchant": "Salary - Acme Ltd", "category": "income", "icon": "briefcase-outline", "amount_cents": 210000, "status": "completed", "date": "2025-09-20T08:00:00Z"},
    {"merchant": "Lidl", "category": "groceries", "icon": "cart-outline", "amount_cents": -2350, "status": "completed", "date": "2025-09-19T16:12:00Z"},
    {"merchant": "Bus Éireann", "category": "transport", "icon": "bus-outline", "amount_cents": -320, "status": "completed", "date": "2025-09-18T07:45:00Z"},
]

async def seed_transactions():
    if await db.transactions.count_documents({}) == 0:
        docs = []
        for t in DEFAULT_TXNS:
            tid = f"TXN-{random.randint(100000, 999999)}"
            docs.append({"id": tid, "reference": tid, "account_label": "AIB BANK ACCOUNT-017", **t})
        await db.transactions.insert_many(docs)

@api_router.get("/transactions", response_model=List[Transaction])
async def list_transactions():
    await seed_transactions()
    cursor = db.transactions.find({}, {"_id": 0}).sort("date", -1).limit(100)
    return [Transaction(**t) async for t in cursor]

@api_router.get("/transactions/{txn_id}", response_model=Transaction)
async def get_transaction(txn_id: str):
    t = await db.transactions.find_one({"id": txn_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return Transaction(**t)


# ---------- IBAN bank detection ----------
@api_router.get("/iban/lookup")
async def iban_lookup(iban: str):
    return detect_bank(iban)


# ---------- Transfers ----------

@api_router.post("/transfers/prepare", response_model=Transfer)
async def prepare_transfer(req: TransferRequest):
    profile = await get_or_create_profile()
    if req.amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    bank = detect_bank(req.iban)
    ref = f"DW-{random.randint(100000000, 999999999)}"
    manual_bic = (req.bic or "").strip().upper() or None
    currency = bank.get("currency", "EUR")
    fx_rate = float(bank.get("fx_rate", 1.0))
    converted = req.amount_cents if currency == "EUR" else int(round(req.amount_cents * fx_rate))
    transfer = {
        "id": ref,
        "reference": ref,
        "recipient_name": req.recipient_name,
        "iban": re.sub(r"\s+", "", req.iban).upper(),
        "bic": manual_bic or bank["bic"] or ("" if bank.get("is_foreign") else "AIBKIE2D"),
        "bank_name": bank["bank_name"],
        "bank_slug": bank.get("slug", ""),
        "amount_cents": req.amount_cents,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "note": req.reference,
        "email_sent": False,
        "send_email_requested": req.send_email,
        "recipient_email": req.receipt_email or profile.get("email"),
        "currency": currency,
        "fx_rate": fx_rate,
        "converted_amount_cents": converted,
        "is_foreign": bool(bank.get("is_foreign", False)),
        "country_name": bank.get("country_name", ""),
    }
    await db.transfers.insert_one(transfer)
    return Transfer(**{k: v for k, v in transfer.items() if k in Transfer.model_fields})


def _format_iban(iban: str) -> str:
    return " ".join([iban[i:i+4] for i in range(0, len(iban), 4)])

def _euros(cents: int) -> str:
    return f"€{cents/100:,.2f}"


@api_router.post("/transfers/confirm", response_model=Transfer)
async def confirm_transfer(payload: TransferConfirm):
    t = await db.transfers.find_one({"id": payload.transfer_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    profile = await get_or_create_profile()

    # Mark complete + deduct from balance
    new_balance = int(profile.get("balance_cents", 0)) - int(t["amount_cents"])
    new_available = int(profile.get("available_cents", 0)) - int(t["amount_cents"])
    await db.profile.update_one({"_id": "singleton"}, {"$set": {"balance_cents": new_balance, "available_cents": new_available}})

    # Record as transaction
    txn = {
        "id": t["id"],
        "reference": t["reference"],
        "merchant": t["recipient_name"],
        "category": "transfer",
        "icon": "arrow-up-outline",
        "amount_cents": -int(t["amount_cents"]),
        "date": t["created_at"],
        "status": "completed",
        "account_label": profile.get("account_label", "AIB BANK ACCOUNT-017"),
        "note": t.get("note") or f"SEPA transfer to {t['recipient_name']}",
    }
    await db.transactions.insert_one(txn)

    # Send email if requested and email is set
    email_sent = False
    recipient_email = profile.get("email")
    if t.get("send_email_requested") and recipient_email:
        subject = "Demo Wallet — Mock transfer receipt (demo)"
        html = _build_transfer_email_html(t, profile)
        try:
            await send_email(to=recipient_email, subject=subject, html=html)
            email_sent = True
        except Exception as e:
            logger.error(f"email send failure: {e}")

    await db.transfers.update_one({"id": t["id"]}, {"$set": {"status": "complete", "email_sent": email_sent}})
    t.update({"status": "complete", "email_sent": email_sent})

    # Upsert payee for quick reuse
    await db.payees.update_one(
        {"iban": t["iban"]},
        {
            "$set": {
                "name": t["recipient_name"],
                "iban": t["iban"],
                "bic": t["bic"],
                "bank_name": t["bank_name"],
                "bank_slug": t.get("bank_slug", ""),
                "last_used_at": datetime.now(timezone.utc).isoformat(),
            },
            "$inc": {"times_used": 1},
            "$setOnInsert": {"id": f"PAYEE-{random.randint(100000, 999999)}"},
        },
        upsert=True,
    )

    return Transfer(**{k: v for k, v in t.items() if k in Transfer.model_fields})


@api_router.get("/transfers/{transfer_id}", response_model=Transfer)
async def get_transfer(transfer_id: str):
    t = await db.transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return Transfer(**{k: v for k, v in t.items() if k in Transfer.model_fields})


def _build_transfer_email_html(t: dict, profile: dict) -> str:
    ref = escape(t["reference"])
    amount = escape(_euros(t["amount_cents"]))
    to_name = escape(t["recipient_name"])
    iban_fmt = escape(_format_iban(t["iban"]))
    bic = escape(t["bic"])
    bank = escape(t["bank_name"])
    from_name = escape(profile.get("account_holder", ""))
    from_iban = escape(profile.get("iban", ""))
    note = escape(t.get("note") or "")
    date_str = escape(datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC"))

    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;font-family:Arial,Helvetica,sans-serif;color:#ffffff">
  <tr><td align="center" style="padding:24px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0F0F0F;border-radius:20px;overflow:hidden;border:1px solid #222">
      <tr><td style="background:linear-gradient(135deg,#4A0E5C,#7B1FA2);padding:28px 26px">
        <div style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:0.5px">Demo Wallet</div>
        <div style="font-size:14px;color:#ffffff;margin-top:6px;opacity:0.9">Mock transfer receipt</div>
      </td></tr>
      <tr><td style="padding:16px 24px 0 24px">
        <div style="background:#FFF3CD;color:#7A5B00;border:1px solid #E0C15A;border-radius:10px;padding:12px 14px;font-size:13px;font-weight:700;line-height:19px">
          &#9888; MOCK / DEMO &mdash; This is a simulated receipt from a demo app. It is NOT a real payment and NOT a message from any bank.
        </div>
      </td></tr>
      <tr><td style="padding:28px 24px 8px 24px;text-align:center">
        <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:32px;background:rgba(76,175,80,0.15);color:#4CAF50;font-size:36px;font-weight:800">&#10003;</div>
        <div style="font-size:24px;font-weight:900;color:#ffffff;margin-top:14px">Simulated transfer complete</div>
        <div style="font-size:14px;color:#B5B5B5;margin-top:8px;line-height:20px">This is a demo transfer generated by the Demo Wallet prototype</div>
      </td></tr>
      <tr><td style="padding:8px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Reference</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{ref}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Amount</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{amount}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">To</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{to_name}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">IBAN</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{iban_fmt}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">BIC Code</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{bic}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Bank</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{bank}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">From</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{from_name}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">From IBAN</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{escape(_format_iban(re.sub(r' ', '', from_iban)))}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Date</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{date_str}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Status</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#4CAF50;text-align:right;font-weight:800">Complete</td></tr>
          <tr><td style="padding:14px 0;color:#8E8E93;font-size:13px">Processing Time</td><td style="padding:14px 0;color:#fff;text-align:right;font-weight:800">24 hours</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:8px 24px 4px 24px">
        <div style="background:rgba(100,181,246,0.14);border-left:3px solid #64B5F6;padding:14px 16px;border-radius:10px;color:#B5D6F5;font-size:13px;line-height:20px">
          <b style="color:#64B5F6">SEPA Transfer:</b> Transfers within the SEPA zone typically take 24 hours to complete.
        </div>
      </td></tr>
      <tr><td style="padding:10px 24px 24px 24px">
        <div style="background:rgba(255,82,82,0.14);border-left:3px solid #FF5252;padding:14px 16px;border-radius:10px;color:#F5B5B5;font-size:13px;line-height:20px">
          <b style="color:#FF5252">Important:</b> This payment cannot be cancelled once sent.
        </div>
        {"<div style='margin-top:14px;color:#8E8E93;font-size:13px'>Note: " + note + "</div>" if note else ""}
      </td></tr>
      <tr><td style="padding:0 24px 24px 24px;text-align:left">
        <div style="color:#6A6A6A;font-size:11px">mock &mdash; not a real payment or bank communication. Demo Wallet is a prototype/demo app.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
""".strip()


def _build_email_linked_html(profile: dict, ref: str, email: str) -> str:
    holder = escape(profile.get("account_holder", ""))
    label = escape(profile.get("account_label", ""))
    iban_fmt = escape(_format_iban(re.sub(r"\s+", "", profile.get("iban", ""))))
    bic = escape(profile.get("bic", ""))
    acc = escape(profile.get("account_number", ""))
    sort = escape(profile.get("sort_code", ""))
    balance = escape(_euros(int(profile.get("balance_cents", 0))))
    date_str = escape(datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC"))
    e = escape(email)

    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;font-family:Arial,Helvetica,sans-serif;color:#ffffff">
  <tr><td align="center" style="padding:24px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0F0F0F;border-radius:20px;overflow:hidden;border:1px solid #222">
      <tr><td style="background:linear-gradient(135deg,#4A0E5C,#7B1FA2);padding:28px 26px">
        <div style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:0.5px">Demo Wallet</div>
        <div style="font-size:14px;color:#ffffff;margin-top:6px;opacity:0.9">Email linked (mock/demo)</div>
      </td></tr>
      <tr><td style="padding:16px 24px 0 24px">
        <div style="background:#FFF3CD;color:#7A5B00;border:1px solid #E0C15A;border-radius:10px;padding:12px 14px;font-size:13px;font-weight:700;line-height:19px">
          &#9888; MOCK / DEMO &mdash; simulated confirmation from a demo app. NOT from any bank.
        </div>
      </td></tr>
      <tr><td style="padding:28px 24px 8px 24px;text-align:center">
        <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:32px;background:rgba(76,175,80,0.15);color:#4CAF50;font-size:36px;font-weight:800">&#10003;</div>
        <div style="font-size:24px;font-weight:900;color:#ffffff;margin-top:14px">Confirmation</div>
        <div style="font-size:14px;color:#B5B5B5;margin-top:8px;line-height:20px">Your email has been linked to your Demo Wallet demo account</div>
      </td></tr>
      <tr><td style="padding:8px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Reference</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{escape(ref)}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Linked email</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{e}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Account holder</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{holder}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Account</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{label}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">IBAN</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{iban_fmt}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">BIC Code</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{bic}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Account number</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{acc}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Sort code</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{sort}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Current balance</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{balance}</td></tr>
          <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#8E8E93;font-size:13px">Date</td><td style="padding:14px 0;border-bottom:1px solid #222;color:#fff;text-align:right;font-weight:800">{date_str}</td></tr>
          <tr><td style="padding:14px 0;color:#8E8E93;font-size:13px">Status</td><td style="padding:14px 0;color:#4CAF50;text-align:right;font-weight:800">Complete</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:8px 24px 4px 24px">
        <div style="background:rgba(100,181,246,0.14);border-left:3px solid #64B5F6;padding:14px 16px;border-radius:10px;color:#B5D6F5;font-size:13px;line-height:20px">
          <b style="color:#64B5F6">SEPA Transfer:</b> Transfers within the SEPA zone typically take 24 hours to complete. From now on all SEPA receipts will be sent to this email.
        </div>
      </td></tr>
      <tr><td style="padding:10px 24px 24px 24px">
        <div style="background:rgba(255,82,82,0.14);border-left:3px solid #FF5252;padding:14px 16px;border-radius:10px;color:#F5B5B5;font-size:13px;line-height:20px">
          <b style="color:#FF5252">Important:</b> Payments cannot be cancelled once sent.
        </div>
      </td></tr>
      <tr><td style="padding:0 24px 24px 24px;text-align:left">
        <div style="color:#6A6A6A;font-size:11px">mock &mdash; not a real payment or bank communication. Demo Wallet is a prototype/demo app.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
""".strip()



# ---------- Payees ----------
@api_router.get("/payees", response_model=List[Payee])
async def list_payees():
    cursor = db.payees.find({}, {"_id": 0}).sort("last_used_at", -1).limit(20)
    return [Payee(**p) async for p in cursor]

@api_router.delete("/payees/{payee_id}")
async def delete_payee(payee_id: str):
    r = await db.payees.delete_one({"id": payee_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payee not found")
    return {"status": "deleted"}


# ---------- Abi digital assistant (Claude Sonnet 4.6) ----------

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    text: str

class ChatRequest(BaseModel):
    session_id: str
    message: str

async def _abi_context() -> str:
    """Build a fresh context snapshot Abi is grounded on for every message."""
    profile = await get_or_create_profile()
    recent_txns = []
    async for t in db.transactions.find({}, {"_id": 0}).sort("date", -1).limit(6):
        sign = "+" if t.get("amount_cents", 0) > 0 else ""
        recent_txns.append(
            f"- {t.get('date','')[:10]}  {t.get('merchant','')}  {sign}{_euros(t.get('amount_cents',0))}  ({t.get('status','')})"
        )
    recent_transfers = []
    async for tr in db.transfers.find({}, {"_id": 0}).sort("created_at", -1).limit(5):
        # A SEPA transfer settles 24h after it was submitted
        created = tr.get("created_at", "")
        settle_hint = ""
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            settles = dt + timedelta(hours=24)
            settle_hint = f" (settles by ~{settles.strftime('%d %b %Y %H:%M UTC')})"
        except Exception:
            pass
        recent_transfers.append(
            f"- ref {tr.get('reference','')}: {_euros(tr.get('amount_cents',0))} to {tr.get('recipient_name','')} at {tr.get('bank_name','')} ({tr.get('iban','')[:8]}...) - status {tr.get('status','')}{settle_hint}"
        )
    return f"""User profile:
- Display name: {profile.get('display_name')}
- Account holder: {profile.get('account_holder')}
- Account label: {profile.get('account_label')}
- Balance: {_euros(profile.get('balance_cents',0))}
- Available: {_euros(profile.get('available_cents',0))}
- Monthly spend so far: {_euros(profile.get('monthly_spent_cents',0))}
- IBAN: {profile.get('iban')}   BIC: {profile.get('bic')}
- Card: last-4 {profile.get('card_last4')}, expires {profile.get('card_expiry')}
- Email linked: {profile.get('email') or 'not linked'}

Recent transactions (newest first):
{chr(10).join(recent_txns) if recent_txns else '(none yet)'}

Recent transfers:
{chr(10).join(recent_transfers) if recent_transfers else '(none yet)'}
"""

ABI_SYSTEM = """You are Abi, the AIB digital assistant inside the AIB mobile app.
Voice: warm, brief, plain English, no jargon. Reply in short paragraphs and use bullet points for lists. Never invent numbers - if you don't have a detail, say so.

You know these facts about the app and about SEPA transfers, and you should use them:

Why a SEPA credit transfer isn't instant
- SEPA Credit Transfer (SCT) is the default in the AIB app and clears next business day, usually within 24 hours. It is a batch system: the sending bank groups payments and the clearing system (STEP2 / EBA) settles them in scheduled cycles.
- Weekends and Irish bank holidays don't count as business days, so a payment sent on Friday afternoon typically lands on the next Monday morning.
- If both banks support SEPA Instant (SCT Inst), the money moves in about 10 seconds, 24/7. Not every Irish bank supports Instant on every account yet.
- Once a SEPA transfer is confirmed in-app it CANNOT be cancelled. A recall can be requested but is not guaranteed.

When someone asks about a specific transfer, use the "Recent transfers" list and their "settles by" hint to give a specific expected arrival time.

App navigation help (short answers):
- Home tab: balance, monthly spend, activity list, standing-orders card.
- Cards tab: freeze card, show PIN, view expiry and last 4.
- Payments tab -> Pay someone new: enter IBAN, we auto-detect the receiving Irish bank.
- Insights tab: spend-by-category bars.
- Products tab: savings, loans, mortgage, investment options.
- Settings (avatar top-left on Home): edit name, balance, IBAN, card details, link email for receipts.

Guardrails:
- Never ask for passwords, PINs, card numbers, CVV or one-time codes.
- If asked something outside AIB app help, politely steer back."""


@api_router.post("/chat/message")
async def chat_message(req: ChatRequest):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

    # Load persisted history for this session
    history_doc = await db.chats.find_one({"session_id": req.session_id}, {"_id": 0})
    history: list = (history_doc or {}).get("messages", [])

    # Persist the user message
    now = datetime.now(timezone.utc).isoformat()
    history.append({"role": "user", "text": req.message, "at": now})

    # Build a fresh system message that includes current context
    context = await _abi_context()
    system_message = f"{ABI_SYSTEM}\n\n=== Current app state (fresh each turn) ===\n{context}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=req.session_id,
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-4-6")

    # Replay only the trimmed history so the SDK sees prior turns
    prior_user_msgs = [m for m in history[:-1] if m["role"] == "user"][-6:]
    prior_asst_msgs = [m for m in history[:-1] if m["role"] == "assistant"][-6:]

    # Simplest correct approach for send_message: replay prior turns then send
    # the new user message. The library maintains internal history.
    try:
        for u, a in zip(prior_user_msgs, prior_asst_msgs):
            await chat.send_message(UserMessage(text=u["text"]))
            # We don't have a way to inject assistant text directly, so we rely on
            # the model regenerating - keep replay minimal. For a chat MVP this
            # is acceptable; long chats can be trimmed above.
        reply = await chat.send_message(UserMessage(text=req.message))
    except Exception as e:
        logger.error(f"LLM chat error: {e}")
        raise HTTPException(status_code=502, detail=f"Assistant unavailable: {e}")

    text = reply if isinstance(reply, str) else str(reply)
    history.append({"role": "assistant", "text": text, "at": datetime.now(timezone.utc).isoformat()})
    await db.chats.update_one(
        {"session_id": req.session_id},
        {"$set": {"session_id": req.session_id, "messages": history[-40:]}},
        upsert=True,
    )
    return {"reply": text, "session_id": req.session_id}


@api_router.get("/chat/{session_id}")
async def get_chat(session_id: str):
    doc = await db.chats.find_one({"session_id": session_id}, {"_id": 0})
    return doc or {"session_id": session_id, "messages": []}


@api_router.delete("/chat/{session_id}")
async def clear_chat(session_id: str):
    await db.chats.delete_one({"session_id": session_id})
    return {"status": "cleared"}


# ---------- Budgets ----------
@api_router.get("/budgets")
async def list_budgets():
    cursor = db.budgets.find({}, {"_id": 0}).sort("created_at", -1).limit(50)
    budgets = [b async for b in cursor]
    # Compute month-to-date spend per budget
    now = datetime.now(timezone.utc)
    month_start_iso = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    txns = []
    async for t in db.transactions.find({"date": {"$gte": month_start_iso}, "status": {"$ne": "declined"}}, {"_id": 0}).limit(1000):
        txns.append(t)
    result = []
    for b in budgets:
        spent = 0
        for t in txns:
            if t.get("amount_cents", 0) >= 0:
                continue
            if b["categories"] and t.get("category") not in b["categories"]:
                continue
            spent += abs(t["amount_cents"])
        cap = int(b.get("monthly_cap_cents", 0)) or 1
        pct = min(1.0, spent / cap) if cap else 0
        result.append({**b, "spent_cents": spent, "percent": pct})
    return result

@api_router.post("/budgets")
async def create_budget(body: BudgetCreate):
    bid = f"BUD-{random.randint(100000, 999999)}"
    doc = {
        "id": bid,
        "name": body.name,
        "monthly_cap_cents": body.monthly_cap_cents,
        "categories": body.categories,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.budgets.insert_one(dict(doc))  # copy so Mongo doesn't mutate our response
    return {**doc, "spent_cents": 0, "percent": 0.0}

@api_router.delete("/budgets/{bid}")
async def delete_budget(bid: str):
    r = await db.budgets.delete_one({"id": bid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Budget not found")
    return {"status": "deleted"}


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"message": "AIB Demo Prototype API", "status": "ok"}


# ==============================================================
# Invite gate — 4-digit one-time PINs that lock the app behind
# codes only the owner can hand out. Once used, a PIN is burnt
# forever and the redeeming device is remembered so it never has
# to enter one again.
# ==============================================================
import secrets, hashlib

GATE_CFG_ID = "gate"
DEFAULT_ADMIN_PIN = "9876"

class RedeemIn(BaseModel):
    pin: str
    device_id: str

class VerifyIn(BaseModel):
    device_id: str
    token: str

class AdminLoginIn(BaseModel):
    device_id: str
    token: str
    admin_pin: str

class SetAdminPinIn(BaseModel):
    device_id: str
    token: str
    new_pin: str

class ToggleGateIn(BaseModel):
    device_id: str
    token: str
    enabled: bool

class RevokePinIn(BaseModel):
    device_id: str
    token: str
    pin: str

class GeneratePinIn(BaseModel):
    device_id: str
    token: str
    label: Optional[str] = None

class BootstrapOwnerIn(BaseModel):
    device_id: str

async def _gate_cfg():
    doc = await db.gate_config.find_one({"_id": GATE_CFG_ID}, {"_id": 0})
    if not doc:
        doc = {"enabled": False, "admin_pin": DEFAULT_ADMIN_PIN, "has_owner": False}
        await db.gate_config.insert_one({"_id": GATE_CFG_ID, **doc})
    return doc

async def _get_session(device_id: str, token: str):
    return await db.device_sessions.find_one(
        {"device_id": device_id, "token": token, "revoked": {"$ne": True}},
        {"_id": 0},
    )

async def _require_owner(device_id: str, token: str):
    s = await _get_session(device_id, token)
    if not s or not s.get("is_owner"):
        raise HTTPException(status_code=403, detail="Owner access only")
    return s

def _new_token() -> str:
    return secrets.token_urlsafe(32)

def _random_pin() -> str:
    # 4-digit PIN, avoid weak sequences like 0000 / 1234
    while True:
        p = f"{secrets.randbelow(10000):04d}"
        if p not in {"0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321", "1122", "1212", "0123"}:
            return p


@api_router.get("/gate/status")
async def gate_status():
    cfg = await _gate_cfg()
    return {"enabled": cfg.get("enabled", False), "has_owner": cfg.get("has_owner", False)}


@api_router.post("/gate/verify-device")
async def gate_verify_device(payload: VerifyIn):
    s = await _get_session(payload.device_id, payload.token)
    if not s:
        return {"valid": False, "is_owner": False}
    return {"valid": True, "is_owner": bool(s.get("is_owner"))}


@api_router.post("/gate/bootstrap-owner")
async def gate_bootstrap_owner(payload: BootstrapOwnerIn):
    cfg = await _gate_cfg()
    if cfg.get("has_owner"):
        raise HTTPException(status_code=409, detail="Owner already claimed")
    token = _new_token()
    now = datetime.now(timezone.utc).isoformat()
    await db.device_sessions.insert_one({
        "device_id": payload.device_id,
        "token": token,
        "is_owner": True,
        "created_at": now,
        "revoked": False,
        "invite_pin": None,
    })
    await db.gate_config.update_one({"_id": GATE_CFG_ID}, {"$set": {"has_owner": True}})
    return {"token": token, "is_owner": True}


@api_router.post("/gate/redeem")
async def gate_redeem(payload: RedeemIn):
    # Basic rate limit: 5 attempts per device_id per 15 minutes
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=15)
    recent = await db.gate_attempts.count_documents({
        "device_id": payload.device_id,
        "created_at": {"$gte": window_start.isoformat()},
    })
    if recent >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

    await db.gate_attempts.insert_one({"device_id": payload.device_id, "created_at": now.isoformat()})

    pin = re.sub(r"\D", "", payload.pin or "")
    if len(pin) != 4:
        raise HTTPException(status_code=400, detail="PIN must be 4 digits")

    doc = await db.invite_pins.find_one({"pin": pin, "used": False, "revoked": {"$ne": True}}, {"_id": 0})
    if not doc:
        # Could be used, revoked or never existed — same message either way
        # for security
        raise HTTPException(status_code=400, detail="Invalid or already-used code")

    # Burn the PIN and bind to this device
    token = _new_token()
    await db.invite_pins.update_one(
        {"pin": pin, "used": False},
        {"$set": {
            "used": True,
            "used_by_device": payload.device_id,
            "used_at": now.isoformat(),
        }},
    )
    await db.device_sessions.insert_one({
        "device_id": payload.device_id,
        "token": token,
        "is_owner": False,
        "created_at": now.isoformat(),
        "revoked": False,
        "invite_pin": pin,
    })
    # Reset rate limit on success
    await db.gate_attempts.delete_many({"device_id": payload.device_id})
    return {"token": token, "is_owner": False}


@api_router.post("/gate/admin/login")
async def gate_admin_login(payload: AdminLoginIn):
    cfg = await _gate_cfg()
    if payload.admin_pin != cfg.get("admin_pin", DEFAULT_ADMIN_PIN):
        raise HTTPException(status_code=401, detail="Wrong admin PIN")
    # The correct admin PIN proves ownership. Ensure this device has an owner
    # session so it never gets stuck on "not the owner device" (common on web
    # when local storage / the owner token is lost).
    s = await _get_session(payload.device_id, payload.token)
    token = payload.token
    if not s or not s.get("is_owner"):
        token = _new_token()
        await db.device_sessions.insert_one({
            "device_id": payload.device_id,
            "token": token,
            "is_owner": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "revoked": False,
            "invite_pin": None,
        })
        await db.gate_config.update_one({"_id": GATE_CFG_ID}, {"$set": {"has_owner": True}})
    return {"ok": True, "token": token, "is_owner": True}


@api_router.post("/gate/admin/set-pin")
async def gate_admin_set_pin(payload: SetAdminPinIn):
    await _require_owner(payload.device_id, payload.token)
    new_pin = re.sub(r"\D", "", payload.new_pin or "")
    if len(new_pin) != 4:
        raise HTTPException(status_code=400, detail="Admin PIN must be 4 digits")
    await db.gate_config.update_one({"_id": GATE_CFG_ID}, {"$set": {"admin_pin": new_pin}})
    return {"ok": True}


@api_router.post("/gate/admin/toggle-gate")
async def gate_admin_toggle(payload: ToggleGateIn):
    await _require_owner(payload.device_id, payload.token)
    await db.gate_config.update_one({"_id": GATE_CFG_ID}, {"$set": {"enabled": bool(payload.enabled)}})
    cfg = await _gate_cfg()
    return {"enabled": cfg.get("enabled", False)}


@api_router.post("/gate/admin/generate")
async def gate_admin_generate(payload: GeneratePinIn):
    await _require_owner(payload.device_id, payload.token)
    # Generate a PIN unique among currently-active (unused, non-revoked) pins.
    # If we exhausted the 4-digit space of active PINs, fail gracefully.
    for _ in range(40):
        pin = _random_pin()
        clash = await db.invite_pins.find_one({"pin": pin, "used": False, "revoked": {"$ne": True}})
        if clash:
            continue
        doc = {
            "pin": pin,
            "label": (payload.label or "").strip()[:40],
            "used": False,
            "used_by_device": None,
            "used_at": None,
            "revoked": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.invite_pins.insert_one(doc)
        doc.pop("_id", None)
        return doc
    raise HTTPException(status_code=507, detail="Too many active PINs — revoke unused ones first")


@api_router.get("/gate/admin/pins")
async def gate_admin_pins(device_id: str, token: str):
    await _require_owner(device_id, token)
    cursor = db.invite_pins.find({}, {"_id": 0}).sort("created_at", -1).limit(200)
    return await cursor.to_list(length=200)


@api_router.post("/gate/admin/revoke-pin")
async def gate_admin_revoke(payload: RevokePinIn):
    await _require_owner(payload.device_id, payload.token)
    pin = re.sub(r"\D", "", payload.pin or "")
    r = await db.invite_pins.update_one({"pin": pin}, {"$set": {"revoked": True}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="PIN not found")
    # Also revoke any live device session that redeemed this PIN
    await db.device_sessions.update_many({"invite_pin": pin}, {"$set": {"revoked": True}})
    return {"ok": True}


@api_router.get("/gate/admin/config")
async def gate_admin_config(device_id: str, token: str):
    await _require_owner(device_id, token)
    cfg = await _gate_cfg()
    return {
        "enabled": cfg.get("enabled", False),
        "admin_pin_set": cfg.get("admin_pin") != DEFAULT_ADMIN_PIN,
        "recovery_set": bool(cfg.get("recovery_hash")),
    }


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.strip().encode("utf-8")).hexdigest()


class SetRecoveryIn(BaseModel):
    device_id: str
    token: str
    recovery_code: str


class RecoverOwnerIn(BaseModel):
    device_id: str
    recovery_code: str


@api_router.post("/gate/admin/set-recovery")
async def gate_set_recovery(payload: SetRecoveryIn):
    """Owner sets/updates the master recovery code. Stored only as a hash."""
    await _require_owner(payload.device_id, payload.token)
    code = (payload.recovery_code or "").strip()
    if len(code) < 6:
        raise HTTPException(status_code=400, detail="Recovery code must be at least 6 characters")
    await db.gate_config.update_one({"_id": GATE_CFG_ID}, {"$set": {"recovery_hash": _hash_code(code)}})
    return {"ok": True}


@api_router.post("/gate/recover-owner")
async def gate_recover_owner(payload: RecoverOwnerIn):
    """Reclaim owner access on ANY device using the master recovery code.
    This is the anti-lockout escape hatch: prove you know the recovery code and
    this device becomes an owner device with a fresh session token."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=15)
    recent = await db.gate_attempts.count_documents({
        "device_id": payload.device_id,
        "kind": "recover",
        "created_at": {"$gte": window_start.isoformat()},
    })
    if recent >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")
    await db.gate_attempts.insert_one({"device_id": payload.device_id, "kind": "recover", "created_at": now.isoformat()})

    cfg = await _gate_cfg()
    stored = cfg.get("recovery_hash")
    code = (payload.recovery_code or "").strip()
    if not stored or _hash_code(code) != stored:
        raise HTTPException(status_code=401, detail="Invalid recovery code")

    token = _new_token()
    await db.device_sessions.insert_one({
        "device_id": payload.device_id,
        "token": token,
        "is_owner": True,
        "created_at": now.isoformat(),
        "revoked": False,
        "invite_pin": None,
    })
    await db.gate_config.update_one({"_id": GATE_CFG_ID}, {"$set": {"has_owner": True}})
    await db.gate_attempts.delete_many({"device_id": payload.device_id, "kind": "recover"})
    return {"token": token, "is_owner": True}


app.include_router(api_router)


# ---------- Source code download (dev-only convenience) ----------
import io, zipfile

@app.get("/api/source-code.zip")
async def source_zip():
    """Bundle backend + frontend source into a single downloadable zip so the
    user can save the whole project locally. Excludes node_modules, .git,
    caches, and generated files."""
    from fastapi.responses import Response

    APP_ROOT = Path("/app")
    EXCLUDE_DIRS = {"node_modules", ".git", ".metro-cache", ".expo", "__pycache__", ".venv", "dist", "build", ".yarn"}
    EXCLUDE_SUFFIXES = {".log", ".pyc"}
    INCLUDE_DIRS = ["backend", "frontend"]
    INCLUDE_FILES_ROOT = ["README.md", "config.json"]

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Include selected root-level files
        for name in INCLUDE_FILES_ROOT:
            p = APP_ROOT / name
            if p.exists():
                zf.write(p, arcname=f"aib-demo/{name}")
        # Walk backend + frontend
        for top in INCLUDE_DIRS:
            top_dir = APP_ROOT / top
            if not top_dir.exists():
                continue
            for root, dirs, files in os.walk(top_dir):
                dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
                for f in files:
                    if any(f.endswith(s) for s in EXCLUDE_SUFFIXES):
                        continue
                    full = Path(root) / f
                    rel = full.relative_to(APP_ROOT)
                    try:
                        zf.write(full, arcname=f"aib-demo/{rel}")
                    except OSError:
                        pass
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="aib-demo-prototype.zip"'},
    )

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# --- Paste this into your backend/main.py file ---

# Path to your built frontend folder
frontend_dir = os.path.join(os.path.dirname(__file__), "../frontend/dist")

if os.path.exists(frontend_dir):
    # Serve static assets
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dir, "assets")), name="assets")

    # Catch-all route to serve the Expo web app (handles client-side routing)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(frontend_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dir, "index.html"))
