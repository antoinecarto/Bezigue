// src/utils/Card.ts
import type { Combination } from "../../core/rules/detectCombinations";

/* ------------------------------------------------------------------ */
/*  Types de base                                                     */
/* ------------------------------------------------------------------ */
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "J" | "Q" | "K" | "10" | "A";
export type Copy = 1 | 2;

/* ------------------------------------------------------------------ */
/*  Fonction utilitaire exportée                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Conversion code carte <-> nom de fichier                          */
/* ------------------------------------------------------------------ */

/**
 * @param code  Ex.: "A♠" ou "10♦"
 * @param copy  1 ou 2 → suffixe du fichier ("_1", "_2")
 * @returns     "AS_1.svg", "10H_2.svg", etc.
 */
export function fileNameFromCode(code?: string, copy?: Copy): string {
  if (!code) return "unknown.svg"; // gestion sécurisée
  if (code.trim().toLowerCase() === "back") return "back.svg";

  const [baseCode, copyStr] = code.split("_");
  const rank = baseCode.slice(0, -1).toUpperCase();
  const suitChar = baseCode.slice(-1);

  const suitMap: Record<string, string> = {
    "♠": "S",
    S: "S",
    "♥": "H",
    H: "H",
    "♦": "D",
    D: "D",
    "♣": "C",
    C: "C",
  };

  const suit = suitMap[suitChar];
  if (!suit) return "unknown.svg";

  const copyNum = copy ?? (copyStr ? Number(copyStr) : 1);
  return `${rank}${suit}_${copyNum}.svg`;
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
export const cardToStr = (c: Card | string | undefined | null): string => {
  if (!c) return "";
  return typeof c === "string" ? c : c.toString(); // conserve _1 / _2
};
/* ------------------------------------------------------------------ */
/*  Classe Card (rang + couleur)                                       */
/* ------------------------------------------------------------------ */
export class Card {
  readonly rank: Rank;
  readonly suit: Suit;
  readonly copy: Copy;

  constructor(rank: Rank, suit: Suit, copy: Copy) {
    if (copy !== 1 && copy !== 2) {
      console.warn("Card created with invalid copy:", copy);
      copy = 1; // fallback
    }
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

  fileName(): string {
    const suitLetter = {
      "♣": "C",
      "♦": "D",
      "♥": "H",
      "♠": "S",
    }[this.suit];

    const copyNum = this.copy ?? 1; // ou whatever copy number you track, default 1

    return `${this.rank}${suitLetter}_${copyNum}.svg`;
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
  /** Crée une Card depuis un code court.
   *  Exemples acceptés : "A♠", "10♦", "QH_2", "7C", "K♣_1" */
  /** Parse "A♠", "A♠_2", "10♦_1" → Card */
  static fromCode(code: string): Card {
    const cleaned = code.trim();
    const match = cleaned.match(/^((?:10|[2-9JQKA]))([CDHS♠♥♦♣])(?:_(1|2))?$/);
    if (!match) throw new Error(`Code carte invalide : “${code}”`);
    const [, rankStr, suitChar, copyStr] = match;

    // Conversion éventuelle des lettres S/H/D/C vers symboles (si besoin)
    const suitSymbolMap: Record<string, Suit> = {
      S: "♠",
      H: "♥",
      D: "♦",
      C: "♣",
      "♠": "♠",
      "♥": "♥",
      "♦": "♦",
      "♣": "♣",
    };

    const rank = rankStr as Rank;
    const suit = suitSymbolMap[suitChar];
    const copy = (copyStr ? Number(copyStr) : 1) as Copy;

    return new Card(rank, suit, copy);
  }
}
