import { ConvexError } from "convex/values";

export function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatCredits(credits: number) {
  return `${credits.toLocaleString("en-US")} credit${credits === 1 ? "" : "s"}`;
}

export function rateLabel(centsPerCredit: number) {
  return `${formatCredits(Math.round(100 / centsPerCredit))} = $1.00`;
}

export function errorMessage(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "Something went wrong. Check your connection and try again.";
}

export const colors = {
  bg: "#0B0B14",
  surface: "#15151F",
  raised: "#1B1A2B",
  border: "#23233A",
  text: "#F5F3FB",
  secondary: "#BDB9D0",
  muted: "#8F8BA6",
  accent: "#D9CCFF",
  up: "#79E2D6",
  down: "#FF9A85",
  violet: "#B9A6FF",
  ctaText: "#141120",
  warning: "#F6C445",
};
