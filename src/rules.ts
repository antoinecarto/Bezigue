/*────────── Types de base ──────────*/
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export interface Card {
  rank: Rank;
  suit: Suit;
}
export interface Combination {
  name: string;
  points: number;
  cards: Card[];
}

/*────────── Utils ──────────*/
export const cardToStr = (c: Card) => `${c.rank}${c.suit}`;
export const strToCard = (s: string): Card => ({
  rank: s.slice(0, -1) as Rank,
  suit: s.slice(-1) as Suit,
});

/*────────── Moteur de détection ──────────*/
export function detectCombos(
  hand: Card[],
  meldCards: Card[],
  trump: Suit,
  already: Combination[] = []
): Combination[] {
  const res: Combination[] = [];
  const seen = new Set(already.map((c) => key(c.cards)));

  const push = (c: Combination) => !seen.has(key(c.cards)) && res.push(c);
  const key = (cs: Card[]) => cs.map(cardToStr).sort().join("-");

  /* 1. Carrés As‑Roi‑Dame‑Valet */
  const byRank = groupBy([...hand, ...meldCards], "rank");
  const pts = { A: 100, K: 80, Q: 60, J: 40 } as const;
  (["A", "K", "Q", "J"] as Rank[]).forEach((r) => {
    const c = byRank[r] ?? [];
    if (c.length >= 4)
      push({ name: `4 ${r}`, points: pts[r], cards: c.slice(0, 4) });
  });

  /* 2. Mariages + suites */
  (["♠", "♥", "♦", "♣"] as Suit[]).forEach((s) => {
    const k = findOne("K", s),
      q = findOne("Q", s);
    if (k && q)
      push({
        name: `Mariage ${s}${s === trump ? " d’atout" : ""}`,
        points: s === trump ? 40 : 20,
        cards: [k, q],
      });

    const need: Rank[] = ["J", "Q", "K", "10", "A"];
    const suite = need.map((rnk) => findOne(rnk, s));
    if (suite.every(Boolean))
      push({
        name: `Suite ${s}${s === trump ? " d’atout" : ""}`,
        points: s === trump ? 250 : 150,
        cards: suite as Card[],
      });
  });

  /* 3. Dame ♠ + Valet ♦ */
  const qS = findOne("Q", "♠"),
    jD = findOne("J", "♦");
  if (qS && jD) push({ name: "Dame♠+Valet♦", points: 40, cards: [qS, jD] });

  return res;

  /* Helpers locaux */
  function groupBy(arr: Card[], k: keyof Card) {
    return arr.reduce<Record<string, Card[]>>(
      (m, c) => (m[c[k]]?.push(c) || (m[c[k]] = [c]), m),
      {}
    );
  }
  function findOne(rank: Rank, suit: Suit) {
    return hand
      .concat(meldCards)
      .find((c) => c.rank === rank && c.suit === suit);
  }
}
