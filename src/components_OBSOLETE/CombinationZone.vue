<template>
  <div class="combination-zone border border-gray-400 w-full h-24 rounded-md p-2 flex gap-4 overflow-x-auto">
    <div
      v-for="combo in playedCombinations"
      :key="combo.name + combo.cards.map(c => c.suit + c.rank).join('')"
      class="combo-card cursor-pointer p-2 border rounded"
      @click="$emit('playCombination', combo)"
      :title="combo.name + ' — ' + combo.points + ' pts'"
    >
      <strong>{{ combo.name }}</strong>
      <div class="cards flex gap-1 mt-1">
        <span v-for="card in combo.cards" :key="card.suit + card.rank" class="card">
          {{ card.rank }}{{ card.suit }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ playedCombinations: Array<any> }>()
const emit = defineEmits(['playCombination'])
</script>

<style scoped>
.combo-card {
  background: #f9f9f9;
}
.card {
  font-weight: bold;
  padding: 0 4px;
}
</style>
