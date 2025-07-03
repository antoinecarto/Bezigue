// utils/toFrenchName.ts
export function toFrenchName(code: string): string {
  const rankMap: Record<string, string> = {
    "7": "7",
    "8": "8",
    "9": "9",
    J: "Valet",
    Q: "Dame",
    K: "Roi",
    "10": "10",
    A: "As",
  };
  const suitMap: Record<string, string> = {
    S: "Pique",
    H: "Cœur",
    D: "Carreau",
    C: "Trèfle",
  };
  const rank = code.startsWith("10") ? "10" : code[0];
  const suit = code.slice(-1);
  return `${rankMap[rank]} de ${suitMap[suit]}`;
}
