/*────────── Types de base ──────────*/
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export interface Card {
  rank: Rank;
  suit: Suit;
}
export interface Combination {
  name: string;
  points: number;
  cards: Card[];
}

/*────────── Utils ──────────*/
export const cardToStr = (c: Card) => `${c.rank}${c.suit}`;
export const strToCard = (s: string): Card => ({
  rank: s.slice(0, -1) as Rank,
  suit: s.slice(-1) as Suit,
});
