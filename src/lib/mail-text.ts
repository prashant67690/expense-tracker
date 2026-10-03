export type MailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: MailPart[];
};

export type MailHeader = {
  name?: string;
  value?: string;
};

const BANK_DOMAINS = [
  "hdfcbank.net",
  "hdfcbank.com",
  "hdfcbank.bank.in",
  "comm.hdfcbank.bank.in",
  "icicibank.com",
  "sbi.co.in",
  "onlinesbi.sbi",
  "axisbank.com",
  "kotak.com",
  "kotakbank.com",
  "yesbank.in",
  "pnbindia.in",
  "indusind.com",
  "idfcfirstbank.com",
  "bankofbaroda.in",
  "bankofbaroda.com",
  "paytmbank.com",
  "sc.com",
  "citibank.com",
  "citi.com",
  "americanexpress.com",
  "chase.com",
  "wellsfargo.com",
  "bankofamerica.com",
];

export function bankMailQuery(): string {
  const from = BANK_DOMAINS.map((domain) => `from:${domain}`).join(" OR ");
  return `newer_than:30d (${from}) (debited OR credited OR spent OR salary OR "has been added" OR "payment of" OR "transaction alert" OR "upi txn" OR txn) -subject:otp -subject:"one time password" -subject:"verification code"`;
}

export function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64").toString("utf8");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8377;|&rupee;/gi, "₹")
    .replace(/&rsquo;|&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function headerValue(headers: MailHeader[], name: string): string {
  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value?.trim() ?? "";
}

function collectBodies(part: MailPart, plain: string[], html: string[]) {
  if (part.body?.data) {
    const text = decodeBase64Url(part.body.data);
    if (part.mimeType === "text/plain") plain.push(text);
    if (part.mimeType === "text/html") html.push(text);
  }
  for (const child of part.parts ?? []) collectBodies(child, plain, html);
}

export function messageText(part: MailPart, headers: MailHeader[] = []): string {
  const plain: string[] = [];
  const html: string[] = [];
  collectBodies(part, plain, html);
  const body =
    plain.map((item) => item.trim()).filter(Boolean).join("\n") ||
    html.map((item) => htmlToText(item)).filter(Boolean).join("\n");
  const lead = [headerValue(headers, "From"), headerValue(headers, "Subject"), headerValue(headers, "Date")]
    .filter(Boolean)
    .join("\n");
  return [body.trim(), lead].filter(Boolean).join("\n").slice(0, 12000);
}
