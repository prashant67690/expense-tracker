import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categorize } from "./categories.ts";
import { parseBankSms, splitSmsBatch } from "./parser.ts";
import { SAMPLE_SMS } from "./samples.ts";

describe("parseBankSms", () => {
  it("reads an HDFC UPI debit and ignores the available balance", () => {
    const result = parseBankSms(
      "HDFC Bank: Rs 1,250.00 debited from A/c **1234 on 02-10-26 to VPA swiggy@okhdfcbank. Avl Bal: Rs 45,230.12",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fields.amount, 1250);
    assert.equal(result.fields.currency, "INR");
    assert.equal(result.fields.direction, "debit");
    assert.equal(result.fields.bank, "HDFC Bank");
    assert.equal(result.fields.merchant, "Swiggy");
    assert.equal(result.fields.accountMask, "1234");
    assert.equal(result.fields.occurredAt, "2026-10-02");
    assert.equal(result.fields.balance, 45230.12);
  });

  it("reads an SBI debit and the bank named at the end", () => {
    const result = parseBankSms(
      "Dear Customer, INR 2,499.00 has been debited from your A/c no. XX4321 on 28-Sep-26 towards AMAZON PAY. Avl Bal INR 18,440.55 -SBI",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fields.amount, 2499);
    assert.equal(result.fields.bank, "SBI");
    assert.equal(result.fields.merchant, "Amazon Pay");
    assert.equal(result.fields.occurredAt, "2026-09-28");
    assert.equal(result.fields.accountMask, "4321");
  });

  it("treats an ICICI merchant credit line as a debit from the account", () => {
    const result = parseBankSms(
      "ICICI Bank Acct XX7781 debited for Rs 486.00 on 01-Oct-26; UBER credited. UPI:329184756201. Avl Bal Rs 9,102.10.",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fields.direction, "debit");
    assert.equal(result.fields.amount, 486);
    assert.equal(result.fields.merchant, "Uber");
    assert.equal(result.fields.bank, "ICICI Bank");
    assert.equal(result.fields.reference, "329184756201");
    assert.equal(result.fields.occurredAt, "2026-10-01");
  });

  it("reads salary credits with Indian digit grouping", () => {
    const result = parseBankSms(
      "INR 85,000.00 credited to your Axis Bank A/c XX9012 on 01-10-2026 by SALARY NEFT. Avl Bal INR 1,02,300.00.",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fields.direction, "credit");
    assert.equal(result.fields.amount, 85000);
    assert.equal(result.fields.balance, 102300);
    assert.equal(result.fields.merchant, "Salary Neft");
    assert.equal(result.fields.bank, "Axis Bank");
    assert.equal(result.fields.occurredAt, "2026-10-01");
  });

  it("reads a card spend and ignores the available limit", () => {
    const result = parseBankSms(
      "Rs.799.00 spent on your HDFC Bank Credit Card XX5566 at NETFLIX on 2026-09-18. Avl limit Rs.1,20,000.00",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fields.direction, "debit");
    assert.equal(result.fields.amount, 799);
    assert.equal(result.fields.merchant, "Netflix");
    assert.equal(result.fields.balance, 120000);
    assert.equal(result.fields.occurredAt, "2026-09-18");
  });

  it("skips OTP messages", () => {
    const result = parseBankSms(
      "123456 is the OTP for your HDFC Bank txn. Do not share it with anyone.",
    );
    assert.equal(result.ok, false);
  });

  it("reads a US debit and month-first dates", () => {
    const result = parseBankSms(
      "Chase: $42.18 was debited from account ending 2219 at WHOLE FOODS on 09/30/2026. Available balance $3,410.02.",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fields.amount, 42.18);
    assert.equal(result.fields.currency, "USD");
    assert.equal(result.fields.bank, "Chase");
    assert.equal(result.fields.merchant, "Whole Foods");
    assert.equal(result.fields.accountMask, "2219");
    assert.equal(result.fields.occurredAt, "2026-09-30");
    assert.equal(result.fields.balance, 3410.02);
  });

  it("prefers the bank signature over a handle domain", () => {
    const result = parseBankSms(
      "Paid Rs. 312.50 to blinkit@axisbank from A/c XX1234 on 30-09-26. Ref 884422. -Kotak Bank",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fields.bank, "Kotak");
    assert.equal(result.fields.merchant, "Blinkit");
    assert.equal(result.fields.amount, 312.5);
    assert.equal(result.fields.reference, "884422");
    assert.equal(result.fields.occurredAt, "2026-09-30");
  });

  it("reads refunds as credits from the merchant", () => {
    const result = parseBankSms(
      "Refund of Rs 499.00 credited to your SBI A/c XX4321 on 29-09-26 from AMAZON. Avl Bal Rs 18,939.55",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fields.direction, "credit");
    assert.equal(result.fields.merchant, "Amazon");
    assert.equal(result.fields.bank, "SBI");
    assert.equal(result.fields.amount, 499);
  });

  it("reads an SBI UPI debit that has no currency sign", () => {
    const result = parseBankSms(
      "Dear UPI user A/C X7112 debited by 950.00 on date 02Oct26 trf to JITENDRA Refno 130570826518 If not u? call-1800111109 for other services-18001234-SBI",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fields.amount, 950);
    assert.equal(result.fields.currency, "INR");
    assert.equal(result.fields.direction, "debit");
    assert.equal(result.fields.bank, "SBI");
    assert.equal(result.fields.merchant, "Jitendra");
    assert.equal(result.fields.accountMask, "7112");
    assert.equal(result.fields.occurredAt, "2026-10-02");
    assert.equal(result.fields.reference, "130570826518");
    assert.equal(categorize(result.fields.merchant, "trf to JITENDRA", "debit", []), "transfers");
  });

  it("reads a bill debit", () => {
    const result = parseBankSms(
      "Your Airtel bill of Rs 699.00 has been debited from HDFC Bank A/c **1234 on 15-09-26. Avl Bal Rs 44,531.12",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fields.merchant, "Airtel");
    assert.equal(result.fields.amount, 699);
    assert.equal(result.fields.direction, "debit");
    assert.equal(result.fields.occurredAt, "2026-09-15");
  });
});

describe("categorize", () => {
  it("files known merchants and lets a custom rule win", () => {
    assert.equal(categorize("Swiggy", "debited", "debit", []), "food");
    assert.equal(categorize("Salary Neft", "credited", "credit", []), "income");
    assert.equal(categorize("Amazon", "refund", "credit", []), "shopping");
    assert.equal(categorize("Unknown payee", "debited", "debit", []), "other");
    assert.equal(
      categorize("Swiggy", "debited", "debit", [
        { id: "1", keyword: "swiggy", categoryId: "entertainment" },
      ]),
      "entertainment",
    );
  });
});

describe("splitSmsBatch", () => {
  it("splits the sample batch and keeps the OTP as its own message", () => {
    const parts = splitSmsBatch(SAMPLE_SMS);
    assert.equal(parts.length, 10);
    assert.equal(parseBankSms(parts[5]).ok, false);
    assert.equal(parts.filter((part) => parseBankSms(part).ok).length, 9);
  });
});
