import type { ReactNode } from "react";
import Link from "next/link";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto min-h-full max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/" className="font-serif text-3xl tracking-tight">
        Khaata
      </Link>
      <h1 className="mt-8 font-serif text-4xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Effective 4 October 2026</p>
      <div className="mt-8 space-y-8 text-sm leading-7 text-ink">{children}</div>
      <p className="mt-12 text-sm text-muted">
        <Link href="/privacy" className="underline">
          Privacy policy
        </Link>
        {" · "}
        <Link href="/terms" className="underline">
          Terms of service
        </Link>
        {" · "}
        <Link href="/" className="underline">
          Back to the ledger
        </Link>
      </p>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-muted">{children}</div>
    </section>
  );
}
