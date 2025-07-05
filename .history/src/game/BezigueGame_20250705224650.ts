export interface Combination {
  name: string;
  cards: Card[];
  points: number;
}

export function distributeCards(deck: Card[]) {
  const player1Hand = deck.slice(0, 9);
  const player2Hand = deck.slice(9, 18);
  const drawPile = deck.slice(18);
  const trumpCard = drawPile[0];

  return {
    hands: {
      player1: player1Hand,
      player2: player2Hand,
    },
    trumpCard,
    drawPile,
  };
}

import { Card } from "@/game/types/Card";
import type { Suit, Rank } from "@/game/types/Card";

export function generateShuffledDeck(): Card[] {
  const suits: Suit[] = ["♠", "♥", "♦", "♣"];
  const ranks: Rank[] = ["7", "8", "9", "J", "Q", "K", "10", "A"];
  const deck: Card[] = [];

  // Créer deux jeux avec copy 1 et 2
  for (let copy = 1 as 1 | 2; copy <= 2; copy++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(new Card(rank, suit, copy));
      }
    }
  }

  // Mélange Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
