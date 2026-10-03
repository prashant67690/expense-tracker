export type Direction = "debit" | "credit";

export type ParsedFields = {
  amount: number;
  currency: string;
  direction: Direction;
  bank: string;
  merchant: string;
  accountMask: string;
  occurredAt: string | null;
  balance: number | null;
  reference: string;
};

export type Transaction = ParsedFields & {
  id: string;
  categoryId: string;
  rawSms: string;
  note: string;
  source: "sms" | "manual";
  createdAt: string;
};

export type CategoryRule = {
  id: string;
  keyword: string;
  categoryId: string;
};

export type ParseResult =
  | { ok: true; fields: ParsedFields }
  | { ok: false; reason: string };
