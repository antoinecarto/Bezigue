export function svgIdFr(cardCode: string): string {
  if (cardCode === "back") return "back";
  if (!cardCode || cardCode === "—") {
    throw new Error(`Format de carte non reconnu: ${cardCode}`);
  }

  const rankMap = {
    as: "1",
    "10": "10",
    roi: "king",
    dame: "queen",
    valet: "jack",
    "9": "9",
    "8": "8",
    "7": "7",
  } as const;

  const suitMap = {
    pique: "spade",
    coeur: "heart",
    carreau: "diamond",
    trefle: "club",
  } as const;

  // 🧼 Normalisation : accents, espaces, minuscules
  let cleaned = cardCode
    .normalize("NFD") // décompose les accents
    .replace(/[\u0300-\u036f]/g, "") // supprime les accents
    .toLowerCase() // passe en minuscules
    .replace(/\s+/g, " ") // réduit les espaces multiples
    .trim(); // supprime les espaces de début/fin

  // 🎯 Regex souple sur les noms français
  const rgx =
    /(as|10|roi|dame|valet|9|8|7)\s+(?:de|d[’'])\s+(pique|coeur|carreau|trefle)/i;

  const match = cleaned.match(rgx);
  if (!match) {
    throw new Error(`Format de carte non reconnu: ${cardCode}`);
  }

  const [, rankRaw, suitRaw] = match;

  const rank = rankMap[rankRaw as keyof typeof rankMap];
  const suit = suitMap[suitRaw as keyof typeof suitMap];

  if (!rank || !suit) {
    throw new Error(`Rang ou couleur invalide: ${rankRaw}, ${suitRaw}`);
  }

  return `${suit}_${rank}`;
}
