export type Suit = "♦" | "♣" | "♠" | "♥";

export interface CardData {
  rank: string;
  suit: Suit;
}



export interface Combination {
  name: string;
  cards: Card[];
  points: number;
}