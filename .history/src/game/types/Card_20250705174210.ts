// src/utils/Card.ts
import type { Combination } from "./detectCombinations";

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

/** transforme ["A♠", ...] */
export const cardsToStrings = (arr: Card[]) => arr.map((c) => c.toString());

/** ⇢ Combination prêt pour Firestore */
export const serializeCombination = (c: Combination) => ({
  name: c.name,
  points: c.points,
  cards: cardsToStrings(c.cards),
});

/** transforme [{ name, points, cards:[Card] }] ➜ tableau 100 % “string-safe” */
// Card.ts (ou utils)
export function serializeMelds(melds: Combination[] = []) {
  return melds.map((m) => ({
    ...m,
    cards: m.cards.map(cardToStr), // Card[] → string[]
  }));
}

/* ────────────── Helpers ─────────────────────────────── */
const cardToStr = (c: Card | string | undefined | null) => {
  if (!c) return ""; // retourne chaîne vide si c est null/undefined
  return typeof c === "string" ? c : `${c.rank}${c.suit}`;
};

/* ------------------------------------------------------------------ */
/*  Classe Card (rang, couleur, exemplaire)                           */
/* ------------------------------------------------------------------ */
export class Card {
  readonly rank: Rank;
  readonly suit: Suit;
  readonly copy: 1 | 2; // ← différence #1 / #2

  constructor(rank: Rank, suit: Suit, copy: 1 | 2 = 1) {
    this.rank = rank;
    this.suit = suit;
    this.copy = copy;
  }

  /* ---------------- Clés & conversions -------------------------- */

  /** Clé vraiment unique : « A♠#2 » */
  id(): string {
    return `${this.rank}${this.suit}#${this.copy}`;
  }

  /** Code court – ex : "A♠" ou "10♦" (sans info de copie) */
  toString(): string {
    return `${this.rank}${this.suit}`;
  }

  /** Nom du fichier – ex. "AS_1.svg" ou "JD_2.svg" */
  fileName(): string {
    const rankPart = this.rank === "10" ? "10" : this.rank;
    const suitLetter = Card.SUIT_LETTER[this.suit];
    return `${rankPart}${suitLetter}_${this.copy}.svg`;
  }

  /* ---------------- Helpers statiques --------------------------- */

  private static SUIT_LETTER: Record<Suit, string> = {
    "♣": "C",
    "♦": "D",
    "♥": "H",
    "♠": "S",
  };

  /** Fabrique une carte depuis une clé unique « A♠#2 » */
  static fromId(id: string): Card {
    const [rankPlusSuit, copyStr] = id.split("#");
    const suit = rankPlusSuit.slice(-1) as Suit;
    const rank = rankPlusSuit.startsWith("10")
      ? "10"
      : (rankPlusSuit[0] as Rank);
    const copy = copyStr === "2" ? 2 : 1;
    return new Card(rank, suit, copy);
  }

  /** Fabrique une carte depuis le code court + copie souhaitée       */
  static fromCode(code: string, copy: 1 | 2 = 1): Card {
    const suit = code.slice(-1) as Suit;
    const rank = code.startsWith("10") ? "10" : (code[0] as Rank);
    return new Card(rank, suit, copy);
  }
}
