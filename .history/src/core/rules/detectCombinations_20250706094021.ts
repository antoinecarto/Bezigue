/* detectCombinations.ts – rev. «une carte peut être utilisée pour plusieurs
   combinaisons différentes mais jamais deux fois pour la même».          */

import type { Card, Rank, Suit } from "../../game/types/Card";

/* ------------ Types retournés ------------------------------------- */
export interface Combination {
  name: string;
  points: number;
  cards: Card[];
}

/* ------------ Constantes ------------------------------------------ */
const allSuits: Suit[] = ["♠", "♥", "♦", "♣"];
const fourScore: Record<Rank, number> = {
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
/*  Gestion « cartes déjà utilisées »                                 */
/* ------------------------------------------------------------------ */
// Une carte peut apparaître dans plusieurs types différents (square,
// sequence, marriage…) mais **jamais dans DEUX combinaisons du même type**.
// On distingue donc les types via un Flag.
type Flag = "marriage" | "sequence" | "square" | "couple40";

type UsedMap = Map<string, Set<Flag>>;

const key = (c: Card) => `${c.rank}${c.suit}`;
const has = (map: UsedMap, c: Card, f?: Flag) =>
  f ? map.get(key(c))?.has(f) : map.has(key(c));
const add = (map: UsedMap, cs: Card[], flag: Flag) => {
  for (const c of cs) {
    const set = map.get(key(c)) ?? new Set<Flag>();
    set.add(flag);
    map.set(key(c), set);
  }
};

/* Marque les combinaisons déjà posées (sauf mariage simple : K+Q restent libres) */
function seedUsed(existing: Combination[]): UsedMap {
  const used: UsedMap = new Map();
  for (const comb of existing) {
    if (comb.name.startsWith("Mariage ")) continue; // on les laisse libres
    const flag: Flag = comb.name.startsWith("Suite")
      ? "sequence"
      : comb.name.startsWith("4 ")
      ? "square"
      : comb.name.includes("Dame♠")
      ? "couple40"
      : "sequence";
    add(used, comb.cards, flag);
  }
  return used;
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
  const proposals: Combination[] = [];
  const all = [...hand, ...meld];
  const used = seedUsed(existing);

  /* ---------------------- 1. Carrés ------------------------------- */
  (["A", "K", "Q", "J"] as Rank[]).forEach((rank) => {
    const alreadyPosed = existing.some((c) => c.name === `4 ${rank}`);

    const totalRankCards = all.filter((c) => c.rank === rank);
    const freeRankCards = totalRankCards.filter((c) => !has(used, c));

    if (!alreadyPosed && totalRankCards.length >= 4) {
      proposals.push({
        name: `4 ${rank}`,
        points: fourScore[rank],
        cards: totalRankCards.slice(0, 4),
      });
      add(used, totalRankCards.slice(0, 4), "square");
      return; // inutile de gérer upgrade
    }

    if (alreadyPosed) {
      const newFromHand = hand.filter((c) => c.rank === rank && !has(used, c));
      if (newFromHand.length >= 3 && freeRankCards.length >= 4) {
        proposals.push({
          name: `4 ${rank} (nouveau)`,
          points: fourScore[rank],
          cards: freeRankCards.slice(0, 4),
        });
        add(used, freeRankCards.slice(0, 4), "square");
      }
    }
  });

  /* ---------------------- 2. Suites & Mariages -------------------- */
  for (const suit of allSuits) {
    // ----- Suite J‑Q‑K‑10‑A ---------------------------------------
    const want: Rank[] = ["J", "Q", "K", "10", "A"];
    const seqCards = want
      .map((r) => all.find((c) => c.rank === r && c.suit === suit))
      .filter(Boolean) as Card[];
    const seqPosed = existing.some(
      (c) => c.name.startsWith("Suite") && c.cards.some((x) => x.suit === suit)
    );

    if (seqCards.length === 5 && !seqPosed) {
      proposals.push({
        name: `Suite ${suit}${suit === trump ? " d\u2019atout" : ""}`,
        points: suit === trump ? 250 : 150,
        cards: seqCards,
      });
      add(used, seqCards, "sequence");
    }

    // ----- Mariage -------------------------------------------------
    const marriagePosed = existing.some(
      (c) =>
        c.name.startsWith("Mariage") && c.cards.some((x) => x.suit === suit)
    );
    const king = all.find(
      (c) => c.rank === "K" && c.suit === suit && !has(used, c, "marriage")
    );
    const queen = all.find(
      (c) => c.rank === "Q" && c.suit === suit && !has(used, c, "marriage")
    );

    if (!marriagePosed && king && queen) {
      const comboCards = [king, queen];
      proposals.push({
        name: `Mariage ${suit}${suit === trump ? " d\u2019atout" : ""}`,
        points: suit === trump ? 40 : 20,
        cards: comboCards,
      });
      add(used, comboCards, "marriage");
    }
  }

  /* ---------------------- 3. Dame♠ + Valet♦ ----------------------- */
  // On peut avoir jusqu'à deux couples (double paquet). Chaque carte
  // ne peut toutefois appartenir qu'à **un seul couple40**.
  const freeQSpade = all.filter(
    (c) => c.rank === "Q" && c.suit === "♠" && !has(used, c, "couple40")
  );
  const freeJDia = all.filter(
    (c) => c.rank === "J" && c.suit === "♦" && !has(used, c, "couple40")
  );
  const maxPairs = Math.min(freeQSpade.length, freeJDia.length);

  for (let i = 0; i < maxPairs; i++) {
    const comboCards = [freeQSpade[i], freeJDia[i]];
    const points = i === 0 ? 40 : 500; // 1er couple 40, 2e couple 500
    const name = i === 0 ? "Dame♠+Valet♦" : "Dame♠+Valet♦ (500)";

    proposals.push({ name, points, cards: comboCards });
    add(used, comboCards, "couple40");
  }

  return proposals;
}
