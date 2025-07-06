<script setup lang="ts">
import { useGameStore } from "@/stores/game";

const game = useGameStore();
const isHost = game.myUid === game.room?.players[0]; // simple règle
const options = [1000, 2000];

function updateTarget(e: Event) {
  const value = Number((e.target as HTMLSelectElement).value);
  game.setTargetScore(value); // action Pinia
}
</script>

<template>
  <label class="flex items-center gap-2">
    Score cible :
    <select
      :value="game.room?.targetScore"
      @change="updateTarget"
      :disabled="!isHost || game.room?.phase !== 'waiting'"
      class="border px-2 py-1 rounded"
    >
      <option v-for="opt in options" :key="opt" :value="opt">
        {{ opt }} pts
      </option>
    </select>
  </label>
</template>
