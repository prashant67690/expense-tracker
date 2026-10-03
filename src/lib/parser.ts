import type { Direction, ParseResult, ParsedFields } from "./types";

const BANKS: { name: string; test: RegExp }[] = [
  { name: "HDFC Bank", test: /\bHDFC\b/i },
  { name: "SBI", test: /\bSBI\b|\bState Bank of India\b/i },
  { name: "ICICI Bank", test: /\bICICI\b/i },
  { name: "Axis Bank", test: /\bAxis Bank\b/i },
  { name: "Kotak", test: /\bKotak\b/i },
  { name: "Yes Bank", test: /\bYes Bank\b/i },
  { name: "PNB", test: /\bPNB\b|\bPunjab National Bank\b/i },
  { name: "IndusInd", test: /\bIndusInd\b/i },
  { name: "IDFC FIRST", test: /\bIDFC\b/i },
  { name: "Bank of Baroda", test: /\bBank of Baroda\b/i },
  { name: "Chase", test: /\bChase\b/i },
  { name: "Bank of America", test: /\bBank of America\b|\bBofA\b/i },
  { name: "Wells Fargo", test: /\bWells Fargo\b/i },
  { name: "Citi", test: /\bCiti(?:bank)?\b/i },
  { name: "Amex", test: /\bAmex\b|\bAmerican Express\b/i },
  { name: "Paytm", test: /\bPaytm Payments Bank\b|\bPaytm\b/i },
];

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

type MoneyHit = {
  amount: number;
  currency: string;
  index: number;
};

const MONEY =
  /(?:₹|Rs\.?|INR|USD|EUR|GBP|\$|€|£)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;

function currencyFromToken(token: string): string {
  if (/₹|Rs|INR/i.test(token)) return "INR";
  if (/EUR|€/i.test(token)) return "EUR";
  if (/GBP|£/i.test(token)) return "GBP";
  return "USD";
}

function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

const BARE_AMOUNT =
  /\b(?:debited|credited|spent|paid|withdrawn|deducted)\s+by\s+([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;

function moneyHits(text: string): MoneyHit[] {
  const hits: MoneyHit[] = [];
  for (const match of text.matchAll(MONEY)) {
    const amount = parseAmount(match[1]);
    if (!Number.isFinite(amount)) continue;
    hits.push({
      amount,
      currency: currencyFromToken(match[0]),
      index: match.index ?? 0,
    });
  }
  for (const match of text.matchAll(BARE_AMOUNT)) {
    const amount = parseAmount(match[1]);
    if (!Number.isFinite(amount)) continue;
    hits.push({
      amount,
      currency: "INR",
      index: match.index ?? 0,
    });
  }
  return hits;
}

function isBalance(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 32), index);
  return /\b(avl|available|bal|balance|limit)\b/i.test(before);
}

function pickAmount(text: string, hits: MoneyHit[]): MoneyHit | null {
  const usable = hits.filter((hit) => !isBalance(text, hit.index));
  const pool = usable.length > 0 ? usable : hits;
  if (pool.length === 0) return null;

  const verb =
    /\b(debited|debit|credited|credit|spent|withdrawn|deducted|paid|purchase|refund|sent)\b/gi;
  let best = pool[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const match of text.matchAll(verb)) {
    const at = match.index ?? 0;
    for (const hit of pool) {
      const dist = Math.abs(hit.index - at);
      if (dist < bestDist) {
        bestDist = dist;
        best = hit;
      }
    }
  }
  return best;
}

function pickBalance(text: string, hits: MoneyHit[], primary: MoneyHit | null): number | null {
  const balance = hits.find(
    (hit) => hit !== primary && isBalance(text, hit.index),
  );
  return balance ? balance.amount : null;
}

function detectDirection(text: string): Direction | null {
  const creditedToAccount =
    /\b(credited|deposited|received)\b[^.]{0,40}\b(a\/c|acct|account|your)\b/i.test(
      text,
    ) || /\b(credited to|deposited (in|to)|received in)\b/i.test(text);
  const refund = /\brefund\b/i.test(text);
  const debit =
    /\b(debited|spent|withdrawn|deducted|paid|purchase|sent)\b/i.test(text);

  if (refund && !debit) return "credit";
  if (creditedToAccount && !/\bdebited\b/i.test(text)) return "credit";
  if (debit) return "debit";
  if (/\bcredited\b/i.test(text)) return "credit";
  return null;
}

function detectBank(text: string): string {
  const trailing = text.match(
    /[-–]\s*((?:[A-Z][A-Za-z]*\s+){0,3}(?:Bank|SBI|PNB|HDFC|ICICI|Kotak|Paytm))\s*\.?\s*$/,
  );
  if (trailing) {
    const known = BANKS.find((bank) => bank.test.test(trailing[1]));
    if (known) return known.name;
  }

  const lead = text.match(
    /^((?:[A-Z][A-Za-z.]*\s+){0,3}(?:Bank|Chase|Amex|Citi))\b/,
  );
  if (lead) {
    const known = BANKS.find((bank) => bank.test.test(lead[1]));
    if (known) return known.name;
  }

  const withoutHandles = text.replace(/\b[\w.+-]+@[\w.-]+\b/g, " ");
  const known = BANKS.find((bank) => bank.test.test(withoutHandles));
  return known?.name ?? "Unknown bank";
}

