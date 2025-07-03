import { Card } from "@/game/types/Card";

/* convertit toutes les strings d’un doc en instances Card */
export function hydrateHand(strs: string[]) {
  return strs.map(Card.fromString);
}
/* inverse : avant write() */
export function serializeHand(cards: Card[]) {
  return cards.map((c) => c.toString());
}
