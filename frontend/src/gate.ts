// Invite gate — device identity + server session helpers.
//
// Every install gets ONE random device_id stored in secure storage. That id
// is what the backend uses to bind a redeemed 4-digit PIN to this phone. On
// every launch we ask the server "is my device_id + token still valid?" and
// route accordingly. Owner devices get an `is_owner` flag which unlocks the
// admin panel in Settings.
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const DEVICE_ID_KEY = "aib.gate.device_id";
const TOKEN_KEY = "aib.gate.token";
const IS_OWNER_KEY = "aib.gate.is_owner"; // "1" | "0"

function uuid(): string {
  // RFC4122 v4, browser + native safe
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function getDeviceId(): Promise<string> {
  let id = await storage.secureGet<string>(DEVICE_ID_KEY, "");
  if (!id) {
    id = uuid();
    await storage.secureSet(DEVICE_ID_KEY, id);
  }
  return id;
}

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function getGateStatus(): Promise<{ enabled: boolean; has_owner: boolean }> {
  return api("/gate/status");
}

export async function verifyDevice(): Promise<{ valid: boolean; is_owner: boolean }> {
  const device_id = await getDeviceId();
  const token = (await storage.secureGet<string>(TOKEN_KEY, "")) || "";
  if (!token) return { valid: false, is_owner: false };
  try {
    return await api("/gate/verify-device", {
      method: "POST",
      body: JSON.stringify({ device_id, token }),
    });
  } catch {
    return { valid: false, is_owner: false };
  }
}

export async function bootstrapOwner(): Promise<{ token: string }> {
  const device_id = await getDeviceId();
  const res = await api("/gate/bootstrap-owner", {
    method: "POST",
    body: JSON.stringify({ device_id }),
  });
  await storage.secureSet(TOKEN_KEY, res.token);
  await storage.secureSet(IS_OWNER_KEY, "1");
  return res;
}

export async function redeemPin(pin: string): Promise<{ token: string }> {
  const device_id = await getDeviceId();
  const res = await api("/gate/redeem", {
    method: "POST",
    body: JSON.stringify({ device_id, pin }),
  });
  await storage.secureSet(TOKEN_KEY, res.token);
  await storage.secureSet(IS_OWNER_KEY, "0");
  return res;
}

// Master recovery: reclaim owner access on this device using the recovery code.
export async function recoverOwner(recovery_code: string): Promise<{ token: string }> {
  const device_id = await getDeviceId();
  const res = await api("/gate/recover-owner", {
    method: "POST",
    body: JSON.stringify({ device_id, recovery_code }),
  });
  await storage.secureSet(TOKEN_KEY, res.token);
  await storage.secureSet(IS_OWNER_KEY, "1");
  return res;
}

export async function getSessionSecrets() {
  const device_id = await getDeviceId();
  const token = (await storage.secureGet<string>(TOKEN_KEY, "")) || "";
  return { device_id, token };
}

export async function isOwner(): Promise<boolean> {
  return (await storage.secureGet<string>(IS_OWNER_KEY, "0")) === "1";
}

// Admin endpoints
export const admin = {
  login: async (admin_pin: string) => {
    const { device_id, token } = await getSessionSecrets();
    return api("/gate/admin/login", {
      method: "POST",
      body: JSON.stringify({ device_id, token, admin_pin }),
    });
  },
  toggleGate: async (enabled: boolean) => {
    const { device_id, token } = await getSessionSecrets();
    return api("/gate/admin/toggle-gate", {
      method: "POST",
      body: JSON.stringify({ device_id, token, enabled }),
    });
  },
  generate: async (label?: string) => {
    const { device_id, token } = await getSessionSecrets();
    return api("/gate/admin/generate", {
      method: "POST",
      body: JSON.stringify({ device_id, token, label }),
    });
  },
  listPins: async () => {
    const { device_id, token } = await getSessionSecrets();
    return api(`/gate/admin/pins?device_id=${encodeURIComponent(device_id)}&token=${encodeURIComponent(token)}`);
  },
  revokePin: async (pin: string) => {
    const { device_id, token } = await getSessionSecrets();
    return api("/gate/admin/revoke-pin", {
      method: "POST",
      body: JSON.stringify({ device_id, token, pin }),
    });
  },
  setAdminPin: async (new_pin: string) => {
    const { device_id, token } = await getSessionSecrets();
    return api("/gate/admin/set-pin", {
      method: "POST",
      body: JSON.stringify({ device_id, token, new_pin }),
    });
  },
  setRecoveryCode: async (recovery_code: string) => {
    const { device_id, token } = await getSessionSecrets();
    return api("/gate/admin/set-recovery", {
      method: "POST",
      body: JSON.stringify({ device_id, token, recovery_code }),
    });
  },
  config: async () => {
    const { device_id, token } = await getSessionSecrets();
    return api(`/gate/admin/config?device_id=${encodeURIComponent(device_id)}&token=${encodeURIComponent(token)}`);
  },
};
