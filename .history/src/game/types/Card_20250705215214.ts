// src/utils/Card.ts
import type { Combination } from "./detectCombinations";

/* ------------------------------------------------------------------ */
/*  Types de base                                                     */
/* ------------------------------------------------------------------ */
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "J" | "Q" | "K" | "10" | "A";
export type Copy = 1 | 2;

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
/*  Classe Card (rang + couleur)                                       */
/* ------------------------------------------------------------------ */
export class Card {
  readonly rank: Rank;
  readonly suit: Suit;
  readonly copy: Copy;

  constructor(rank: Rank, suit: Suit, copy: Copy) {
    this.rank = rank;
    this.suit = suit;
    this.copy = copy;
  }

  /* Conversion rapide “♣ ♦ ♥ ♠” → “C D H S” (utile ailleurs) */
  private static SUIT_LETTER: Record<Suit, string> = {
    "♣": "C",
    "♦": "D",
    "♥": "H",
    "♠": "S",
  };
  /* ----------- Représentations ------------------------------------ */
  /** Code court “A♠” sans la copie (utile en UI) */
  shortCode(): string {
    return `${this.rank}${this.suit}`;
  }

  /** Code **unique** pour Firestore : ex. “A♠_1”, “A♠_2” */
  toString(): string {
    return `${this.rank}${this.suit}_${this.copy}`;
  }

  /** Nom de fichier svg : “AS_1.svg”, “10H_2.svg”, … */
  fileName(): string {
    return fileNameFromCode(this.shortCode(), this.copy);
  }

  /* ----------- Parsing inverse ------------------------------------ */
  /** Crée une Card depuis “A♠_2” ou “10♦” (défaut copy = 1) */
  static fromString(str: string): Card {
    const m = str.match(/^(.{1,2})([♠♥♦♣])(?:_(1|2))?$/);
    if (!m) throw new Error(`Code carte invalide : “${str}”`);
    const [, rankPart, suit, copyPart] = m;
    const rank = rankPart as Rank;
    const copy = (copyPart ? Number(copyPart) : 1) as Copy;
    return new Card(rank, suit as Suit, copy);
  }

  /** Créée une Card depuis un code court  */
  static fromCode(code: string): Card {
    const suit = code.slice(-1) as Suit;
    const rank = code.startsWith("10") ? "10" : (code[0] as Rank);
    return new Card(rank, suit);
  }
}
