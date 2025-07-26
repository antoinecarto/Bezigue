<script setup lang="ts">
import { useGameStore } from "@/stores/game";
import { watch } from "vue";

const game = useGameStore();

const isHost = game.myUid === game.room?.players[0]; // simple règle
const options = [1000, 2000];

function updateTarget(e: Event) {
  const value = Number((e.target as HTMLSelectElement).value);

  game.setTargetScore(value); // action Pinia
}
watch(
  () => game.room,
  (room) => {
    if (room?.targetScore !== undefined) {
      game.setTargetScore(room.targetScore);
    }
  },
  { immediate: true }
);
</script>

<template>
  <label class="flex flex-col items-start gap-1 text-white">
    <!-- première ligne -->
    <span>Partie en :</span>

    <!-- ligne du sélecteur -->
    <select
      :value="game.targetScore"
      @change="updateTarget"
      :disabled="!isHost || game.room?.phase !== 'waiting'"
      class="border px-2 py-1 rounded bg-green-900/30"
    >
      <option v-for="opt in options" :key="opt" :value="opt">
        {{ opt }} pts
      </option>
    </select>
  </label>
</template>
