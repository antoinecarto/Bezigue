<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h2 class="text-lg font-semibold mb-2">Choisissez une combinaison</h2>
      <ul class="space-y-2">
        <li v-for="combo in options" :key="combo.name">
          <button @click="choose(combo)" class="w-full bg-blue-100 hover:bg-blue-200 rounded p-2 text-left">
            <div class="flex justify-between">
              <span>{{ combo.name }}</span>
              <span class="text-sm text-gray-600">{{ combo.points }} pts</span>
            </div>
          </button>
        </li>
      </ul>
      <button class="close-btn" @click="$emit('close')">Annuler</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CardData } from '@/types' // ou où tu stockes tes types

interface Combination {
  name: string
  points: number
  cards: CardData[]
}

defineProps<{
  options: Combination[]
}>()

const emit = defineEmits<{
  (e: 'choose', combo: Combination): void
  (e: 'close'): void
}>()

function choose(combo: Combination) {
  emit('choose', combo)
}
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.popup-content {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.close-btn {
  margin-top: 1rem;
  background: #ddd;
  border: none;
  padding: 0.5rem 1rem;
  cursor: pointer;
}
</style>


<script setup lang="ts">
defineProps<{ options: Array<{ name: string; points: number; cards: Card[] }> }>()
const emit = defineEmits(['choose', 'close'])

function choose(combo: { name: string; points: number }) {
  emit('choose', combo)
}
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  top:0; left:0; right:0; bottom:0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.popup-content {
  background: white;
  padding: 1rem 2rem;
  border-radius: 8px;
}
.close-btn {
  margin-top: 1rem;
  background: #ddd;
  border: none;
  padding: 0.5rem 1rem;
  cursor: pointer;
}
</style>
