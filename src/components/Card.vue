<script setup lang="ts">
type Suit = "♦" | "♣" | "♠" | "♥";

interface Props {
  rank: string;
  suit: Suit;
}

const { rank, suit } = defineProps<Props>();
</script>

<template>
  <div
    class="card font-bold text-2xl w-12 h-16 flex items-center justify-center rounded-md border border-gray-400 select-none"
  >
    <span
      :class="{
        'text-red-600': suit === '♦' || suit === '♥',
        'text-black': suit === '♣' || suit === '♠'
      }"
    >
      {{ rank }}{{ suit }}
    </span>
  </div>
</template>

<style scoped>
.card {
  background-color: white;
  box-shadow: 0 4px 8px rgba(0,0,0,0.25);
  user-select: none;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.card:hover {
  transform: scale(1.1);
  box-shadow: 0 8px 15px rgba(0,0,0,0.35);
}
</style>




