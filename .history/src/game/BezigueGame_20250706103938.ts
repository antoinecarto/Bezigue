export interface Combination {
  name: string;
  cards: Card[];
  points: number;
}

export function distributeCards(deck: Card[]) {
  const player1Hand = deck.slice(0, 9);
  const player2Hand = deck.slice(9, 18);

  const trumpCard = deck[18]; // 19ème carte, visible séparément

  // Pioche = toutes les cartes après la 19ème carte
  // sauf la trumpCard, qu'on ajoute à la fin de la pioche
  const drawPile = deck.slice(19);
  drawPile.push(trumpCard);

  return {
    hands: {
      player1: player1Hand,
      player2: player2Hand,
    },
    trumpCard,
    drawPile,
  };
}

import { Card } from "@/game/model/Card";
import type { Suit, Rank } from "@/game/model/Card";

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
