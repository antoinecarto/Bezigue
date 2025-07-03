export function svgIdFr(cardCode: string): string {
  if (cardCode === "back") return "back";
  if (!cardCode || cardCode === "—") return "unknown";

  // Map rang anglais vers nom court pour le sprite
  const rankMap = {
    A: "1",
    "10": "10",
    K: "king",
    Q: "queen",
    J: "jack",
    9: "9",
    8: "8",
    7: "7",
  };

  // Map symbole vers nom anglais de la couleur
  const suitMap = {
    "♠": "spade",
    "♥": "heart",
    "♦": "diamond",
    "♣": "club",
  };

  // Pour carte comme "Q♠"
  const rank = cardCode.length === 3 ? "10" : cardCode[0]; // ex: "10♠" → "10", "Q♠" → "Q"
  const suit = cardCode.slice(-1); // dernier caractère

  if (!(rank in rankMap) || !(suit in suitMap)) {
    throw new Error(`Format de carte non reconnu: ${cardCode}`);
  }

  return `${suitMap[suit]}_${rankMap[rank]}`;
}
