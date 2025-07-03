// src/utils/Card.ts
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "J" | "Q" | "K" | "10" | "A";

export class Card {
  constructor(readonly rank: Rank, readonly suit: Suit) {}

  /* tables de conversion pour le sprite 2.0 */
  private static RANK_ID: Record<Rank, string> = {
    A: "1",
    "10": "10",
    K: "king",
    Q: "queen",
    J: "jack",
    "9": "9",
    "8": "8",
    "7": "7",
  };

  private static SUIT_ID: Record<Suit, string> = {
    "♣": "club",
    "♦": "diamond",
    "♥": "heart",
    "♠": "spade",
  };

  static fromString(code: string) {
    const suit = code.slice(-1) as Suit;
    const rank = code.startsWith("10") ? "10" : (code[0] as Rank);
    return new Card(rank, suit);
  }

  /** id complet du sprite : « king_spade », « 10_club », … */
  spriteId() {
    return `${Card.RANK_ID[this.rank]}_${Card.SUIT_ID[this.suit]}`;
  }

  /** helper statique pour un code court ("K♠", "10♦", "back") */
  static spriteIdFromCode(code: string) {
    if (code === "back") return "back";
    return Card.fromString(code).spriteId();
  }
}
