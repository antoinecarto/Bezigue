export function svgIdFr(cardCode: string): string {
  if (cardCode === "back") return "back"; // id exact du dos de carte dans ton sprite

  if (!cardCode || cardCode === "—") {
    throw new Error(`Format de carte non reconnu: ${cardCode}`);
  }

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
    pique: "spade",
    cœur: "heart",
    coeur: "heart",
    carreau: "diamond",
    trèfle: "club",
    trefle: "club",
  } as const;

  const nomFr = cardCode.trim().replace(/\s+/g, " ");

  const rgx =
    /(As|10|Roi|Dame|Valet|9|8|7)\s+(?:de|d[’'])\s+(Pique|C(?:œur|oeur)|Carreau|T(?:rèfle|refle))/i;

  const match = nomFr.match(rgx);
  if (!match) throw new Error(`Format de carte non reconnu: ${nomFr}`);

  const [, rang, couleurRaw] = match;
  const couleur = couleurRaw.toLowerCase() as keyof typeof suitMap;

  return `${suitMap[couleur]}_${rankMap[rang as keyof typeof rankMap]}`;
}
