import type { CategoryRule, Transaction } from "./types";

const KEY = "khaata.ledger.v1";

export type LedgerData = {
  transactions: Transaction[];
  rules: CategoryRule[];
};

export const EMPTY_LEDGER: LedgerData = {
  transactions: [],
  rules: [],
};

export function loadLedger(): LedgerData {
  if (typeof window === "undefined") return EMPTY_LEDGER;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_LEDGER;
    const parsed = JSON.parse(raw) as Partial<LedgerData>;
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    };
  } catch {
    return EMPTY_LEDGER;
  }
}

export function saveLedger(data: LedgerData) {
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

let current = EMPTY_LEDGER;
let hydrated = false;
const listeners = new Set<() => void>();

export function subscribeLedger(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLedger(): LedgerData {
  if (!hydrated && typeof window !== "undefined") {
    current = loadLedger();
    hydrated = true;
  }
  return current;
}

export function getServerLedger(): LedgerData {
  return EMPTY_LEDGER;
}

export function updateLedger(recipe: (data: LedgerData) => LedgerData) {
  if (!hydrated && typeof window !== "undefined") {
    current = loadLedger();
    hydrated = true;
  }
  current = recipe(current);
  if (typeof window !== "undefined") saveLedger(current);
  for (const listener of listeners) listener();
}
