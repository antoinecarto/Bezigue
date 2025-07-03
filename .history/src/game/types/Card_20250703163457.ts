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
   * _Par défaut on retourne toujours la première image (`AC_1.svg`) :_
   * si tu veux différencier les deux paquets, passe 2 quand tu dupliques.
   */
  fileName(copy: 1 | 2 = 1): string {
    const suit = Card.SUIT_LETTER[this.suit]; // ex. C
    return `${this.rank}${suit}_${copy}.svg`; // ex. "AC_1.svg"
  }

  /**
   * Construit le nom de fichier d’une carte à partir de son “code” ("K♠", "10♦", etc.)
   * et du numéro de copie (1 ou 2).
   *
   * Exemples :
   *   fileNameFromCode("7♣")      => "7C_1.svg"
   *   fileNameFromCode("A♠", 2)   => "AS_2.svg"
   *   fileNameFromCode("back")    => "back.svg"   (cas spécial déjà traité ailleurs)
   */
  static fileNameFromCode(code: string, copy: 1 | 2 = 1): string {
    // Sécurité : si on reçoit déjà "back" on délègue l’affichage dos de carte
    if (code === "back") return "back.svg";

    // Sépare rang (tout sauf le dernier caractère) et enseigne (dernier caractère)
    const rank = code.slice(0, -1).toUpperCase(); // ex. "7", "10", "A", "J"
    const suitChar = code.slice(-1); // ex. "♣"

    // Correspondance enseigne → lettre dans le nom de fichier
    const suitMap: Record<string, string> = {
      "♣": "C", // Clubs
      "♦": "D", // Diamonds
      "♥": "H", // Hearts
      "♠": "S", // Spades
    };

    const suit = suitMap[suitChar];
    if (!suit) {
      console.warn(`[fileNameFromCode] enseigne inconnue : "${suitChar}"`);
      return "unknown.svg";
    }

    return `${rank}${suit}_${copy}.svg`; // ex. "7C_1.svg"
  }

  /** Code court – ex : "A♠" ou "10♦"  */
  toString(): string {
    return `${this.rank}${this.suit}`;
  }

  /** Créé une Card depuis un code court  */
  static fromCode(code: string): Card {
    const suit = code.slice(-1) as Suit;
    const rank = code.startsWith("10") ? "10" : (code[0] as Rank);
    return new Card(rank, suit);
  }
}
