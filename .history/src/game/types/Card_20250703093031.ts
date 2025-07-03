// src/utils/Card.ts ---------------------------------------------------
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "J" | "Q" | "K" | "10" | "A";

/** Conserve seulement le rang & la couleur (pas d’index 1 / 2 ici) */
export class Card {
  readonly rank: Rank;
  readonly suit: Suit;
  constructor(rank: Rank, suit: Suit) {
    this.rank = rank;
    this.suit = suit;
  }

  /* Conversion “♣ ♦ ♥ ♠” → “C D H S” */
  private static SUIT_LETTER: Record<Suit, string> = {
    "♣": "C",
    "♦": "D",
    "♥": "H",
    "♠": "S",
  };

  /** code court : "K♠", "10♦", "J♥", …  */
  static fromString(code: string): Card {
    const suit = code.slice(-1) as Suit;
    const rank = code.startsWith("10") ? "10" : (code[0] as Rank);
    return new Card(rank, suit);
  }

  /**
   * @param copy 1 ou 2 ?
   * _Par défaut on retourne toujours la première image (`AC_1.png`) :_
   * si tu veux différencier les deux paquets, passe 2 quand tu dupliques.
   */
  fileName(copy: 1 | 2 = 1): string {
    const suit = Card.SUIT_LETTER[this.suit]; // ex. C
    return `${this.rank}${suit}_${copy}.png`; // ex. "AC_1.png"
  }

  /** Helper direct depuis un code court : */
  static fileNameFromCode(code: string, copy: 1 | 2 = 1) {
    return Card.fromString(code).fileName(copy);
  }
}
