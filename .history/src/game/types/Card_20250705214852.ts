// src/utils/Card.ts
import type { Combination } from "./detectCombinations";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "J" | "Q" | "K" | "10" | "A";
export type Copy = 1 | 2; // ← NEW

/* ------------------------------------------------------------------ */
/*  Classe Card (rang + couleur + copie)                              */
/* ------------------------------------------------------------------ */
export class Card {
  readonly rank: Rank;
  readonly suit: Suit;
  readonly copy: Copy; // ← NEW

  constructor(rank: Rank, suit: Suit, copy: Copy = 1) {
    this.rank = rank;
    this.suit = suit;
    this.copy = copy;
  }

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
}
