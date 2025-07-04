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
/*  Helpers internes                                                  */
/* ------------------------------------------------------------------ */
const cardToStr = (c: Card): string => `${c.rank}${c.suit}`;

/** Map globale (à l’appel) des cartes déjà “prises” par des combinaisons */
type UsedMap = Map<string, number>;

function take(used: UsedMap, cards: Card[]) {
  for (const c of cards) {
    const k = cardToStr(c);
    used.set(k, (used.get(k) ?? 0) + 1);
  }
}

function isFree(used: UsedMap, c: Card): boolean {
  return (used.get(cardToStr(c)) ?? 0) === 0;
}

function countAvailable(used: UsedMap, pool: Card[], rank: Rank): number {
  return pool.filter((c) => c.rank === rank && isFree(used, c)).length;
}

/* ------------------------------------------------------------------ */
/*  Fonction principale                                               */
/* ------------------------------------------------------------------ */
export function detectCombinations(
  hand: Card[],
  meld: Card[],
  trump: Suit,
  existing: Combination[] = []
): Combination[] {
  /* ------------------------------------------------------------ */
  /* 1.  Structures de travail                                    */
  /* ------------------------------------------------------------ */
  const proposals: Combination[] = [];
  const used: UsedMap = new Map();

  /* Marque toutes les cartes déjà posées dans `existing` comme utilisées */
  for (const comb of existing) take(used, comb.cards);

  const pool = [...hand, ...meld]; // toutes les cartes “possibles”

  /* ------------------------------------------------------------ */
  /* 2.  DETECTION DES QUARTES (4 cartes même rang)               */
  /* ------------------------------------------------------------ */
  (["A", "K", "Q", "J"] as Rank[]).forEach((rank) => {
    const alreadyPosed = existing.some((c) => c.name === `4 ${rank}`);

    const freeCount = countAvailable(used, pool, rank);
    if (alreadyPosed) {
      /* ➜ Un carré de ce rang est déjà posé.
         Il faut au moins 3 cartes venant de la main
         pour proposer un nouveau carré. */
      const inHand = hand.filter(
        (c) => c.rank === rank && isFree(used, c)
      ).length;
      if (freeCount === 4 && inHand >= 3) {
        const cards = pool.filter((c) => c.rank === rank && isFree(used, c));
        proposals.push({
          name: `4 ${rank}`,
          points: fourBaseScore[rank],
          cards,
        });
        take(used, cards); // on les bloque pour éviter recollisions
      }
    } else if (freeCount === 4) {
      /* Aucun carré de ce rang encore posé → on le propose */
      const cards = pool.filter((c) => c.rank === rank && isFree(used, c));
      proposals.push({
        name: `4 ${rank}`,
        points: fourBaseScore[rank],
        cards,
      });
      take(used, cards);
    }
  });

  /* ------------------------------------------------------------ */
  /* 3.  MARIAGES & SUITES                                        */
  /* ------------------------------------------------------------ */
  for (const suit of allSuits) {
    /* objets rapides */
    const king = pool.find(
      (c) => c.rank === "K" && c.suit === suit && isFree(used, c)
    );
    const queen = pool.find(
      (c) => c.rank === "Q" && c.suit === suit && isFree(used, c)
    );

    const marriagePosed = existing.some(
      (c) =>
        c.name.startsWith("Mariage") &&
        c.cards.some((cc) => cc.rank === "K" && cc.suit === suit)
    );

    /* ----- SUITE (J Q K 10 A) -------------------------------- */
    const ranksNeeded: Rank[] = ["J", "Q", "K", "10", "A"];
    const suiteCards = ranksNeeded
      .map((r) =>
        pool.find((c) => c.rank === r && c.suit === suit && isFree(used, c))
      )
      .filter(Boolean) as Card[];

    const suitePosed = existing.some(
      (c) =>
        c.name.startsWith("Suite") && c.cards.some((cc) => cc.suit === suit)
    );

    if (suiteCards.length === 5 && !suitePosed) {
      proposals.push({
        name: `Suite ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 250 : 150,
        cards: suiteCards,
      });
      take(used, suiteCards);
    }

    /* ----- MARIAGE ------------------------------------------- */
    if (!marriagePosed && king && queen) {
      proposals.push({
        name: `Mariage ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 40 : 20,
        cards: [king, queen],
      });
      take(used, [king, queen]);
    }
  }

  /* ------------------------------------------------------------ */
  /* 4.  DAME♠ + VALET♦ (×1 ou ×2)                               */
  /* ------------------------------------------------------------ */
  const qsFree = pool.filter(
    (c) => c.rank === "Q" && c.suit === "♠" && isFree(used, c)
  );
  const jdFree = pool.filter(
    (c) => c.rank === "J" && c.suit === "♦" && isFree(used, c)
  );
  const pairsFree = Math.min(qsFree.length, jdFree.length);

  const alreadyPosedPairs = existing.filter((c) =>
    c.name.startsWith("Dame♠")
  ).length; // 0,1 ou 2

  const canPropose = Math.min(2 - alreadyPosedPairs, pairsFree);

  for (let i = 0; i < canPropose; i++) {
    // si deux paires dispo → on propose d’abord 500 pts, sinon 40
    if (canPropose === 2 && i === 0) {
      const cards = [qsFree[0], jdFree[0], qsFree[1], jdFree[1]];
      proposals.push({ name: "2×(Dame♠+Valet♦)", points: 500, cards });
      take(used, cards);
      i++; // on saute un cran
    } else {
      const cards = [qsFree[i], jdFree[i]];
      proposals.push({ name: "Dame♠+Valet♦", points: 40, cards });
      take(used, cards);
    }
  }

  /* ------------------------------------------------------------ */
  /* 5.  Résultat                                                 */
  /* ------------------------------------------------------------ */
  return proposals;
}
