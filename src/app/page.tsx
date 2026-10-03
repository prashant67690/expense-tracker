import { KhaataApp } from "@/components/khaata-app";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string | string[]; reason?: string | string[] }>;
}) {
  const params = await searchParams;
  const gmail = one(params.gmail);
  const mailNotice =
    gmail === "connected"
      ? "Gmail is connected. Bank payment mail is checked from the inbox."
      : gmail === "error"
        ? one(params.reason) || "Gmail connection failed."
        : "";

  return <KhaataApp initialView={gmail ? "inbox" : "overview"} mailNotice={mailNotice} />;
}
