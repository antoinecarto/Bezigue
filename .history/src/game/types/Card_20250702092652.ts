/* ---------------------------------------------------
   Types de base
--------------------------------------------------- */
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "J" | "Q" | "K" | "10" | "A";

/* ---------------------------------------------------
   Classe Card
--------------------------------------------------- */
export class Card {
  constructor(readonly rank: Rank, readonly suit: Suit) {}

  /* --- helpers statiques ------------------------- */
  static fromString(s: string) {
    const suit = s.slice(-1) as Suit;
    const rank = s.slice(0, -1) as Rank;
    return new Card(rank, suit);
  }
  static equals(a: Card, b: Card) {
    return a.rank === b.rank && a.suit === b.suit;
  }

  /* --- instance ---------------------------------- */
  toString() {
    return `${this.rank}${this.suit}`;
  }
  value() {
    // utile pour resolveTrick
    return { "7": 1, "8": 2, "9": 3, J: 4, Q: 5, K: 6, "10": 7, A: 8 }[
      this.rank
    ];
  }
  isTrump(trump: Suit) {
    return this.suit === trump;
  }
}
