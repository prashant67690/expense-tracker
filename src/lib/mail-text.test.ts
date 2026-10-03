/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBankSms } from "./parser.ts";
import { bankMailQuery, htmlToText, messageText } from "./mail-text.ts";

describe("bank mail text", () => {
  it("limits the Gmail search to bank senders and drops password mail", () => {
    const query = bankMailQuery();
    assert.match(query, /from:hdfcbank\.net/);
    assert.match(query, /from:hdfcbank\.bank\.in/);
    assert.match(query, /upi txn/);
    assert.match(query, /salary/);
    assert.match(query, /from:icicibank\.com/);
    assert.match(query, /-subject:otp/);
  });

  it("reads a payment amount out of an HTML bank email", () => {
    const text = messageText(
      {
        mimeType: "text/html",
        body: {
          data: Buffer.from(
            "<p>HDFC Bank: Rs 1,250.00 debited from A/c **1234 on 02-10-26 to VPA swiggy@okhdfcbank.</p>",
          ).toString("base64url"),
        },
      },
      [
        { name: "From", value: "HDFC Bank Alerts <alerts@hdfcbank.net>" },
        { name: "Subject", value: "Debit alert" },
        { name: "Date", value: "Fri, 2 Oct 2026 10:00:00 +0530" },
      ],
    );
    const parsed = parseBankSms(text);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.fields.amount, 1250);
    assert.equal(parsed.fields.merchant, "Swiggy");
    assert.equal(parsed.fields.bank, "HDFC Bank");
  });

  it("strips tags and keeps the rupee amount", () => {
    assert.match(htmlToText("<b>Rs 40.00</b> debited"), /Rs 40\.00 debited/);
  });
});
