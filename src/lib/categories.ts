import type { CategoryRule, Direction } from "./types";

export type Category = {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
};

export const CATEGORIES: Category[] = [
  {
    id: "food",
    label: "Food",
    hint: "Delivery, cafes, restaurants",
    keywords: ["swiggy", "zomato", "starbucks", "mcdonald", "restaurant", "cafe", "domino"],
  },
  {
    id: "groceries",
    label: "Groceries",
    hint: "Supermarkets and quick commerce",
    keywords: ["blinkit", "bigbasket", "zepto", "instamart", "dmart", "grocery", "walmart", "whole foods"],
  },
  {
    id: "transport",
    label: "Transport",
    hint: "Rides, fuel, rail",
    keywords: ["uber", "ola", "rapido", "lyft", "irctc", "metro", "petrol", "shell", "fuel"],
  },
  {
    id: "shopping",
    label: "Shopping",
    hint: "Stores and marketplaces",
    keywords: ["amazon", "flipkart", "myntra", "ajio", "nykaa", "ikea"],
  },
  {
    id: "bills",
    label: "Bills",
    hint: "Utilities, mobile, rent",
    keywords: ["airtel", "jio", "vodafone", "electric", "bescom", "bill", "insurance", "rent"],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    hint: "Streaming, tickets, games",
    keywords: ["netflix", "spotify", "hotstar", "prime video", "bookmyshow", "pvr", "youtube"],
  },
  {
    id: "health",
    label: "Health",
    hint: "Pharmacy and clinics",
    keywords: ["pharmacy", "apollo", "pharmeasy", "1mg", "hospital", "clinic"],
  },
  {
    id: "transfers",
    label: "Transfers",
    hint: "Person-to-person and bank moves",
    keywords: ["imps", "neft", "rtgs", "self transfer", "trf to"],
  },
  {
    id: "income",
    label: "Income",
    hint: "Salary, interest, refunds you want filed as income",
    keywords: ["salary", "payroll", "interest"],
  },
  {
    id: "other",
    label: "Other",
    hint: "Anything the rules do not recognize yet",
    keywords: [],
  },
];

export function categoryById(id: string): Category {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

function matchKeyword(haystack: string, keywords: { keyword: string; categoryId: string }[]) {
  const source = haystack.toLowerCase();
  let winner: { keyword: string; categoryId: string } | null = null;
  for (const rule of keywords) {
    const keyword = rule.keyword.trim().toLowerCase();
    if (keyword.length < 2) continue;
    if (!source.includes(keyword)) continue;
    if (!winner || keyword.length > winner.keyword.length) winner = { ...rule, keyword };
  }
  return winner?.categoryId ?? null;
}

export function categorize(
  merchant: string,
  rawText: string,
  direction: Direction,
  rules: CategoryRule[],
): string {
  const custom = rules.map((rule) => ({
    keyword: rule.keyword,
    categoryId: rule.categoryId,
  }));
  const customHit = matchKeyword(`${merchant} ${rawText}`, custom);
  if (customHit) return customHit;

  const builtin = CATEGORIES.flatMap((category) =>
    category.keywords.map((keyword) => ({ keyword, categoryId: category.id })),
  );
  const merchantHit = matchKeyword(merchant, builtin);
  if (merchantHit) return merchantHit;

  const textHit = matchKeyword(rawText, builtin.filter((rule) => rule.categoryId !== "transfers"));
  if (textHit) return textHit;

  if (direction === "credit") return "income";
  const transferHit = matchKeyword(rawText, builtin.filter((rule) => rule.categoryId === "transfers"));
  return transferHit ?? "other";
}
