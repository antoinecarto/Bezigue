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
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Retourne un Set des codes‑cartes utilisés dans des combos filtrés
 *  par un prédicat (ex : toutes les cartes « mariées », tous les carrés…). */
function usedCards(
  existing: Combination[],
  predicate: (c: Combination) => boolean
): Set<string> {
  const s = new Set<string>();
  existing
    .filter(predicate)
    .forEach((comb) =>
      comb.cards.forEach((card) => s.add(`${card.rank}${card.suit}`))
    );
  return s;
}

/** Compte, dans un tableau de Card, combien appartiennent au Set fourni. */
const countAlreadyUsed = (cards: Card[], used: Set<string>) =>
  cards.filter((c) => used.has(`${c.rank}${c.suit}`)).length;

/* ------------------------------------------------------------------ */
/*  La fonction publique                                               */
/* ------------------------------------------------------------------ */
export function detectCombinations(
  hand: Card[],
  meld: Card[],
  trump: Suit,
  existing: Combination[] = []
): Combination[] {
  const proposals: Combination[] = [];

  /* ---------- 1. Pré‑calculs rapides -------------------- */
  const all = [...hand, ...meld];
  const cardsInHandSet = new Set(hand.map((c) => `${c.rank}${c.suit}`));

  /* ---------- 2. Cartes déjà « bloquées » --------------- */
  const marriedCards = usedCards(existing, (c) => c.name.startsWith("Mariage"));
  const squareCards = usedCards(existing, (c) => /^4 /.test(c.name));
  const dqjdcards = usedCards(existing, (c) => c.name.includes("Dame♠"));

  /* ---------- 3. Carrés --------------------------------- */
  const fourScores: Record<Rank, number> = {
    // toutes les clés ⇒ 0
    "7": 0,
    "8": 0,
    "9": 0,
    "10": 0,
    J: 40,
    Q: 60,
    K: 80,
    A: 100,
  };

  (["A", "K", "Q", "J"] as Rank[]).forEach((rank) => {
    const totalRank = all.filter((c) => c.rank === rank);
    if (totalRank.length < 4) return; // jamais 4 ⇒ stop

    /* cartes déjà utilisées dans des carrés posés ? */
    const already = totalRank.filter((c) =>
      squareCards.has(`${c.rank}${c.suit}`)
    );

    /* cartes neuves présentes EN MAIN (pas dans meld) */
    const freshInHand = totalRank.filter(
      (c) =>
        cardsInHandSet.has(`${c.rank}${c.suit}`) &&
        !squareCards.has(`${c.rank}${c.suit}`)
    );

    if (freshInHand.length >= 3) {
      // On peut reposer un nouveau carré (≥ 3 cartes neuves)
      const complement = totalRank.filter(
        (c) =>
          !freshInHand.includes(c) && !squareCards.has(`${c.rank}${c.suit}`)
      );
      const comboCards = [...freshInHand, ...complement].slice(0, 4);

      proposals.push({
        name: `4 ${rank}`,
        points: fourScores[rank],
        cards: comboCards,
      });
    }
  });
  /* ---------- 4. Mariages / Suites ---------------------- */
  for (const suit of allSuits) {
    const kingMeld = meld.find((c) => c.rank === "K" && c.suit === suit);
    const queenMeld = meld.find((c) => c.rank === "Q" && c.suit === suit);
    const kingHand = hand.find((c) => c.rank === "K" && c.suit === suit);
    const queenHand = hand.find((c) => c.rank === "Q" && c.suit === suit);

    /* ----- SUITE  (toujours proposée si 5 cartes dispos et pas déjà posée) */
    const want: Rank[] = ["J", "Q", "K", "10", "A"];
    const suiteCards = want
      .map((r) => all.find((c) => c.rank === r && c.suit === suit))
      .filter(Boolean) as Card[];

    const suitePosed = existing.some(
      (c) =>
        c.name.startsWith("Suite") && c.cards.some((card) => card.suit === suit)
    );
    if (suiteCards.length === 5 && !suitePosed) {
      proposals.push({
        name: `Suite ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 250 : 150,
        cards: suiteCards,
      });
    }

    /* ----- MARIAGE  (interdit seulement si déjà posé) */
    const marriagePosed = existing.some(
      (c) =>
        c.name.startsWith("Mariage") &&
        c.cards.some((card) => card.suit === suit)
    );

    if (!marriagePosed && kingHand && queenHand) {
      proposals.push({
        name: `Mariage ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 40 : 20,
        cards: [kingHand, queenHand],
      });
    }
  }

  /* ---------- 5. Dame♠ + Valet♦ ------------------------- */
  /* Règle :                                                  */
  /* - 500 pts si AU MOINS 2 paires EXISTENT au total et       */
  /*   le combo 500 n’est pas déjà posé (les cartes peuvent    */
  /*   avoir servi à des 40 pts).                              */
  /* - 40 pts pour chaque paire libre qui n’a pas déjà         */
  /*   été utilisée dans UN combo 40 pts (mais peut l’avoir    */
  /*   été dans le 500).                                       */
  const allQS = all.filter((c) => c.rank === "Q" && c.suit === "♠");
  const allJD = all.filter((c) => c.rank === "J" && c.suit === "♦");
  const totalPairs = Math.min(allQS.length, allJD.length);

  const already500 = existing.some((c) => c.points === 500);
  /* Cartes déjà employées dans des 40 pts */
  const fortyUsed = usedCards(existing, (c) => c.name === "Dame♠+Valet♦");

  /* -- 500 pts ------------------------------------------------ */
  if (totalPairs >= 2 && !already500) {
    proposals.push({
      name: "2×(Dame♠+Valet♦)",
      points: 500,
      cards: [allQS[0], allJD[0], allQS[1], allJD[1]],
    });
  }

  /* -- 40 pts (paires libres) -------------------------------- */
  const freeQS = allQS.filter((c) => !fortyUsed.has(`${c.rank}${c.suit}`));
  const freeJD = allJD.filter((c) => !fortyUsed.has(`${c.rank}${c.suit}`));
  const freePairs = Math.min(freeQS.length, freeJD.length);

  if (freePairs >= 1) {
    proposals.push({
      name: "Dame♠+Valet♦",
      points: 40,
      cards: [freeQS[0], freeJD[0]],
    });
  }
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
