import type { Suit } from "@/game/models/Card";
import { ref } from "vue";

export interface RoomDoc {
  players: string[];
  playerNames: Record<string, string>;
  phase: "waiting" | "play" | "draw" | "meld" | "battle" | "finished";
  currentTurn: string;
  drawQueue: string[];
  trumpCard: string;
  deck: string[];
  hands: Record<string, string[]>;
  melds: Record<string, string[]>;
  scores: Record<string, number>;
  trick: { cards: string[]; players: string[] };
  trumpSuit: Suit;
  exchangeTable: Record<string, string>;
  reservedHands?: Record<string, string[]>;
}

// type local qui inclut l’id
export type RoomState = RoomDoc & { id: string };

// ref Vue
export const room = ref<RoomState | null>(null);
