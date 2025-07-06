import type { Suit } from "@/game/models/Card";
import type { Combination } from "@/core/rules/detectCombinations";

export interface RoomDoc {
  players: string[];
  playerNames: Record<string, string>;
  phase: "waiting" | "play" | "draw" | "meld" | "battle" | "finished";
  currentTurn: string;
  drawQueue: string[];
  trumpCard: string;
  deck: string[];
  hands: Record<string, string[]>;
  melds: Record<string, Combination[]>;
  scores: Record<string, number>;
  trick: { cards: string[]; players: string[] };
  trumpSuit: Suit;
}
