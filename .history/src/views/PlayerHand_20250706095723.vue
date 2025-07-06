<script setup>
import { SortableContext } from "@vue-dnd-kit/core";
import { useGameStore } from "@/stores/game";
import DraggableCard from "./DraggableCard.vue";

const game = useGameStore();
</script>

<template>
  <SortableContext :items="game.hand">
    <div class="flex flex-wrap gap-2">
      <DraggableCard
        v-for="c in game.hand"
        :key="c"
        :code="c"
        @click="game.playCard(c)"
      />
    </div>
  </SortableContext>
</template>
