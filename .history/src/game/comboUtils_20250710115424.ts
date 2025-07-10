type ComboType =
  | "mariage"
  | "suite"
  | "quatreAs"
  | "quatreRois"
  | "quatreDames"
  | "quatreValets"
  | "bezigue"
  | "doubleBezigue";

export interface Combo {
  type: ComboType;
  cards: string[];
  points: number;
}

export function detectCombosInMeld(
  meldCards: string[],
  meldTags: Record<string, string[]>
): Combo[] {
  const combos: Combo[] = [];

  // --- Helpers simplifiés (à compléter) ---
  function getColor(card: string): string {
    return card.substring(0, 2);
  } // ex: "QS"
  function getRank(card: string): string {
    return card.substring(2, 3);
  } // ex: "_1" ignoré ici, on pourrait l'améliorer
  function isAtout(color: string): boolean {
    return color === "CO" /* ex: carreau atout */;
  } // à ajuster

  // Helper pour filtrer cartes déjà taguées avec combo donnée
  function isCardAvailable(card: string, comboTag: string): boolean {
    return !meldTags[card]?.includes(comboTag);
  }

  // 1) Mariage (Roi + Dame même couleur)
  const colors = ["PI", "CA", "CO", "TR"]; // pique, carreau, coeur, trèfle
  for (const color of colors) {
    // cartes disponibles pour mariage
    const roi = meldCards.find(
      (c) =>
        getColor(c) === color &&
        c.includes("K") &&
        isCardAvailable(c, "mariage")
    );
    const dame = meldCards.find(
      (c) =>
        getColor(c) === color &&
        c.includes("D") &&
        isCardAvailable(c, "mariage")
    );
    if (roi && dame) {
      combos.push({
        type: "mariage",
        cards: [roi, dame],
        points: isAtout(color) ? 40 : 20,
      });
    }
  }

  // 2) Suite (As, 10, Roi, Dame, Valet même couleur)
  // Simplifié, la vraie logique doit checker la présence des 5 rangs
  const ranksSuite = ["A", "10", "K", "D", "J"];
  for (const color of colors) {
    const suiteCards = ranksSuite.map((rank) =>
      meldCards.find(
        (c) =>
          getColor(c) === color &&
          c.includes(rank) &&
          isCardAvailable(c, "suite")
      )
    );
    if (suiteCards.every((c) => c !== undefined)) {
      combos.push({
        type: "suite",
        cards: suiteCards as string[],
        points: isAtout(color) ? 250 : 150,
      });
    }
  }

  // 3) 4 cartes identiques (4 As, 4 Rois, 4 Dames, 4 Valets)
  const ranksQuatre = ["A", "K", "D", "J"];
  for (const rank of ranksQuatre) {
    const cardsOfRank = meldCards.filter(
      (c) => c.includes(rank) && isCardAvailable(c, `quatre${rank}s`)
    );
    if (cardsOfRank.length === 4) {
      combos.push({
        type: `quatre${rank}s` as ComboType,
        cards: cardsOfRank,
        points: { A: 100, K: 80, D: 60, J: 40 }[rank] || 0,
      });
    }
  }

  // 4) Bézigue (Dame pique + Valet carreau)
  const damesPique = meldCards.filter(
    (c) => c.startsWith("DP") && isCardAvailable(c, "bezigue")
  );
  const valetsCarreau = meldCards.filter(
    (c) => c.startsWith("JC") && isCardAvailable(c, "bezigue")
  );
  if (damesPique.length >= 1 && valetsCarreau.length >= 1) {
    combos.push({
      type: "bezigue",
      cards: [damesPique[0], valetsCarreau[0]],
      points: 40,
    });
    // 5) Double bézigue (deux dames pique + deux valets carreau)
    if (damesPique.length >= 2 && valetsCarreau.length >= 2) {
      combos.push({
        type: "doubleBezigue",
        cards: [
          damesPique[0],
          damesPique[1],
          valetsCarreau[0],
          valetsCarreau[1],
        ],
        points: 500,
      });
    }
  }

  return combos;
}
