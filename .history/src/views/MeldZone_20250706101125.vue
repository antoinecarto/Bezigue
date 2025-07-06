<script setup>
import { useGameStore } from "@/stores/game";

const game = useGameStore();
const { setNodeRef, isOver } = useDroppable({ id: "MELD_ZONE" });
</script>

<template>
  <div ref="setNodeRef" :class="['drop-zone', isOver && 'bg-blue-50']">
    <template v-if="game.meldArea.length">
      <PlayingCard
        v-for="c in game.meldArea"
        :key="c"
        :code="c"
        width="60"
        height="90"
      />
    </template>
    <span v-else>Aucune</span>
  </div>
</template>
