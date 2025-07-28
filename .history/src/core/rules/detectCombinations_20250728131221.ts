/* detectCombinations.ts – « une carte peut servir à plusieurs types,
   jamais deux fois pour le même type » – version string‑based */

import type { Rank, Suit } from "@/game/models/Card";

/* ------------ Types retournés ------------------------------- */
export interface Combination {
  name: string;
  points: number;
  cards: string[]; // ← cartes sous forme de codes "K♣", "A♦", …
}

/* ------------ Constantes ------------------------------------ */
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

/* ----------------------------------------------------------------
   Gestion « carte déjà utilisée »
----------------------------------------------------------------- */
type Flag = "marriage" | "sequence" | "square" | "couple40";
type UsedMap = Map<string, Set<Flag>>;

const rankOf = (code: string) => code.slice(0, -1) as Rank; // ex. "K"
const suitOf = (code: string) => code.slice(-1) as Suit; // ex. "♣"
const has = (map: UsedMap, code: string, f?: Flag) =>
  f ? map.get(code)?.has(f) : map.has(code);
const add = (map: UsedMap, cs: string[], flag: Flag) => {
  for (const code of cs) {
    const set = map.get(code) ?? new Set<Flag>();
    set.add(flag);
    map.set(code, set);
  }
};

/* Marque les combinaisons déjà validées  */
function seedUsed(existing: Combination[]): UsedMap {
  const used: UsedMap = new Map();
  for (const comb of existing) {
    if (comb.name.startsWith("Mariage ")) continue; // K+Q restent libres
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

/* ----------------------------------------------------------------
   Fonction principale
----------------------------------------------------------------- */
export function detectCombinations(
  hand: string[],
  meld: string[],
  trump: Suit,
  existing: Combination[] = []
): Combination[] {
  const proposals: Combination[] = [];
  const all = [...hand, ...meld];
  const used = seedUsed(existing);

  /* ---------- 1. Carrés ------------------------------------- */
  (["A", "K", "Q", "J"] as Rank[]).forEach((rank) => {
    const already = existing.some((c) => c.name === `4 ${rank}`);

    const totalRank = all.filter((c) => rankOf(c) === rank);
    const freeRank = totalRank.filter((c) => !has(used, c));

    if (!already && totalRank.length >= 4) {
      const cards = totalRank.slice(0, 4);
      proposals.push({ name: `4 ${rank}`, points: fourScore[rank], cards });
      add(used, cards, "square");
      return;
    }

    if (already) {
      const newFromHand = hand.filter(
        (c) => rankOf(c) === rank && !has(used, c)
      );
      if (newFromHand.length >= 3 && freeRank.length >= 4) {
        const cards = freeRank.slice(0, 4);
        proposals.push({
          name: `4 ${rank} (nouveau)`,
          points: fourScore[rank],
          cards,
        });
        add(used, cards, "square");
      }
    }
  });

  /* ---------- 2. Suites & Mariages -------------------------- */
  for (const suit of allSuits) {
    /* Suite JQK10A */
    const need: Rank[] = ["J", "Q", "K", "10", "A"];
    const seqCards = need
      .map((r) => all.find((c) => rankOf(c) === r && suitOf(c) === suit))
      .filter(Boolean) as string[];
    const seqPosed = existing.some(
      (c) =>
        c.name.startsWith("Suite") && c.cards.some((x) => suitOf(x) === suit)
    );

    if (seqCards.length === 5 && !seqPosed) {
      proposals.push({
        name: `Suite ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 250 : 150,
        cards: seqCards,
      });
      add(used, seqCards, "sequence");
    }

    /* Mariage K+Q */
    const marriagePosed = existing.some(
      (c) =>
        c.name.startsWith("Mariage") && c.cards.some((x) => suitOf(x) === suit)
    );
    const king = all.find(
      (c) =>
        rankOf(c) === "K" && suitOf(c) === suit && !has(used, c, "marriage")
    );
    const queen = all.find(
      (c) =>
        rankOf(c) === "Q" && suitOf(c) === suit && !has(used, c, "marriage")
    );

    if (!marriagePosed && king && queen) {
      const cards = [king, queen];
      proposals.push({
        name: `Mariage ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 40 : 20,
        cards,
      });
      add(used, cards, "marriage");
    }
  }

  /* ---------- 3. Dame♠ + Valet♦ ----------------------------- */
  const freeQSpade = all.filter((c) => c === "Q♠" && !has(used, c, "couple40"));
  const freeJDia = all.filter((c) => c === "J♦" && !has(used, c, "couple40"));
  const maxPairs = Math.min(freeQSpade.length, freeJDia.length);

  for (let i = 0; i < maxPairs; i++) {
    const cards = [freeQSpade[i], freeJDia[i]];
    const points = i === 0 ? 40 : 500;
    const name = i === 0 ? "Dame♠+Valet♦" : "Dame♠+Valet♦ (500)";

    proposals.push({ name, points, cards });
    add(used, cards, "couple40");
  }

  return proposals;
}
