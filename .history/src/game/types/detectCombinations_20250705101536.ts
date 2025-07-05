/* detectCombinations.ts
   ------------------------------------------------------------------ */
import type { Card, Rank, Suit } from "./Card";

/* ------------ Types retournés ------------------------------------- */
export interface Combination {
  name: string;
  points: number;
  cards: Card[];
}

/* ------------ Constantes utiles ---------------------------------- */
const allSuits: Suit[] = ["♠", "♥", "♦", "♣"];
const fourBaseScore: Record<Rank, number> = {
  A: 100,
  K: 80,
  Q: 60,
  J: 40,
  "10": 0,
  "9": 0,
  "8": 0,
  "7": 0,
};

/* ------------------------------------------------------------------ */
/*  Gestion de l’utilisation des cartes                               */
/* ------------------------------------------------------------------ */
type UsageFlags = { marriage?: true; sequence?: true };
type UsedMap = Map<string, UsageFlags>;

const cardKey = (c: Card) => `${c.rank}${c.suit}`;

const hasFlag = (used: UsedMap, c: Card, flag: keyof UsageFlags) =>
  used.get(cardKey(c))?.[flag] === true;

const addFlag = (used: UsedMap, cards: Card[], flag: keyof UsageFlags) => {
  for (const c of cards) {
    const k = cardKey(c);
    const entry = used.get(k) ?? {};
    entry[flag] = true;
    used.set(k, entry);
  }
};

/* → Enregistre les combinaisons déjà posées                           */
const seedUsedMap = (used: UsedMap, existing: Combination[]) => {
  for (const comb of existing) {
    const flag = comb.name.startsWith("Mariage") ? "marriage" : "sequence";
    addFlag(used, comb.cards, flag);
  }
};

/* Utilitaires ---------------------------------------------------------------- */

const id = (c: Card) => `${c.rank}${c.suit}`;

const isFree = (used: UsedMap, c: Card) => !used[id(c)];
const mark = (used: UsedMap, cs: Card[]) =>
  cs.forEach((c) => (used[id(c)] = true));

/* ------------------------------------------------------------------ */
/*  Fonction principale                                               */
/* ------------------------------------------------------------------ */
e; /* Fonction principale -------------------------------------------------------- */
export function detectCombinations(
  hand: Card[],
  meld: Card[],
  trump: Suit,
  existing: Combination[] = []
): Combination[] {
  const proposals: Combination[] = [];
  const all = [...hand, ...meld];

  /* ------------------------------------------------------------------ */
  /* 1. Construire une table “used” des cartes déjà engagées dans un    */
  /*    carré OU dans 2×(Dame♠+Valet♦). Elles ne sont plus libres.      */
  /*    Roi/Reine utilisés pour un simple mariage, eux, RESTENT libres. */
  /* ------------------------------------------------------------------ */
  const used: UsedMap = {};

  existing.forEach((combo) => {
    const keepFree = combo.name.startsWith("Mariage");
    if (keepFree) return; // mariage : on n’occupe pas
    mark(used, combo.cards); // carré, suite, 40 / 500 pts : occupent
  });

  /* ------------------------------------------------------------------ */
  /* 2. Carrés --------------------------------------------------------- */
  /* ------------------------------------------------------------------ */
  const fourScores: Record<Rank, number> = {
    A: 100,
    K: 80,
    Q: 60,
    J: 40,
    "10": 0,
    "9": 0,
    "8": 0,
    "7": 0, // rangs inactifs
  };

  (["A", "K", "Q", "J"] as Rank[]).forEach((rank) => {
    const alreadyPosed = existing.some((c) => c.name === `4 ${rank}`);
    const freeCards = all.filter((c) => c.rank === rank && isFree(used, c));
    const totalCards = all.filter((c) => c.rank === rank); // libres + occupées
    const fromHand = hand.filter((c) => c.rank === rank);

    /* a) Premier carré jamais posé */
    if (!alreadyPosed && totalCards.length >= 4) {
      proposals.push({
        name: `4 ${rank}`,
        points: fourScores[rank],
        cards: totalCards.slice(0, 4), // n’importe lesquelles, l’ordre n’a pas d’importance
      });
      return; // on ne calcule pas l’upgrade
    }

    /* b) Autre carré (upgrade) : ≥ 3 cartes neuves venant de la main */
    if (alreadyPosed) {
      const newFromHand = fromHand.filter((c) => isFree(used, c));
      if (newFromHand.length >= 3 && freeCards.length >= 4) {
        proposals.push({
          name: `4 ${rank} (nouveau)`,
          points: fourScores[rank],
          cards: freeCards.slice(0, 4),
        });
      }
    }
  });

  /* ------------------------------------------------------------------ */
  /* 3. Suites & Mariages --------------------------------------------- */
  /* ------------------------------------------------------------------ */
  for (const suit of ["♠", "♥", "♦", "♣"] as Suit[]) {
    /* --- Suite (J,Q,K,10,A) ---------------------------------------- */
    const want: Rank[] = ["J", "Q", "K", "10", "A"];
    const suiteCards = want
      .map((r) => all.find((c) => c.rank === r && c.suit === suit))
      .filter(Boolean) as Card[];

    const suitePosed = existing.some(
      (c) => c.name.startsWith("Suite") && c.cards.some((x) => x.suit === suit)
    );

    if (suiteCards.length === 5 && !suitePosed) {
      proposals.push({
        name: `Suite ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 250 : 150,
        cards: suiteCards,
      });
    }

    /* --- Mariage ---------------------------------------------------- */
    const marriagePosed = existing.some(
      (c) =>
        c.name.startsWith("Mariage") && c.cards.some((x) => x.suit === suit)
    );

    const king = all.find(
      (c) => c.rank === "K" && c.suit === suit && isFree(used, c)
    );
    const queen = all.find(
      (c) => c.rank === "Q" && c.suit === suit && isFree(used, c)
    );

    if (!marriagePosed && king && queen) {
      proposals.push({
        name: `Mariage ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 40 : 20,
        cards: [king, queen],
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 4. Dame♠ + Valet♦ ------------------------------------------------ */
  /* ------------------------------------------------------------------ */
  const freeQSpade = all.filter(
    (c) => c.rank === "Q" && c.suit === "♠" && isFree(used, c)
  );
  const freeJDia = all.filter(
    (c) => c.rank === "J" && c.suit === "♦" && isFree(used, c)
  );
  const pairs = Math.min(freeQSpade.length, freeJDia.length);

  if (pairs >= 1) {
    proposals.push({
      name: "Dame♠+Valet♦",
      points: 40,
      cards: [freeQSpade[0], freeJDia[0]],
    });
  }
  if (pairs >= 2) {
    proposals.push({
      name: "2×(Dame♠+Valet♦)",
      points: 500,
      cards: [freeQSpade[0], freeJDia[0], freeQSpade[1], freeJDia[1]],
    });
  }

  /* ------------------------------------------------------------------ */
  return proposals;
}
