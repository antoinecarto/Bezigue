import type { Card, Suit, Rank } from "@/game/types/Card";

export interface Combination {
  name: string;
  points: number;
  cards: Card[];
}

/* ----- constantes utiles ----- */
const allSuits: Suit[] = ["♠", "♥", "♦", "♣"];
const fourScores: Record<Rank, number> = {
  "7": 0,
  "8": 0,
  "9": 0,
  "10": 0,
  A: 100,
  K: 80,
  Q: 60,
  J: 40,
};

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

// function detectCombinations(
//   hand: Card[],
//   meld: Card[],
//   trump: Suit,
//   existing: Combination[] = []
// ): Combination[] {
//   const combos: Combination[] = [];

//   // Toutes les cartes "connues" (main + meld)
//   const all = [...hand, ...meld];

//   // Map par rang, main seule et meld seule
//   const byRankAll: Record<Rank, Card[]> = {
//     "7": [],
//     "8": [],
//     "9": [],
//     "10": [],
//     J: [],
//     Q: [],
//     K: [],
//     A: [],
//   };
//   const byRankHand: Record<Rank, Card[]> = {
//     "7": [],
//     "8": [],
//     "9": [],
//     "10": [],
//     J: [],
//     Q: [],
//     K: [],
//     A: [],
//   };
//   const byRankMeld: Record<Rank, Card[]> = {
//     "7": [],
//     "8": [],
//     "9": [],
//     "10": [],
//     J: [],
//     Q: [],
//     K: [],
//     A: [],
//   };

//   all.forEach((c) => byRankAll[c.rank].push(c));
//   hand.forEach((c) => byRankHand[c.rank].push(c));
//   meld.forEach((c) => byRankMeld[c.rank].push(c));

//   // Map par couleur dans main et meld (utile pour mariage / suite)
//   const bySuitHand: Record<Suit, Card[]> = {
//     "♠": [],
//     "♥": [],
//     "♦": [],
//     "♣": [],
//   };
//   const bySuitMeld: Record<Suit, Card[]> = {
//     "♠": [],
//     "♥": [],
//     "♦": [],
//     "♣": [],
//   };
//   hand.forEach((c) => bySuitHand[c.suit].push(c));
//   meld.forEach((c) => bySuitMeld[c.suit].push(c));

//   // Pour éviter doublons
//   const toKey = (cs: Card[]) =>
//     cs
//       .map((c) => `${c.rank}${c.suit}`)
//       .sort()
//       .join("-");
//   const already = new Set(existing.map((c) => toKey(c.cards)));
//   const pushIfNew = (c: Combination) => {
//     if (!already.has(toKey(c.cards))) combos.push(c);
//   };

//   /* -------- CARRES -------- */
//   const fourMap = { A: 100, K: 80, Q: 60, J: 40 } as const;
//   (["A", "K", "Q", "J"] as Rank[]).forEach((r) => {
//     const totalCount = byRankAll[r].length; // cartes dans main + meld
//     if (totalCount >= 4) {
//       // On veut proposer le carré si on peut au moins en poser un nouveau avec la main

//       // au moins 1 carte du rang dans meld
//       const meldCount = byRankMeld[r].length;
//       // au moins une carte dans la main pour compléter (différence au total)
//       const handCount = byRankHand[r].length;

//       // on ne propose que si la main apporte au moins une carte et il y a au moins une carte dans meld
//       if (meldCount >= 1 && handCount >= 1) {
//         // Construire le carré avec toutes cartes de la main + meld de ce rang (max 4)
//         const cardsInCombo = [...byRankMeld[r], ...byRankHand[r]].slice(0, 4);
//         pushIfNew({
//           name: `4 ${r}`,
//           points: fourMap[r],
//           cards: cardsInCombo,
//         });
//       }
//       // Sinon, si tout le carré est en main (pas posé avant), proposer aussi
//       else if (meldCount === 0 && handCount >= 4) {
//         const cardsInCombo = byRankHand[r].slice(0, 4);
//         pushIfNew({
//           name: `4 ${r}`,
//           points: fourMap[r],
//           cards: cardsInCombo,
//         });
//       }
//     }
//   });

//   /* -------- MARIAGES -------- */
//   allSuits.forEach((s) => {
//     // Combinaisons déjà posées dans meld avec roi+reine ?
//     const meldKing = bySuitMeld[s].find((c) => c.rank === "K");
//     const meldQueen = bySuitMeld[s].find((c) => c.rank === "Q");

//     // Pour savoir si mariage déjà posé dans meld
//     const mariagePosed = meldKing && meldQueen;

//     // Cherche roi et reine dans main (hors meld)
//     const handKing = bySuitHand[s].find((c) => c.rank === "K");
//     const handQueen = bySuitHand[s].find((c) => c.rank === "Q");

//     // Mariage déjà posé ? Si non, on peut proposer mariage en main (ou main+meld)
//     if (!mariagePosed) {
//       // mariage complet dans main uniquement
//       if (handKing && handQueen) {
//         const atout = s === trump ? " d’atout" : "";
//         pushIfNew({
//           name: `Mariage ${s}${atout}`,
//           points: s === trump ? 40 : 20,
//           cards: [handKing, handQueen],
//         });
//       }
//       // mariage avec roi dans meld + reine dans main
//       else if (meldKing && handQueen) {
//         const atout = s === trump ? " d’atout" : "";
//         pushIfNew({
//           name: `Mariage ${s}${atout}`,
//           points: s === trump ? 40 : 20,
//           cards: [meldKing, handQueen],
//         });
//       }
//       // mariage avec reine dans meld + roi dans main
//       else if (meldQueen && handKing) {
//         const atout = s === trump ? " d’atout" : "";
//         pushIfNew({
//           name: `Mariage ${s}${atout}`,
//           points: s === trump ? 40 : 20,
//           cards: [meldQueen, handKing],
//         });
//       }
//     }
//     // Si mariage posé dans meld, on peut proposer la suite si main contient les cartes suivantes
//     if (mariagePosed) {
//       // Suite = J, Q, K, 10, A (mais roi et reine déjà posés)
//       // On vérifie si on a J, 10, A dans la main de la même couleur
//       const neededRanks: Rank[] = ["J", "10", "A"];
//       const hasNeeded = neededRanks.every((r) =>
//         bySuitHand[s].some((c) => c.rank === r)
//       );
//       if (hasNeeded) {
//         // On prend les cartes roi+reine du meld + les cartes J,10,A de la main
//         const cardsSuite = [
//           meldQueen!,
//           meldKing!,
//           ...neededRanks.map((r) => bySuitHand[s].find((c) => c.rank === r)!),
//         ];
//         const atout = s === trump ? " d’atout" : "";
//         pushIfNew({
//           name: `Suite ${s}${atout}`,
//           points: s === trump ? 250 : 150,
//           cards: cardsSuite,
//         });
//       }
//     }
//   });

//   /* -------- DAME♠ + VALET♦ -------- */
//   const qs = all.filter((c) => c.rank === "Q" && c.suit === "♠");
//   const jd = all.filter((c) => c.rank === "J" && c.suit === "♦");
//   const pairs = Math.min(qs.length, jd.length);
//   if (pairs >= 1)
//     pushIfNew({ name: "Dame♠+Valet♦", points: 40, cards: [qs[0], jd[0]] });
//   if (pairs >= 2)
//     pushIfNew({
//       name: "2×(Dame♠+Valet♦)",
//       points: 500,
//       cards: [qs[0], jd[0], qs[1], jd[1]],
//     });

//   return combos;
// }
