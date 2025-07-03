/* ---------------------------------------------------
   Types de base
--------------------------------------------------- */
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "J" | "Q" | "K" | "10" | "A";

/* ---------------------------------------------------
   Classe Card
--------------------------------------------------- */
export class Card {
  readonly rank: Rank;
  readonly suit: Suit;

  /* --- tables internes pour l’id du sprite ---------- */
  private static SPRITE_RANK: Record<Rank, string> = {
    "7": "7",
    "8": "8",
    "9": "9",
    J: "jack",
    Q: "queen",
    K: "king",
    "10": "10",
    A: "ace", // NB : l’As s’appelle « ace » dans svg‑cards
  };

  private static SPRITE_SUIT: Record<Suit, string> = {
    "♠": "spade",
    "♥": "heart",
    "♦": "diamond",
    "♣": "club",
  };

  constructor(rank: Rank, suit: Suit) {
    this.rank = rank;
    this.suit = suit;
  }

  /* --- helpers statiques ---------------------------- */
  static fromString(s: string) {
    const suit = s.slice(-1) as Suit;
    const rank = s.slice(0, -1) as Rank;
    return new Card(rank, suit);
  }
  static equals(a: Card, b: Card) {
    return a.rank === b.rank && a.suit === b.suit;
  }

  /* --- instance ------------------------------------- */
  toString() {
    return `${this.rank}${this.suit}`; // "Q♣"
  }

  /** Valeur d’ordre Bézigue : 7 < 8 < … < 10 < As */
  value() {
    return { "7": 1, "8": 2, "9": 3, J: 4, Q: 5, K: 6, "10": 7, A: 8 }[
      this.rank
    ];
  }

  isTrump(trump: Suit) {
    return this.suit === trump;
  }

  /** id du sprite SVG‑cards (ex. "club_queen") */
  spriteId(): string {
    const r = Card.SPRITE_RANK[this.rank];
    const s = Card.SPRITE_SUIT[this.suit];
    return `${s}_${r}`;
  }

  /* --- helper statique pour un code court "Q♣" ------ */
  static spriteIdFromCode(code: string): string {
    if (code === "back") return "back";
    const card = Card.fromString(code);
    return card.spriteId();
  }
}
