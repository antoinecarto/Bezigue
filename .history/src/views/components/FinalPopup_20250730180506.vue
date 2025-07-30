<script setup lang="ts">
import { defineProps, defineEmits } from "vue";

const props = defineProps<{
  winner: string | null;
  loser: string | null;
  winnerSore: number | null;
  loserScore: number | null;
}>();
const emit = defineEmits(["close"]);

function close() {
  emit("close");
}
</script>

<template>
  <div
    v-if="props.winner"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
  >
    <div class="bg-white rounded p-6 text-center shadow-lg max-w-sm">
      <h2 class="text-xl font-bold mb-4">Fin de la partie !</h2>
      <p class="mb-6">
        🎉 Le gagnant est <strong>{{ winner }}</strong> ! 🎉
      </p>
      <button @click="close" class="btn-primary">Fermer</button>
    </div>
  </div>
</template>
