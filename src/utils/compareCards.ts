// utils/compareCards.ts
const RANK_ORDER = ["7", "8", "9", "J", "Q", "K", "10", "A"] as const;
const SUIT_ORDER = ["S", "H", "D", "C"]; // ♠ ♥ ♦ ♣

export function compareCards(a: string, b: string): number {
  const rankA = a.startsWith("10") ? "10" : a[0];
  const rankB = b.startsWith("10") ? "10" : b[0];

  const rankDiff =
    RANK_ORDER.indexOf(rankA as any) - RANK_ORDER.indexOf(rankB as any);
  if (rankDiff !== 0) return rankDiff;

  const suitA = a.slice(-1);
  const suitB = b.slice(-1);
  return SUIT_ORDER.indexOf(suitA) - SUIT_ORDER.indexOf(suitB);
}
