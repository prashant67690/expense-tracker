"use client";

import { useCallback, useEffect, useState } from "react";
import type { GmailAlert, GmailStatus } from "@/lib/gmail-types";

const EMPTY: GmailStatus = { configured: false, connected: false, email: null };

export function MailPanel({
  notice,
  onAlerts,
}: {
  notice: string;
  onAlerts: (alerts: GmailAlert[]) => number;
}) {
  const [status, setStatus] = useState<GmailStatus>(EMPTY);
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const message = statusMessage || notice;

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/gmail/status");
    if (!response.ok) return;
    setStatus((await response.json()) as GmailStatus);
  }, []);

  const checkMail = useCallback(async () => {
    setChecking(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/gmail/sync", { method: "POST" });
      const body = (await response.json()) as { messages?: GmailAlert[]; error?: string };
      if (!response.ok) {
        setStatusMessage(body.error || "Could not read bank mail.");
        if (response.status === 401) setStatus((current) => ({ ...current, connected: false, email: null }));
        return;
      }
      const messages = body.messages ?? [];
      const shown = onAlerts(messages);
      if (shown === 0) {
        setStatusMessage(
          messages.length === 0
            ? "No bank payment emails in the last 30 days."
            : "Nothing new. Those payments are already in the ledger.",
        );
        return;
      }
      setStatusMessage(
        `Found ${shown} new bank ${shown === 1 ? "email" : "emails"}. Review them before filing.`,
      );
    } catch {
      setStatusMessage("Could not reach the app server.");
    } finally {
      setChecking(false);
    }
  }, [onAlerts]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/gmail/status");
      if (!response.ok || cancelled) return;
      setStatus((await response.json()) as GmailStatus);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-3xl border border-line bg-paper-2 p-5 lg:flex lg:items-start lg:justify-between lg:gap-8">
      <div className="max-w-2xl">
      <h2 className="font-serif text-3xl tracking-tight">Bank mail</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Connect Gmail with read-only access. Khaata looks for payment alerts from banks and waits for you
        to file each one. Password emails are left out.
      </p>
      </div>
      <div className="lg:max-w-md lg:shrink-0 lg:text-right">
      {!status.configured && (
        <p className="mt-3 text-sm leading-6 text-gold">
          Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local, then restart the app. In Google
          Cloud, the redirect URI must be this site plus /api/gmail/callback.
        </p>
      )}
      {status.configured && !status.connected && (
        <a
          href="/api/gmail/connect"
          className="mt-4 inline-block rounded-full bg-green px-4 py-2 text-sm font-medium text-white"
        >
          Connect Gmail
        </a>
      )}
      {status.connected && (
        <div className="mt-4 flex flex-wrap items-center gap-2 lg:justify-end">
          <p className="text-sm text-muted">{status.email || "Gmail connected"}</p>
          <button
            type="button"
            disabled={checking}
            onClick={() => void checkMail()}
            className="rounded-full bg-green px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {checking ? "Checking mail…" : "Check bank mail"}
          </button>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/gmail/disconnect", { method: "POST" });
              setStatusMessage("Gmail disconnected.");
              await refreshStatus();
            }}
            className="rounded-full border border-line px-4 py-2 text-sm"
          >
            Disconnect
          </button>
        </div>
      )}
      {message && <p className="mt-3 text-sm leading-6 text-muted">{message}</p>}
      </div>
    </section>
  );
}