function detectAccount(text: string): string {
  const masked = text.match(/(?:\*{2,}|X{2,})(\d{2,6})/i);
  if (masked) return masked[1];
  const singleMask = text.match(/\bA\/?C\s+X+(\d{2,6})\b/i);
  if (singleMask) return singleMask[1];
  const ending = text.match(/\bending(?:\s+in)?\s+(\d{3,6})\b/i);
  if (ending) return ending[1];
  return "";
}

function expandYear(year: number): number {
  if (year < 100) return 2000 + year;
  return year;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function detectDate(text: string, currency: string): string | null {
  const compact = text.match(
    /\b(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(\d{2,4})\b/i,
  );
  if (compact) {
    const month = MONTHS.indexOf(compact[2].slice(0, 3).toLowerCase()) + 1;
    return isoDate(expandYear(Number(compact[3])), month, Number(compact[1]));
  }

  const named = text.match(
    /\b(\d{1,2})[-\s/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s,/]+(\d{2,4})\b/i,
  );
  if (named) {
    const month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
    return isoDate(expandYear(Number(named[3])), month, Number(named[1]));
  }

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (!numeric) return null;
  const a = Number(numeric[1]);
  const b = Number(numeric[2]);
  const year = expandYear(Number(numeric[3]));
  let month = a;
  let day = b;
  if (a > 12) {
    day = a;
    month = b;
  } else if (b > 12) {
    month = a;
    day = b;
  } else if (currency === "USD") {
    month = a;
    day = b;
  } else {
    day = a;
    month = b;
  }
  return isoDate(year, month, day);
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function prettyHandle(local: string): string {
  return titleCase(local.replace(/[._+-]+/g, " "));
}

function cleanLabel(value: string): string {
  return titleCase(value.replace(/[.,;:]+$/g, "").replace(/\s+/g, " "));
}

function extractMerchant(text: string): string {
  const handle = text.match(/\b([a-z0-9][a-z0-9._+-]{1,}@[a-z0-9.-]{2,})\b/i);
  if (handle) {
    const local = handle[1].split("@")[0];
    if (!/^\d+$/.test(local)) return prettyHandle(local);
  }

  const patterns = [
    /\byour\s+([A-Za-z][A-Za-z0-9 &]{1,32}?)\s+bill\b/i,
    /\b(?:trf|transfer(?:red)?)\s+to\s+([A-Za-z][A-Za-z0-9 &.'-]{1,40}?)(?=\s+(?:ref(?:no|erence)?|on|if)\b|\s*[.,]|$)/i,
    /\bat\s+([A-Za-z0-9][A-Za-z0-9 &.'-]{1,40}?)(?=\s+on\b|\s*[.,]|$)/i,
    /\btowards\s+([A-Za-z0-9][A-Za-z0-9 &.'-]{1,40}?)(?=\s*[.,]|\s+on\b|$)/i,
    /[;,]\s*([A-Za-z][A-Za-z0-9 &.'-]{1,32}?)\s+credited\b/i,
    /\bby\s+(?!a\/c\b|ac\b|acct\b|account\b)([A-Za-z][A-Za-z0-9 &.'-]{1,40}?)(?=\s*[.,]|$)/i,
    /\bfrom\s+(?!your\b|a\/c\b|ac\b|acct\b|account\b)([A-Za-z][A-Za-z0-9 &.'-]{1,32}?)(?=\s*[.,]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const label = cleanLabel(match[1]);
    if (label && !/^(Rs|Inr|Usd|The|Your)$/i.test(label)) return label;
  }

  return "Unknown payee";
}

function detectReference(text: string): string {
  const match = text.match(
    /\b(?:UPI(?!\s+user)|UTR|IMPS\s+Ref\s*no|Ref(?:erence)?\s*no\.?|Ref(?:erence)?(?=\s+\d))\s*[:#]?\s*([A-Z0-9]{6,})\b/i,
  );
  return match?.[1] ?? "";
}

function looksLikeOtp(text: string): boolean {
  const otp = /\b(otp|one[-\s]?time password|verification code|do not share|don't share)\b/i.test(
    text,
  );
  const movement = /\b(debited|credited|spent|withdrawn|deducted)\b/i.test(text);
  return otp && !movement;
}

export function parseBankSms(raw: string): ParseResult {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "Message is empty." };
  if (looksLikeOtp(text)) {
    return {
      ok: false,
      reason: "This looks like a one-time password, so it was left out of the ledger.",
    };
  }

  const direction = detectDirection(text);
  if (!direction) {
    return {
      ok: false,
      reason: "No debit or credit was found in this message.",
    };
  }

  const hits = moneyHits(text);
  const primary = pickAmount(text, hits);
  if (!primary || primary.amount <= 0) {
    return { ok: false, reason: "No amount was found in this message." };
  }

  const fields: ParsedFields = {
    amount: primary.amount,
    currency: primary.currency,
    direction,
    bank: detectBank(text),
    merchant: extractMerchant(text),
    accountMask: detectAccount(text),
    occurredAt: detectDate(text, primary.currency),
    balance: pickBalance(text, hits, primary),
    reference: detectReference(text),
  };

  return { ok: true, fields };
}

export function splitSmsBatch(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const blocks = trimmed
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (blocks.length > 1) return blocks;

  const lines = trimmed
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const messageLines = lines.filter((line) =>
    /\b(debited|credited|spent|otp|refund|paid)\b|₹|Rs\.?|INR|\$/i.test(line),
  );
  if (lines.length > 1 && messageLines.length >= 2) return lines;
  return [trimmed];
}
