// utils/svgIdFr.ts
export function svgIdFr(nomFr: string): string {
  const rankMap: Record<string, string> = {
    As: "1",
    "10": "10",
    Roi: "king",
    Dame: "queen",
    Valet: "jack",
    "9": "9",
    "8": "8",
    "7": "7",
  };

  const suitMap: Record<string, string> = {
    Pique: "spade",
    Cœur: "heart",
    Carreau: "diamond",
    Trèfle: "club",
  };

  const match = nomFr.match(
    /(As|10|Roi|Dame|Valet|9|8|7) de (Pique|Cœur|Carreau|Trèfle)/i
  );
  if (!match) throw new Error(`Format de carte non reconnu: ${nomFr}`);

  const [, rang, couleur] = match;
  return `${suitMap[couleur]}_${rankMap[rang]}`;
}
