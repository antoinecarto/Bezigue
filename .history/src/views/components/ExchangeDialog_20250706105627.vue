<script setup lang="ts">
import { useGameStore } from "@/stores/game";

const game = useGameStore();

function confirm() {
  game.confirmExchange();
} // action Pinia
function cancel() {
  game.cancelExchange();
}
</script>

<template>
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center">
    <div class="bg-white p-6 rounded-lg shadow-xl text-center">
      <p class="mb-4">Échanger votre <strong>7 d’atout</strong> ?</p>
      <div class="flex gap-4 justify-center">
        <button
          class="bg-green-600 text-white px-4 py-2 rounded"
          @click="confirm"
        >
          Échanger
        </button>
        <button
          class="bg-gray-400 text-white px-4 py-2 rounded"
          @click="cancel"
        >
          Plus tard
        </button>
      </div>
    </div>
  </div>
</template>
