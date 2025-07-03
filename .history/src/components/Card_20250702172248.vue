<script setup lang="ts">
type Suit = "♦" | "♣" | "♠" | "♥";

interface Props {
  rank: string; // "7", "8", ... "10", "jack", "queen", "king", "ace"
  suit: Suit;
}

const { rank, suit } = defineProps<Props>();

// Mapper la couleur Unicode vers l'id SVG du fichier source
const suitMap: Record<Suit, string> = {
  "♦": "diamond",
  "♣": "club",
  "♠": "spade",
  "♥": "heart",
};

// Mapper les rangs pour correspondre aux id SVG
// selon ton readme, les nombres sont "1" à "10" et figures "jack", "queen", "king", "ace"
const rankMap: Record<string, string> = {
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  jack: "jack",
  queen: "queen",
  king: "king",
  ace: "1", // l'as est "1" dans le fichier SVG
};

// Ex: id de la carte = `${rankMap[rank]}_${suitMap[suit]}`
const cardId = `${rankMap[rank]}_${suitMap[suit]}`;
</script>

<template>
  <svg
    class="card"
    width="80"
    height="120"
    viewBox="0 0 80 120"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0"
      y="0"
      width="80"
      height="120"
      rx="12"
      ry="12"
      fill="white"
      stroke="gray"
      stroke-width="2"
    />
    <!-- Utilisation de la carte via <use> pointant vers le SVG complet dans public -->
    <use
      :href="`/svg-cards-2.0.svg#${cardId}`"
      x="10"
      y="10"
      width="60"
      height="100"
    />
  </svg>
</template>

<style scoped>
.card {
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
  border-radius: 12px;
}
.card:hover {
  transform: scale(1.1);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.35);
}
</style>
