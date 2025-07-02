const order: Rank[] = ["7", "8", "9", "J", "Q", "K", "10", "A"];
const allSuits: Suit[] = ["♠", "♥", "♦", "♣"];

const isTrump = (card: Card, trump: Suit) => card.suit === trump;

function detectCombinations(
  hand: Card[],
  meld: Card[],
  trump: Suit,
  existing: Combination[] = []
): Combination[] {
  const combos: Combination[] = [];

  // Toutes les cartes "connues" (main + meld)
  const all = [...hand, ...meld];

  // Map par rang, main seule et meld seule
  const byRankAll: Record<Rank, Card[]> = {
    "7": [],
    "8": [],
    "9": [],
    "10": [],
    J: [],
    Q: [],
    K: [],
    A: [],
  };
  const byRankHand: Record<Rank, Card[]> = {
    "7": [],
    "8": [],
    "9": [],
    "10": [],
    J: [],
    Q: [],
    K: [],
    A: [],
  };
  const byRankMeld: Record<Rank, Card[]> = {
    "7": [],
    "8": [],
    "9": [],
    "10": [],
    J: [],
    Q: [],
    K: [],
    A: [],
  };
  console.log("Toutes les cartes reçues dans detectCombinations :", all);
  console.log("Toutes les cartes reçues dans detectCombinations :", hand);
  console.log("Toutes les cartes reçues dans detectCombinations :", meld);

  all.forEach((c) => byRankAll[c.rank].push(c));
  hand.forEach((c) => byRankHand[c.rank].push(c));
  meld.forEach((c) => byRankMeld[c.rank].push(c));

  // Map par couleur dans main et meld (utile pour mariage / suite)
  const bySuitHand: Record<Suit, Card[]> = {
    "♠": [],
    "♥": [],
    "♦": [],
    "♣": [],
  };
  const bySuitMeld: Record<Suit, Card[]> = {
    "♠": [],
    "♥": [],
    "♦": [],
    "♣": [],
  };
  hand.forEach((c) => bySuitHand[c.suit].push(c));
  meld.forEach((c) => bySuitMeld[c.suit].push(c));

  // Pour éviter doublons
  const toKey = (cs: Card[]) =>
    cs
      .map((c) => `${c.rank}${c.suit}`)
      .sort()
      .join("-");
  const already = new Set(existing.map((c) => toKey(c.cards)));
  const pushIfNew = (c: Combination) => {
    if (!already.has(toKey(c.cards))) combos.push(c);
  };

  /* -------- CARRES -------- */
  const fourMap = { A: 100, K: 80, Q: 60, J: 40 } as const;
  (["A", "K", "Q", "J"] as Rank[]).forEach((r) => {
    const totalCount = byRankAll[r].length; // cartes dans main + meld
    if (totalCount >= 4) {
      // On veut proposer le carré si on peut au moins en poser un nouveau avec la main

      // au moins 1 carte du rang dans meld
      const meldCount = byRankMeld[r].length;
      // au moins une carte dans la main pour compléter (différence au total)
      const handCount = byRankHand[r].length;

      // on ne propose que si la main apporte au moins une carte et il y a au moins une carte dans meld
      if (meldCount >= 1 && handCount >= 1) {
        // Construire le carré avec toutes cartes de la main + meld de ce rang (max 4)
        const cardsInCombo = [...byRankMeld[r], ...byRankHand[r]].slice(0, 4);
        pushIfNew({
          name: `4 ${r}`,
          points: fourMap[r],
          cards: cardsInCombo,
        });
      }
      // Sinon, si tout le carré est en main (pas posé avant), proposer aussi
      else if (meldCount === 0 && handCount >= 4) {
        const cardsInCombo = byRankHand[r].slice(0, 4);
        pushIfNew({
          name: `4 ${r}`,
          points: fourMap[r],
          cards: cardsInCombo,
        });
      }
    }
  });

  /* -------- MARIAGES -------- */
  allSuits.forEach((s) => {
    // Combinaisons déjà posées dans meld avec roi+reine ?
    const meldKing = bySuitMeld[s].find((c) => c.rank === "K");
    const meldQueen = bySuitMeld[s].find((c) => c.rank === "Q");

    // Pour savoir si mariage déjà posé dans meld
    const mariagePosed = meldKing && meldQueen;

    // Cherche roi et reine dans main (hors meld)
    const handKing = bySuitHand[s].find((c) => c.rank === "K");
    const handQueen = bySuitHand[s].find((c) => c.rank === "Q");

    // Mariage déjà posé ? Si non, on peut proposer mariage en main (ou main+meld)
    if (!mariagePosed) {
      // mariage complet dans main uniquement
      if (handKing && handQueen) {
        const atout = s === trump ? " d’atout" : "";
        pushIfNew({
          name: `Mariage ${s}${atout}`,
          points: s === trump ? 40 : 20,
          cards: [handKing, handQueen],
        });
      }
      // mariage avec roi dans meld + reine dans main
      else if (meldKing && handQueen) {
        const atout = s === trump ? " d’atout" : "";
        pushIfNew({
          name: `Mariage ${s}${atout}`,
          points: s === trump ? 40 : 20,
          cards: [meldKing, handQueen],
        });
      }
      // mariage avec reine dans meld + roi dans main
      else if (meldQueen && handKing) {
        const atout = s === trump ? " d’atout" : "";
        pushIfNew({
          name: `Mariage ${s}${atout}`,
          points: s === trump ? 40 : 20,
          cards: [meldQueen, handKing],
        });
      }
    }
    // Si mariage posé dans meld, on peut proposer la suite si main contient les cartes suivantes
    if (mariagePosed) {
      // Suite = J, Q, K, 10, A (mais roi et reine déjà posés)
      // On vérifie si on a J, 10, A dans la main de la même couleur
      const neededRanks: Rank[] = ["J", "10", "A"];
      const hasNeeded = neededRanks.every((r) =>
        bySuitHand[s].some((c) => c.rank === r)
      );
      if (hasNeeded) {
        // On prend les cartes roi+reine du meld + les cartes J,10,A de la main
        const cardsSuite = [
          meldQueen!,
          meldKing!,
          ...neededRanks.map((r) => bySuitHand[s].find((c) => c.rank === r)!),
        ];
        const atout = s === trump ? " d’atout" : "";
        pushIfNew({
          name: `Suite ${s}${atout}`,
          points: s === trump ? 250 : 150,
          cards: cardsSuite,
        });
      }
    }
  });

  /* -------- DAME♠ + VALET♦ -------- */
  const qs = all.filter((c) => c.rank === "Q" && c.suit === "♠");
  const jd = all.filter((c) => c.rank === "J" && c.suit === "♦");
  const pairs = Math.min(qs.length, jd.length);
  if (pairs >= 1)
    pushIfNew({ name: "Dame♠+Valet♦", points: 40, cards: [qs[0], jd[0]] });
  if (pairs >= 2)
    pushIfNew({
      name: "2×(Dame♠+Valet♦)",
      points: 500,
      cards: [qs[0], jd[0], qs[1], jd[1]],
    });

  return combos;
}