export type Suit = "♦" | "♣" | "♠" | "♥";

export interface CardData {
  rank: string;
  suit: Suit;
}

import type { Card } from '@/components/Card.vue'


export interface Combination {
  name: string;
  cards: Card[];
  points: number;
}