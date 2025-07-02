import { Combination } from "./rules";

export function scoreCombos(existing: number, added: Combination[]): number {
  return existing + added.reduce((s, c) => s + c.points, 0);
}

export function scorePli(
  winner: string,
  trick: string[],
  scores: Record<string, number>
): Record<string, number> {
  if (trick.some((c) => c.startsWith("10") || c.startsWith("A")))
    scores = { ...scores, [winner]: (scores[winner] ?? 0) + 10 };
  return scores;
}
