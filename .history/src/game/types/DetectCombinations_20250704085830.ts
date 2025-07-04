import type { Card, Suit, Rank } from "@/game/types/Card";

export interface Combination {
  name: string;
  points: number;
  cards: Card[];
}

/* ----- constantes utiles ----- */
const allSuits: Suit[] = ["♠", "♥", "♦", "♣"];
const fourScores: Record<Rank, number> = { A: 100, K: 80, Q: 60, J: 40 };

/* ------------------------------------------------------------------ */
/*  La fonction publique                                               */
/* ------------------------------------------------------------------ */
export function detectCombinations(
  hand: Card[],
  alreadyMelded: Card[],
  trump: Suit
): Combination[] {
  /* 1. On prépare quelques index rapides ------------------------- */
  const byRank = new Map<Rank, Card[]>();
  const bySuitHand = new Map<Suit, Card[]>();
  const meldSet = new Set(alreadyMelded.map((c) => c.toString()));

  for (const r of ["7", "8", "9", "10", "J", "Q", "K", "A"] as Rank[]) {
    byRank.set(r, []);
  }
  for (const s of allSuits) {
    bySuitHand.set(s, []);
  }

  hand.forEach((c) => {
    byRank.get(c.rank)!.push(c);
    bySuitHand.get(c.suit)!.push(c);
  });
  alreadyMelded.forEach((c) => byRank.get(c.rank)!.push(c)); // pour les carrés

  /* 2. Résultat */
  const out: Combination[] = [];

  /* ---------- Carrés (A,K,Q,J) : au moins 1 carte neuve --------- */
  (["A", "K", "Q", "J"] as Rank[]).forEach((r) => {
    const total = byRank.get(r)!.length;
    const neuves = byRank.get(r)!.filter((c) => !meldSet.has(c.toString()));

    if (total >= 4 && neuves.length > 0) {
      // On reconstruit proprement les 4 cartes
      const pile = [
        ...neuves,
        ...byRank.get(r)!.filter((c) => meldSet.has(c.toString())),
      ].slice(0, 4);
      out.push({ name: `4 ${r}`, points: fourScores[r], cards: pile });
    }
  });

  /* ---------- Mariages & suites -------------------------------- */
  for (const suit of allSuits) {
    const roiMain = bySuitHand.get(suit)!.find((c) => c.rank === "K");
    const dameMain = bySuitHand.get(suit)!.find((c) => c.rank === "Q");

    const roiMeld = alreadyMelded.find(
      (c) => c.rank === "K" && c.suit === suit
    );
    const dameMeld = alreadyMelded.find(
      (c) => c.rank === "Q" && c.suit === suit
    );

    /* -- Mariage possible si pas déjà marié -- */
    if (!(roiMeld && dameMeld)) {
      if (roiMain && dameMain) {
        addCombo(out, suit, trump, [roiMain, dameMain]);
      } else if (roiMain && dameMeld) {
        addCombo(out, suit, trump, [roiMain, dameMeld]);
      } else if (dameMain && roiMeld) {
        addCombo(out, suit, trump, [dameMain, roiMeld]);
      }
    }

    /* -- Suite si mariage déjà posé + J‑10‑A tous en main -- */
    if (roiMeld && dameMeld) {
      const j = bySuitHand.get(suit)!.find((c) => c.rank === "J");
      const ten = bySuitHand.get(suit)!.find((c) => c.rank === "10");
      const a = bySuitHand.get(suit)!.find((c) => c.rank === "A");
      if (j && ten && a) {
        addCombo(out, suit, trump, [roiMeld, dameMeld, j, ten, a], true);
      }
    }
  }

  /* ---------- Dame ♠ + Valet ♦ ------------------------------- */
  const qS = findFirst(hand, alreadyMelded, "Q", "♠");
  const jD = findFirst(hand, alreadyMelded, "J", "♦");
  if (qS && jD) out.push({ name: "Dame♠+Valet♦", points: 40, cards: [qS, jD] });

  /* +500 si une *seconde* paire encore toute neuve ---------------- */
  const qS2 = findFirst(
    hand.filter((c) => c !== qS),
    alreadyMelded.filter((c) => c !== qS),
    "Q",
    "♠"
  );
  const jD2 = findFirst(
    hand.filter((c) => c !== jD),
    alreadyMelded.filter((c) => c !== jD),
    "J",
    "♦"
  );
  if (qS && jD && qS2 && jD2) {
    out.push({
      name: "2×(Dame♠+Valet♦)",
      points: 500,
      cards: [qS, jD, qS2, jD2],
    });
  }

  return out;
}

/* ---------- helpers interne ---------- */
function addCombo(
  arr: Combination[],
  suit: Suit,
  trump: Suit,
  cards: Card[],
  isSuite = false
) {
  const atout = suit === trump ? " d’atout" : "";
  arr.push({
    name: isSuite ? `Suite ${suit}${atout}` : `Mariage ${suit}${atout}`,
    points: isSuite ? (suit === trump ? 250 : 150) : suit === trump ? 40 : 20,
    cards,
  });
}

/* Premier exemplaire main »puis meld » */
function findFirst(
  main: Card[],
  meld: Card[],
  rank: Rank,
  suit: Suit
): Card | undefined {
  return (
    main.find((c) => c.rank === rank && c.suit === suit) ??
    meld.find((c) => c.rank === rank && c.suit === suit)
  );
}
