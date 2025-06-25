<script setup lang="ts">
interface CardData {
  suit: string
  rank: string
}

interface Meld {
  cards: CardData[]
  points: number
}

const props = defineProps<{
  player: number
  melds: Meld[]
  score: number
}>()
</script>

<template>
  <div
    class="flex flex-col items-center w-full p-2 border border-blue-400 rounded-xl shadow-sm bg-gray-50 h-24 overflow-auto"
  >
    <!-- Titre Combinaisons -->
    <div class="text-blue-600 text-xs font-semibold mb-1">
      Combinaisons
    </div>

    <!-- Liste des combinaisons -->
    <div class="flex flex-wrap justify-center gap-2 w-full">
      <div
        v-for="(meld, mIndex) in melds"
        :key="`meld-${player}-${mIndex}`"
        class="flex items-center space-x-1 p-1 border rounded bg-white shadow-sm"
      >
        <Card
          v-for="(card, cIndex) in meld.cards"
          :key="`card-${player}-${mIndex}-${cIndex}`"
          :rank="card.rank"
          :suit="card.suit"
          :small="true"
        />
        <span class="text-xs text-gray-400 ml-2">{{ meld.points }} pts</span>
      </div>
    </div>
  </div>
</template>



<style scoped>
/* Pour forcer la hauteur à 6rem (24px * 6) */
.h-24 {
  height: 6rem;
}
</style>

