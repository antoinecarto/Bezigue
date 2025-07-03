// utils/compareCardsFr.ts
import { RANK_ORDER_FR } from "./rankOrder";

/** "Valet de Carreau" < "Dame de Cœur" … */
export function compareCardsFr(a: string, b: string): number {
  const rgx = /(7|8|9|Valet|Dame|Roi|10|As) de (Pique|Cœur|Carreau|Trèfle)/i;

  const [, rankA, suitA] = a.match(rgx)!;
  const [, rankB, suitB] = b.match(rgx)!;

  const rankDiff =
    RANK_ORDER_FR.indexOf(rankA as any) - RANK_ORDER_FR.indexOf(rankB as any);
  if (rankDiff !== 0) return rankDiff;

  // ordre couleur (optionnel) : ♠ < ♥ < ♦ < ♣
  const SUIT_ORDER = ["Pique", "Cœur", "Carreau", "Trèfle"];
  return SUIT_ORDER.indexOf(suitA) - SUIT_ORDER.indexOf(suitB);
}
