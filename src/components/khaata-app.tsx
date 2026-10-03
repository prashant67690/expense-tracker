"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { CATEGORIES, categorize, categoryById } from "@/lib/categories";
import {
  currentMonthKey,
  formatDate,
  formatMoney,
  formatMonth,
  monthKey,
  shiftMonth,
} from "@/lib/format";
import { parseBankSms, splitSmsBatch } from "@/lib/parser";
import { SAMPLE_SMS } from "@/lib/samples";
import { getLedger, getServerLedger, subscribeLedger, updateLedger } from "@/lib/storage";
import type { CategoryRule, Direction, Transaction } from "@/lib/types";

type View = "overview" | "inbox" | "ledger" | "rules";

type Draft = {
  key: string;
  raw: string;
  include: boolean;
  reason?: string;
  duplicate?: boolean;
  transaction?: Omit<Transaction, "id" | "createdAt">;
};

const VIEWS: { id: View; label: string; caption: string }[] = [
  { id: "overview", label: "Overview", caption: "Month" },
  { id: "inbox", label: "Inbox", caption: "Paste SMS" },
  { id: "ledger", label: "Ledger", caption: "All lines" },
  { id: "rules", label: "Rules", caption: "Categories" },
];

const SWATCH: Record<string, string> = {
  food: "#c2410c",
  groceries: "#3f6212",
  transport: "#1d4ed8",
  shopping: "#6d28d9",
  bills: "#0f6b50",
  entertainment: "#be185d",
  health: "#0e7490",
  transfers: "#57534e",
  income: "#0f6b50",
  other: "#a16207",
};

function newId(): string {
  return crypto.randomUUID();
}

function sameMessage(left: string, right: string): boolean {
  return left.replace(/\s+/g, " ").trim().toLowerCase() === right.replace(/\s+/g, " ").trim().toLowerCase();
}

