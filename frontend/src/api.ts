// API helpers for AIB Demo Prototype
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getProfile: () => req("/profile"),
  updateProfile: (patch: Record<string, any>) =>
    req("/profile", { method: "PATCH", body: JSON.stringify(patch) }),
  listTransactions: () => req("/transactions"),
  getTransaction: (id: string) => req(`/transactions/${id}`),
  ibanLookup: (iban: string) =>
    req(`/iban/lookup?iban=${encodeURIComponent(iban)}`),
  prepareTransfer: (payload: {
    recipient_name: string;
    iban: string;
    amount_cents: number;
    reference?: string;
    bic?: string;
    receipt_email?: string;
    send_email?: boolean;
  }) => req("/transfers/prepare", { method: "POST", body: JSON.stringify(payload) }),
  confirmTransfer: (transfer_id: string) =>
    req("/transfers/confirm", { method: "POST", body: JSON.stringify({ transfer_id }) }),
  getTransfer: (id: string) => req(`/transfers/${id}`),
  verifyEmail: (email: string) =>
    req("/profile/verify-email", { method: "POST", body: JSON.stringify({ email }) }),
  listPayees: () => req("/payees"),
  deletePayee: (id: string) => req(`/payees/${id}`, { method: "DELETE" }),
  chatMessage: (session_id: string, message: string) =>
    req("/chat/message", { method: "POST", body: JSON.stringify({ session_id, message }) }),
  getChat: (session_id: string) => req(`/chat/${session_id}`),
  clearChat: (session_id: string) => req(`/chat/${session_id}`, { method: "DELETE" }),
  listBudgets: () => req("/budgets"),
  createBudget: (body: { name: string; monthly_cap_cents: number; categories?: string[] }) =>
    req("/budgets", { method: "POST", body: JSON.stringify(body) }),
  deleteBudget: (id: string) => req(`/budgets/${id}`, { method: "DELETE" }),
};

export function formatEuros(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = (abs / 100).toFixed(2);
  return `${sign}€${euros}`;
}

export function formatIban(iban: string): string {
  const clean = iban.replace(/\s+/g, "").toUpperCase();
  return clean.match(/.{1,4}/g)?.join(" ") ?? clean;
}
