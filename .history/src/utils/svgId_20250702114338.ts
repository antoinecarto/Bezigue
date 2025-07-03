export function svgId(nomFr: string): string {
  const rankMap = {
    As: "1",
    "10": "10",
    Roi: "king",
    Dame: "queen",
    Valet: "jack",
    "9": "9",
    "8": "8",
    "7": "7",
  } as const;

  const suitMap = {
    Pique: "spade",
    Cœur: "heart",
    Coeur: "heart", // alternative sans œ
    Carreau: "diamond",
    Trèfle: "club",
    Trefle: "club", // alternative sans accent
  } as const;

  // nettoyage basique
  nomFr = nomFr.trim().replace(/\s+/g, " ");

  const rgx =
    /(As|10|Roi|Dame|Valet|9|8|7)\s+(?:de|d[’'])\s+(Pique|C(?:œur|oeur)|Carreau|T(?:rèfle|refle))/i;

  const match = nomFr.match(rgx);
  if (!match) throw new Error(`Format de carte non reconnu: ${nomFr}`);

  const [, rang, couleur] = match;
  return `${suitMap[couleur as keyof typeof suitMap]}_${
    rankMap[rang as keyof typeof rankMap]
  }`;
}