export function KhaataApp() {
  const data = useSyncExternalStore(subscribeLedger, getLedger, getServerLedger);
  const [view, setView] = useState<View>("overview");
  const [month, setMonth] = useState(currentMonthKey());
  const [allMonths, setAllMonths] = useState(false);
  const [currency, setCurrency] = useState("INR");
  const [ledgerCategory, setLedgerCategory] = useState("all");

  const transactions = data.transactions;
  const rules = data.rules;

  function addTransactions(items: Omit<Transaction, "id" | "createdAt">[]) {
    const createdAt = new Date().toISOString();
    updateLedger((current) => {
      const next = items
        .filter(
          (item) =>
            item.source === "manual" ||
            !current.transactions.some((existing) => sameMessage(existing.rawSms, item.rawSms)),
        )
        .map((item) => ({ ...item, id: newId(), createdAt }));
      return { ...current, transactions: [...next, ...current.transactions] };
    });
  }

  function updateTransaction(id: string, patch: Partial<Transaction>) {
    updateLedger((current) => ({
      ...current,
      transactions: current.transactions.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function deleteTransaction(id: string) {
    updateLedger((current) => ({
      ...current,
      transactions: current.transactions.filter((item) => item.id !== id),
    }));
  }

  function clearTransactions() {
    updateLedger((current) => ({ transactions: [], rules: current.rules }));
  }

  function addRule(keyword: string, categoryId: string) {
    const cleaned = keyword.trim();
    if (cleaned.length < 2) return;
    updateLedger((current) => {
      const exists = current.rules.some((rule) => rule.keyword.toLowerCase() === cleaned.toLowerCase());
      if (exists) return current;
      const rule: CategoryRule = { id: newId(), keyword: cleaned, categoryId };
      return { ...current, rules: [rule, ...current.rules] };
    });
  }

  function deleteRule(id: string) {
    updateLedger((current) => ({
      ...current,
      rules: current.rules.filter((rule) => rule.id !== id),
    }));
  }

  const scoped = useMemo(() => {
    if (allMonths) return transactions;
    return transactions.filter((item) => monthKey(item.occurredAt, item.createdAt) === month);
  }, [allMonths, month, transactions]);

  const currencies = useMemo(() => {
    const found = new Set(scoped.map((item) => item.currency));
    return [...found];
  }, [scoped]);

  const activeCurrency = currencies.includes(currency) ? currency : (currencies[0] ?? currency);
  const inCurrency = scoped.filter((item) => item.currency === activeCurrency);

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-paper-2 lg:flex lg:min-h-full lg:flex-col lg:px-4 lg:py-6">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Sections">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
              className={`rounded-xl px-3 py-2 text-left ${
                view === item.id ? "bg-ink text-paper-2" : "hover:bg-paper"
              }`}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span className={`block text-xs ${view === item.id ? "text-paper" : "text-muted"}`}>
                {item.caption}
              </span>
            </button>
          ))}
        </nav>
        <p className="mt-auto px-3 pt-8 text-xs leading-5 text-muted">
          Messages stay in this browser. OTP texts are skipped and never filed.
        </p>
      </aside>

      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div className="lg:hidden">
            <Brand />
          </div>
          <MonthControls
            month={month}
            allMonths={allMonths}
            onPrev={() => setMonth((value) => shiftMonth(value, -1))}
            onNext={() => setMonth((value) => shiftMonth(value, 1))}
            onToggleAll={() => setAllMonths((value) => !value)}
          />
        </header>

        <div className="py-6">
          {view === "overview" && (
            <Overview
              transactions={inCurrency}
              currency={activeCurrency}
              currencies={currencies}
              onCurrency={setCurrency}
              onOpenInbox={() => setView("inbox")}
              onOpenLedger={(categoryId) => {
                setLedgerCategory(categoryId);
                setView("ledger");
              }}
            />
          )}
          {view === "inbox" && (
            <Inbox
              existing={transactions}
              rules={rules}
              onSave={(items) => {
                addTransactions(items);
                setView("overview");
              }}
            />
          )}
          {view === "ledger" && (
            <Ledger
              transactions={transactions}
              month={month}
              allMonths={allMonths}
              categoryId={ledgerCategory}
              onCategory={setLedgerCategory}
              onUpdate={updateTransaction}
              onDelete={deleteTransaction}
              onClear={clearTransactions}
            />
          )}
          {view === "rules" && <Rules rules={rules} onAdd={addRule} onDelete={deleteRule} />}
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-paper-2/95 py-2 pl-12 pr-2 backdrop-blur lg:hidden"
        aria-label="Sections"
      >
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            aria-current={view === item.id ? "page" : undefined}
            className={`rounded-lg px-2 py-2 text-xs font-medium ${
              view === item.id ? "bg-ink text-paper-2" : "text-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Brand() {
  return (
    <div className="px-1">
      <p className="font-serif text-3xl tracking-tight text-ink">Khaata</p>
      <p className="text-sm text-muted">Bank texts, filed.</p>
    </div>
  );
}

function MonthControls({
  month,
  allMonths,
  onPrev,
  onNext,
  onToggleAll,
}: {
  month: string;
  allMonths: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleAll: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-full border border-line bg-paper-2">
        <button type="button" className="px-3 py-2 text-sm" onClick={onPrev} aria-label="Previous month">
          ←
        </button>
        <span className="min-w-36 text-center text-sm font-medium">
          {allMonths ? "All months" : formatMonth(month)}
        </span>
        <button type="button" className="px-3 py-2 text-sm" onClick={onNext} aria-label="Next month">
          →
        </button>
      </div>
      <button
        type="button"
        onClick={onToggleAll}
        className="rounded-full border border-line bg-paper-2 px-3 py-2 text-sm"
      >
        {allMonths ? "Show one month" : "Show all months"}
      </button>
    </div>
  );
}

function Overview({
  transactions,
  currency,
  currencies,
  onCurrency,
  onOpenInbox,
  onOpenLedger,
}: {
  transactions: Transaction[];
  currency: string;
  currencies: string[];
  onCurrency: (currency: string) => void;
  onOpenInbox: () => void;
  onOpenLedger: (categoryId: string) => void;
}) {
  const spent = transactions
    .filter((item) => item.direction === "debit")
    .reduce((sum, item) => sum + item.amount, 0);
  const received = transactions
    .filter((item) => item.direction === "credit")
    .reduce((sum, item) => sum + item.amount, 0);
  const byCategory = rollup(
    transactions.filter((item) => item.direction === "debit"),
    (item) => item.categoryId,
  );
  const byBank = rollup(transactions.filter((item) => item.direction === "debit"), (item) => item.bank);
  const recent = [...transactions].sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""));

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Spent" value={formatMoney(spent, currency)} tone="clay" />
        <Stat label="Received" value={formatMoney(received, currency)} tone="green" />
        <Stat
          label="Net"
          value={formatMoney(received - spent, currency)}
          tone={received - spent >= 0 ? "green" : "clay"}
        />
      </section>

      {currencies.length > 1 && (
        <div className="flex flex-wrap gap-2" aria-label="Currency">
          {currencies.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onCurrency(item)}
              className={`rounded-full px-3 py-1 text-sm ${
                item === currency ? "bg-ink text-paper-2" : "border border-line bg-paper-2"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {transactions.length === 0 ? (
        <EmptyLedger onOpenInbox={onOpenInbox} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-line bg-paper-2 p-5">
            <h2 className="font-serif text-2xl">Where it went</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {byCategory.map(([categoryId, amount]) => (
                <li key={categoryId}>
                  <button type="button" className="w-full text-left" onClick={() => onOpenLedger(categoryId)}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{categoryById(categoryId).label}</span>
                      <span>{formatMoney(amount, currency)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-paper">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(6, (amount / (byCategory[0]?.[1] || amount)) * 100)}%`,
                          background: SWATCH[categoryId] ?? SWATCH.other,
                        }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-line bg-paper-2 p-5">
            <h2 className="font-serif text-2xl">By bank</h2>
            <ul className="mt-4 divide-y divide-dashed divide-line">
              {byBank.map(([bank, amount]) => (
                <li key={bank} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span>{bank}</span>
                  <span className="font-medium">{formatMoney(amount, currency)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl">Latest movements</h2>
          <div className="mt-3 overflow-hidden rounded-3xl border border-line bg-paper-2">
            {recent.slice(0, 8).map((item) => (
              <Receipt key={item.id} transaction={item} />
            ))}
          </div>
        </section>
      )}

      <HowItWorks />
    </div>
  );
}

function EmptyLedger({ onOpenInbox }: { onOpenInbox: () => void }) {
  return (
    <section className="rounded-3xl border border-dashed border-line bg-paper-2 px-5 py-6 sm:py-10">
      <h2 className="font-serif text-2xl tracking-tight sm:text-3xl">Nothing filed for this period.</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Paste a bank debit alert, or load a sample month, and Khaata will pull out the amount, the bank,
        the payee, and a category.
      </p>
      <button
        type="button"
        onClick={onOpenInbox}
        className="mt-5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper-2"
      >
        Paste a bank SMS
      </button>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="grid gap-4 rounded-3xl bg-ink px-5 py-6 text-paper-2 md:grid-cols-3">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-[#d7c4a3]">How a phone app does this</p>
        <h2 className="mt-2 font-serif text-2xl">The bank texts you. The ledger files it.</h2>
      </div>
      <ol className="space-y-3 text-sm leading-6 text-[#f3eee6] md:col-span-2">
        <li>
          <span className="font-medium">1. Catch the alert.</span> A website cannot open the SMS inbox. On
          Android, a personal app can ask to read your own texts, or listen to bank notifications. iPhone
          apps cannot read SMS. Paste, share, or email alerts work on both.
        </li>
        <li>
          <span className="font-medium">2. Read the sentence, not the whole inbox.</span> Keep lines that say
          debited, credited, or spent. Drop OTP and “do not share” messages before they ever become a
          transaction.
        </li>
        <li>
          <span className="font-medium">3. File the parameters.</span> Amount, debit or credit, bank, masked
          account, payee, date, and category. A keyword rule such as “swiggy → Food” fixes the next one
          automatically.
        </li>
      </ol>
    </section>
  );
}

function Inbox({
  existing,
  rules,
  onSave,
}: {
  existing: Transaction[];
  rules: CategoryRule[];
  onSave: (items: Omit<Transaction, "id" | "createdAt">[]) => void;
}) {
  const [raw, setRaw] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [formError, setFormError] = useState("");

  function buildDrafts(input: string) {
    const parts = splitSmsBatch(input);
    const seen = new Set<string>();
    const next = parts.map((part) => {
      const parsed = parseBankSms(part);
      const normalized = part.replace(/\s+/g, " ").trim().toLowerCase();
      const duplicate =
        existing.some((item) => sameMessage(item.rawSms, part)) || seen.has(normalized);
      seen.add(normalized);
      if (!parsed.ok) {
        return { key: newId(), raw: part, include: false, reason: parsed.reason };
      }
      const categoryId = categorize(parsed.fields.merchant, part, parsed.fields.direction, rules);
      return {
        key: newId(),
        raw: part,
        include: !duplicate,
        duplicate,
        reason: duplicate ? "Already in the ledger." : undefined,
        transaction: {
          ...parsed.fields,
          categoryId,
          rawSms: part.trim(),
          note: "",
          source: "sms" as const,
        },
      };
    });
    setDrafts(next);
  }

  const ready = drafts.filter((draft) => draft.include && draft.transaction);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-line bg-paper-2 p-5">
        <h2 className="font-serif text-3xl tracking-tight">Paste the alert</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          One message, or several separated by a blank line. Khaata reads the debit, ignores the balance,
          and leaves password texts out.
        </p>
        <label className="mt-4 block text-sm font-medium" htmlFor="sms">
          Bank SMS
        </label>
        <textarea
          id="sms"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          rows={9}
          placeholder="HDFC Bank: Rs 1,250.00 debited from A/c **1234…"
          className="mt-2 w-full resize-y rounded-2xl border border-line bg-paper px-3 py-3 text-sm leading-6"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => buildDrafts(raw)}
            className="rounded-full bg-green px-4 py-2 text-sm font-medium text-white"
          >
            Read messages
          </button>
          <button
            type="button"
            onClick={() => {
              setRaw(SAMPLE_SMS);
              buildDrafts(SAMPLE_SMS);
            }}
            className="rounded-full border border-line px-4 py-2 text-sm"
          >
            Load a sample month
          </button>
          <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm">
            Upload a text file
            <input
              type="file"
              accept=".txt,text/plain"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                setRaw(text);
                buildDrafts(text);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        {drafts.length > 0 && (
          <button
            type="button"
            disabled={ready.length === 0}
            onClick={() => onSave(ready.map((draft) => draft.transaction!))}
            className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper-2 disabled:opacity-40"
          >
            File {ready.length} {ready.length === 1 ? "transaction" : "transactions"}
          </button>
        )}
      </section>

      <section className="flex flex-col gap-3">
        {drafts.length === 0 && (
          <div className="rounded-3xl border border-dashed border-line px-5 py-8 text-sm leading-6 text-muted">
            Nothing read yet. After you paste, each alert becomes a slip you can recategorize before it
            hits the ledger.
          </div>
        )}
        {drafts.map((draft) => (
          <article key={draft.key} className="rounded-3xl border border-line bg-paper-2 p-4">
            {draft.transaction ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.include}
                      onChange={(event) =>
                        setDrafts((current) =>
                          current.map((item) =>
                            item.key === draft.key ? { ...item, include: event.target.checked } : item,
                          ),
                        )
                      }
                    />
                    File this
                  </label>
                  <p className={`font-serif text-2xl ${draft.transaction.direction === "debit" ? "text-clay" : "text-green"}`}>
                    {draft.transaction.direction === "debit" ? "−" : "+"}
                    {formatMoney(draft.transaction.amount, draft.transaction.currency)}
                  </p>
                </div>
                <p className="mt-2 font-medium">{draft.transaction.merchant}</p>
                <p className="text-sm text-muted">
                  {draft.transaction.bank}
                  {draft.transaction.accountMask ? ` · ··${draft.transaction.accountMask}` : ""} ·{" "}
                  {formatDate(draft.transaction.occurredAt)} · {draft.transaction.direction}
                </p>
                {draft.reason && <p className="mt-2 text-sm text-gold">{draft.reason}</p>}
                <label className="mt-3 block text-xs font-medium text-muted" htmlFor={`cat-${draft.key}`}>
                  Category
                </label>
                <select
                  id={`cat-${draft.key}`}
                  value={draft.transaction.categoryId}
                  onChange={(event) =>
                    setDrafts((current) =>
                      current.map((item) =>
                        item.key === draft.key && item.transaction
                          ? { ...item, transaction: { ...item.transaction, categoryId: event.target.value } }
                          : item,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gold">
                  {draft.reason?.includes("one-time password") ? "Skipped" : "Not filed"}
                </p>
                <p className="mt-1 text-sm text-muted">{draft.reason}</p>
              </>
            )}
            <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted">{draft.raw}</p>
          </article>
        ))}

        <section className="rounded-3xl border border-line bg-paper-2 p-4">
          <button type="button" className="text-sm font-medium" onClick={() => setManualOpen((open) => !open)}>
            {manualOpen ? "Hide manual entry" : "Add a transaction without an SMS"}
          </button>
          {manualOpen && (
            <ManualForm
              rules={rules}
              error={formError}
              onSubmit={(item) => {
                setFormError("");
                onSave([item]);
              }}
              onError={setFormError}
            />
          )}
        </section>
      </section>
    </div>
  );
}

function ManualForm({
  rules,
  error,
  onSubmit,
  onError,
}: {
  rules: CategoryRule[];
  error: string;
  onSubmit: (item: Omit<Transaction, "id" | "createdAt">) => void;
  onError: (message: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [direction, setDirection] = useState<Direction>("debit");
  const [bank, setBank] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("auto");
  const [date, setDate] = useState(currentMonthKey() + "-01");
  const [accountMask, setAccountMask] = useState("");
  const [note, setNote] = useState("");

  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
          onError("Enter an amount greater than zero.");
          return;
        }
        if (!merchant.trim()) {
          onError("Name the payee or source.");
          return;
        }
        const guessed = categorize(merchant, note, direction, rules);
        onSubmit({
          amount: value,
          currency,
          direction,
          bank: bank.trim() || "Unknown bank",
          merchant: merchant.trim(),
          accountMask: accountMask.trim(),
          occurredAt: date || null,
          balance: null,
          reference: "",
          categoryId: categoryId === "auto" ? guessed : categoryId,
          rawSms: note.trim() || `Manual ${direction} ${merchant.trim()}`,
          note: note.trim(),
          source: "manual",
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount" id="manual-amount">
          <input
            id="manual-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Currency" id="manual-currency">
          <select
            id="manual-currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          >
            {["INR", "USD", "EUR", "GBP"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Direction" id="manual-direction">
          <select
            id="manual-direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value as Direction)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </Field>
        <Field label="Date" id="manual-date">
          <input
            id="manual-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Payee" id="manual-merchant">
          <input
            id="manual-merchant"
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Bank" id="manual-bank">
          <input
            id="manual-bank"
            value={bank}
            onChange={(event) => setBank(event.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Category" id="manual-category">
          <select
            id="manual-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          >
            <option value="auto">Match from the payee</option>
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Account last digits" id="manual-account">
          <input
            id="manual-account"
            value={accountMask}
            onChange={(event) => setAccountMask(event.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <Field label="Note" id="manual-note">
        <input
          id="manual-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
        />
      </Field>
      {error && <p className="text-sm text-clay">{error}</p>}
      <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper-2">
        Add to ledger
      </button>
    </form>
  );
}

function Ledger({
  transactions,
  month,
  allMonths,
  categoryId,
  onCategory,
  onUpdate,
  onDelete,
  onClear,
}: {
  transactions: Transaction[];
  month: string;
  allMonths: boolean;
  categoryId: string;
  onCategory: (categoryId: string) => void;
  onUpdate: (id: string, patch: Partial<Transaction>) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<"all" | Direction>("all");
  const [bank, setBank] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const banks = [...new Set(transactions.map((item) => item.bank))].sort();
  const visible = transactions.filter((item) => {
    if (!allMonths && monthKey(item.occurredAt, item.createdAt) !== month) return false;
    if (categoryId !== "all" && item.categoryId !== categoryId) return false;
    if (direction !== "all" && item.direction !== direction) return false;
    if (bank !== "all" && item.bank !== bank) return false;
    if (query.trim()) {
      const haystack = `${item.merchant} ${item.bank} ${item.note} ${item.rawSms}`.toLowerCase();
      if (!haystack.includes(query.trim().toLowerCase())) return false;
    }
    return true;
  });
  const current = visible.find((item) => item.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl tracking-tight">Ledger</h2>
          <p className="text-sm text-muted">
            {visible.length} {visible.length === 1 ? "line" : "lines"}
            {allMonths ? " across every month" : ` in ${formatMonth(month)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(visible)}
            disabled={visible.length === 0}
            className="rounded-full border border-line bg-paper-2 px-3 py-2 text-sm disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              if (transactions.length === 0) return;
              if (window.confirm("Remove every transaction from this browser?")) onClear();
            }}
            className="rounded-full border border-line px-3 py-2 text-sm text-clay"
          >
            Clear ledger
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-muted">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Payee, bank, note"
            className="mt-1 w-full rounded-xl border border-line bg-paper-2 px-3 py-2 text-sm text-ink"
          />
        </label>
        <FilterSelect label="Category" value={categoryId} onChange={onCategory}>
          <option value="all">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Direction" value={direction} onChange={(value) => setDirection(value as "all" | Direction)}>
          <option value="all">Debits and credits</option>
          <option value="debit">Debits</option>
          <option value="credit">Credits</option>
        </FilterSelect>
        <FilterSelect label="Bank" value={bank} onChange={setBank}>
          <option value="all">All banks</option>
          {banks.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </FilterSelect>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line px-5 py-10 text-sm text-muted">
          No lines match these filters.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-line bg-paper-2">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.id === selected ? null : item.id)}
              className={`block w-full text-left ${item.id === selected ? "bg-gold-soft" : ""}`}
            >
              <Receipt transaction={item} />
            </button>
          ))}
        </div>
      )}

      {current && (
        <Editor
          transaction={current}
          onUpdate={(patch) => onUpdate(current.id, patch)}
          onDelete={() => {
            onDelete(current.id);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function Editor({
  transaction,
  onUpdate,
  onDelete,
}: {
  transaction: Transaction;
  onUpdate: (patch: Partial<Transaction>) => void;
  onDelete: () => void;
}) {
  return (
    <section className="rounded-3xl border border-line bg-paper-2 p-4">
      <h3 className="font-serif text-2xl">Correct this line</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Payee" id="edit-merchant">
          <input
            id="edit-merchant"
            value={transaction.merchant}
            onChange={(event) => onUpdate({ merchant: event.target.value })}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Category" id="edit-category">
          <select
            id="edit-category"
            value={transaction.categoryId}
            onChange={(event) => onUpdate({ categoryId: event.target.value })}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          >
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount" id="edit-amount">
          <input
            id="edit-amount"
            inputMode="decimal"
            value={String(transaction.amount)}
            onChange={(event) => {
              const amount = Number(event.target.value);
              if (Number.isFinite(amount) && amount > 0) onUpdate({ amount });
            }}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Bank" id="edit-bank">
          <input
            id="edit-bank"
            value={transaction.bank}
            onChange={(event) => onUpdate({ bank: event.target.value })}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Note" id="edit-note">
          <input
            id="edit-note"
            value={transaction.note}
            onChange={(event) => onUpdate({ note: event.target.value })}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </Field>
      </div>
      {transaction.rawSms && (
        <p className="mt-3 text-xs leading-5 text-muted">{transaction.rawSms}</p>
      )}
      <button type="button" onClick={onDelete} className="mt-3 text-sm text-clay">
        Delete line
      </button>
    </section>
  );
}

function Rules({
  rules,
  onAdd,
  onDelete,
}: {
  rules: CategoryRule[];
  onAdd: (keyword: string, categoryId: string) => void;
  onDelete: (id: string) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState("food");
  const [message, setMessage] = useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-3xl border border-line bg-paper-2 p-5">
        <h2 className="font-serif text-3xl tracking-tight">Your rules</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          A rule wins over the built-in list. “Landlord” can mean Bills even if the SMS never says rent.
        </p>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (keyword.trim().length < 2) {
              setMessage("Use at least two letters.");
              return;
            }
            setMessage("");
            onAdd(keyword, categoryId);
            setKeyword("");
          }}
        >
          <Field label="When the payee or SMS contains" id="rule-keyword">
            <input
              id="rule-keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="landlord"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
            />
          </Field>
          <Field label="File it under" id="rule-category">
            <select
              id="rule-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
            >
              {CATEGORIES.filter((category) => category.id !== "other").map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </Field>
          {message && <p className="text-sm text-clay">{message}</p>}
          <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper-2">
            Save rule
          </button>
        </form>
        <ul className="mt-5 divide-y divide-dashed divide-line">
          {rules.length === 0 && <li className="py-3 text-sm text-muted">No custom rules yet.</li>}
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>
                <span className="font-medium">{rule.keyword}</span>
                <span className="text-muted"> → {categoryById(rule.categoryId).label}</span>
              </span>
              <button type="button" className="text-clay" onClick={() => onDelete(rule.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-line bg-paper-2 p-5">
        <h2 className="font-serif text-2xl">Built-in keywords</h2>
        <p className="mt-2 text-sm text-muted">These apply when you have not written your own rule.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {CATEGORIES.filter((category) => category.keywords.length > 0).map((category) => (
            <div key={category.id}>
              <p className="text-sm font-medium" style={{ color: SWATCH[category.id] }}>
                {category.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">{category.keywords.join(", ")}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "clay" | "green" }) {
  return (
    <article className={`rounded-2xl px-2 py-3 sm:rounded-3xl sm:px-4 sm:py-4 ${tone === "clay" ? "bg-clay-soft" : "bg-green-soft"}`}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted sm:text-xs">{label}</p>
      <p className={`mt-1 font-serif text-xl tracking-tight sm:mt-2 sm:text-3xl ${tone === "clay" ? "text-clay" : "text-green"}`}>
        {value}
      </p>
    </article>
  );
}

function Receipt({ transaction }: { transaction: Transaction }) {
  return (
    <div className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-3 border-b border-dashed border-line px-4 py-3 last:border-b-0">
      <span
        className="h-8 w-1.5 rounded-full"
        style={{ background: SWATCH[transaction.categoryId] ?? SWATCH.other }}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="block truncate font-medium">{transaction.merchant}</span>
        <span className="block truncate text-xs text-muted">
          {formatDate(transaction.occurredAt)} · {transaction.bank} · {categoryById(transaction.categoryId).label}
        </span>
      </span>
      <span className={`font-serif text-lg ${transaction.direction === "debit" ? "text-clay" : "text-green"}`}>
        {transaction.direction === "debit" ? "−" : "+"}
        {formatMoney(transaction.amount, transaction.currency)}
      </span>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="text-xs font-medium text-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-line bg-paper-2 px-3 py-2 text-sm text-ink"
      >
        {children}
      </select>
    </label>
  );
}

function rollup(transactions: Transaction[], keyOf: (item: Transaction) => string) {
  const totals = new Map<string, number>();
  for (const item of transactions) {
    const key = keyOf(item);
    totals.set(key, (totals.get(key) ?? 0) + item.amount);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function downloadCsv(transactions: Transaction[]) {
  const header = ["date", "direction", "amount", "currency", "bank", "account", "payee", "category", "note"];
  const lines = transactions.map((item) =>
    [
      item.occurredAt ?? "",
      item.direction,
      item.amount.toFixed(2),
      item.currency,
      item.bank,
      item.accountMask,
      item.merchant,
      categoryById(item.categoryId).label,
      item.note,
    ]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "khaata-ledger.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
