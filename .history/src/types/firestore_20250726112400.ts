import type { Suit } from "@/game/models/Card";
import { ref } from "vue";
// import type { Combination } from "@/game/BezigueGame.ts";
import type { Combination } from "@/core/rules/detectCombinations";

export interface RoomDoc {
  players: string[];
  playerNames: Record<string, string>;
  phase: "waiting" | "play" | "battle" | "finished" | "final";
  currentTurn: string;
  drawQueue: string[];
  trumpCard: string;
  drawPile: string[];
  deck: string[];
  hands: Record<string, string[]>;
  melds: Record<string, string[]>;
  scores: Record<string, number>;
  trick: { cards: string[]; players: string[] };
  trumpSuit: Suit;
  exchangeTable: Record<string, string>;
  reservedHands?: Record<string, string[]>;
  combos?: Record<string, Combination[]>; // ex. combos["uid1"] = [{name, points, cards}]
  targetScore: number;
  currentMeneIndex: number;
  trickWinner?: string;
}

// type local qui inclut l’id
export type RoomState = RoomDoc & { id: string };

// ref Vue
export const room = ref<RoomState | null>(null);
