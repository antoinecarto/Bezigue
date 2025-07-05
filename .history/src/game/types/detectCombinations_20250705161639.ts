/* detectCombinations.ts
   ------------------------------------------------------------------ */
import type { Card, Rank, Suit } from "./Card";

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

    /* cartes libres ou non (pour l’affichage) */
    const totalRankCards = all.filter((c) => c.rank === rank);
    const freeRankCards = totalRankCards.filter((c) => !has(used, c));

    /** Premier carré jamais posé */
    if (!alreadyPosed && totalRankCards.length >= 4) {
      proposals.push({
        name: `4 ${rank}`,
        points: fourScore[rank],
        cards: totalRankCards.slice(0, 4),
      });
      return; // inutile de calculer l’upgrade
    }

    /** Upgrade : au moins 3 nouvelles cartes issues de la main */
    if (alreadyPosed) {
      const newFromHand = hand.filter((c) => c.rank === rank && !has(used, c));
      if (newFromHand.length >= 3 && freeRankCards.length >= 4) {
        proposals.push({
          name: `4 ${rank} (nouveau)`,
          points: fourScore[rank],
          cards: freeRankCards.slice(0, 4),
        });
      }
    }
  });

  /* ---------------------- 2. Suites & Mariages -------------------- */
  for (const suit of allSuits) {
    /* Suite J‑Q‑K‑10‑A (même si Q+K déjà mariés) */
    const want: Rank[] = ["J", "Q", "K", "10", "A"];
    const seqCards = want
      .map((r) => all.find((c) => c.rank === r && c.suit === suit))
      .filter(Boolean) as Card[];

    const seqPosed = existing.some(
      (c) => c.name.startsWith("Suite") && c.cards.some((x) => x.suit === suit)
    );

    if (seqCards.length === 5 && !seqPosed) {
      proposals.push({
        name: `Suite ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 250 : 150,
        cards: seqCards,
      });
    }

    /* Mariage (interdit seulement si déjà posé) */
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
      proposals.push({
        name: `Mariage ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 40 : 20,
        cards: [king, queen],
      });
    }
  }

  /* ---------------------- 3. Dame♠ + Valet♦ ----------------------- */
  const freeQSpade = all.filter(
    (c) => c.rank === "Q" && c.suit === "♠" && !has(used, c)
  );
  const freeJDia = all.filter(
    (c) => c.rank === "J" && c.suit === "♦" && !has(used, c)
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

  return proposals;
}
