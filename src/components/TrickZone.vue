<template>
  <div
    class="flex items-center justify-center gap-4 bg-green-900 p-5 rounded-md min-h-[90px] w-full max-w-3xl shadow-inner border border-green-600"
  >
    <div v-for="(card, index) in cards" :key="index" class="shadow-lg rounded-md">
      <Card :rank="card.rank" :suit="card.suit" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Card from './Card.vue'
import type { CardData } from '@/types'

const props = defineProps<{ cards: CardData[] }>()
</script>
