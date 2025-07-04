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
