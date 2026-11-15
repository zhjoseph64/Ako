export const colors = {
  bg: "#0B0B14",
  surface: "#15151F",
  raised: "#1B1A2B",
  border: "#23233A",
  divider: "#1E1E2E",
  chip: "#17162A",
  chipBorder: "#2A2840",
  text: "#F5F3FB",
  secondary: "#BDB9D0",
  tertiary: "#A7A3BC",
  muted: "#8F8BA6",
  accent: "#D9CCFF",
  up: "#79E2D6",
  down: "#FF9A85",
  rating: "#B9A6FF",
  periwinkle: "#8E9BF0",
  ctaText: "#141120",
};

export const ctaGradient = ["#F0A9DC", "#B9A6FF", "#9FD9E6"] as const;

export const radii = { card: 22, tile: 18, pill: 999 };

export const space = { page: 20, touch: 44 };

export const fonts = {
  heading: "SpaceGrotesk_700Bold",
  headingMedium: "SpaceGrotesk_600SemiBold",
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

export function formatPoints(points: number) {
  return points.toLocaleString("en-US");
}

export function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
