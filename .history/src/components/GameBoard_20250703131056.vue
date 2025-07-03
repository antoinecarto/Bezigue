<template>
  <div class="flex flex-col h-screen bg-green-700 text-white p-4">
    <!-- Zone de capture des points -->
    <div class="flex justify-center mb-4">
      <CaptureZone :player="1" :plis="player1Plis" />
      <CaptureZone :player="2" :plis="player2Plis" />
    </div>

    <!-- Zone de jeu centrale -->
    <div class="flex justify-center mb-4">
      <TrickZone :playedCards="currentTrick" />
    </div>

    <!-- Main du joueur -->
    <div class="p-4">
      <h2 class="text-2xl font-bold mb-4">Votre main</h2>
      <PlayerHand :cards="myHand" @playCard="handlePlayCard" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import PlayerHand from "./PlayerHand.vue";
import TrickZone from "./TrickZone.vue";
import CaptureZone from "./CaptureZone.vue";

type Suit = "♦" | "♣" | "♠" | "♥";

interface CardData {
  rank: string;
  suit: Suit;
}

// Exemple de plis des joueurs (cartes capturées)
const player1Plis = ref<CardData[]>([
  { rank: "A", suit: "♦" },
  { rank: "10", suit: "♣" },
]);
const player2Plis = ref<CardData[]>([
  { rank: "Q", suit: "♠" },
  { rank: "K", suit: "♥" },
]);

// Exemple de cartes jouées dans le pli en cours
const currentTrick = ref<CardData[]>([
  { rank: "Q", suit: "♥" },
  { rank: "K", suit: "♠" },
]);

// Main du joueur
const myHand = ref<CardData[]>([
  { rank: "A", suit: "♠" },
  { rank: "10", suit: "♣" },
  { rank: "K", suit: "♥" },
  { rank: "J", suit: "♦" },
  { rank: "Q", suit: "♠" },
  { rank: "9", suit: "♥" },
  { rank: "A", suit: "♣" },
  { rank: "7", suit: "♦" },
]);

// Handler quand une carte est jouée depuis PlayerHand
function handlePlayCard(card: CardData) {
  // Ajoute la carte au pli en cours
  currentTrick.value.push(card);

  // Retire la carte de la main du joueur (uniquement la première occurrence)
  const index = myHand.value.findIndex(
    (c) => c.rank === card.rank && c.suit === card.suit
  );
  if (index !== -1) myHand.value.splice(index, 1);
}
</script>
