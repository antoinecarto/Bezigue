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

/* ------------------------------------------------------------------ */
/*  Conversion code carte <-> nom de fichier                          */
/* ------------------------------------------------------------------ */

/**
 * @param code  Ex.: "A♠" ou "10♦"
 * @param copy  1 ou 2 → suffixe du fichier ("_1", "_2")
 * @returns     "AS_1.svg", "10H_2.svg", etc.
 */
export function fileNameFromCode(code: string, copy: Copy = 1): string {
  if (code.trim().toLowerCase() === "back") return "back.svg";

  const rank = code.slice(0, -1).toUpperCase(); // "A" ou "10"
  const suitChar = code.slice(-1);
  const suitMap: Record<string, string> = {
    "♠": "S",
    "♥": "H",
    "♦": "D",
    "♣": "C",
  };
  const suit = suitMap[suitChar];
  if (!suit) return "unknown.svg";

  return `${rank}${suit}_${copy}.svg`; // ex.: "AS_1.svg"
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
  /** Crée une Card depuis un code court.
   *  Exemples acceptés : "A♠", "10♦", "QH_2", "7C", "K♣_1" */
  static fromCode(code: string): Card {
    const cleaned = code.trim();

    /* ------------------------------------------------------------------
     ^                        début
     (10|[7-9JQKA])           rang : "10" OU un seul car. 7‑9‑J‑Q‑K‑A
     ([♠♥♦♣SHDC])             enseigne unicode OU ascii
     (?:_(1|2))?              suffixe optionnel "_1" ou "_2"
     $                        fin
  ------------------------------------------------------------------ */
    const m = cleaned.match(/^((?:10)|[7-9JQKA])([♠♥♦♣SHDC])(?:_(1|2))?$/i);
    if (!m) {
      throw new Error(`Code carte invalide : « ${code} »`);
    }

    const [, rankRaw, suitRaw, copyRaw] = m;
    const rank = rankRaw.toUpperCase() as Rank;

    /* Conversion ASCII -> symboles si besoin */
    const suitMap: Record<string, Suit> = {
      S: "♠",
      H: "♥",
      D: "♦",
      C: "♣",
      "♠": "♠",
      "♥": "♥",
      "♦": "♦",
      "♣": "♣",
    };
    const suit = suitMap[suitRaw.toUpperCase()];
    if (!suit) {
      throw new Error(`Enseigne inconnue : « ${suitRaw} »`);
    }

    /* Par défaut copy = 1 si non précisé */
    const copy = (copyRaw ? Number(copyRaw) : 1) as 1 | 2;

    return new Card(rank, suit, copy); // Card(rank,suit,copy) ⇐ nécessite le champ copy
  }
}
