// src/utils/Card.ts
/* ------------------------------------------------------------------ */
/*  Types de base                                                     */
/* ------------------------------------------------------------------ */
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "J" | "Q" | "K" | "10" | "A";

/* ------------------------------------------------------------------ */
/*  Fonction utilitaire exportée                                       */
/* ------------------------------------------------------------------ */
export function fileNameFromCode(code: string, copy: 1 | 2 = 1): string {
  console.log(`[fileNameFromCode] code reçu: "${code}"`);

  if (code.trim().toLowerCase() === "back") {
    console.log("[fileNameFromCode] code = back détecté");
    return "back.svg";
  }

  const rank = code.slice(0, -1).toUpperCase();
  const suitChar = code.slice(-1);
  const suitMap: Record<string, string> = {
    "♠": "S",
    "♥": "H",
    "♦": "D",
    "♣": "C",
  };
  const suit = suitMap[suitChar];

  if (!suit) {
    console.warn(
      `[fileNameFromCode] enseigne inconnue : "${suitChar}" (code complet: "${code}")`
    );
    return "unknown.svg";
  }
  return `${rank}${suit}_${copy}.svg`;
}
/* ------------------------------------------------------------------ */
/*  Classe Card (rang + couleur)                                       */
/* ------------------------------------------------------------------ */
export class Card {
  readonly rank: Rank;
  readonly suit: Suit;

  constructor(rank: Rank, suit: Suit) {
    this.rank = rank;
    this.suit = suit;
  }

  /* Conversion rapide “♣ ♦ ♥ ♠” → “C D H S” (utile ailleurs) */
  private static SUIT_LETTER: Record<Suit, string> = {
    "♣": "C",
    "♦": "D",
    "♥": "H",
    "♠": "S",
  };

  /** Code court – ex : "A♠" ou "10♦"  */
  toString(): string {
    return `${this.rank}${this.suit}`;
  }

  /** Nom de fichier pour cette instance */
  fileName(copy: 1 | 2 = 1): string {
    return fileNameFromCode(this.toString(), copy);
  }

  /** Créée une Card depuis un code court  */
  static fromCode(code: string): Card {
    const suit = code.slice(-1) as Suit;
    const rank = code.startsWith("10") ? "10" : (code[0] as Rank);
    return new Card(rank, suit);
  }
}
