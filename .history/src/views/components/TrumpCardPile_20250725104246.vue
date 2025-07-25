<script setup lang="ts">
import PlayingCard from "@/views/components/PlayingCard.vue";
import { computed } from "vue";

const props = defineProps<{
  trump: string;
  remaining: number;
  game: {
    drawCard: () => void;
    canDraw: () => boolean;
  };
}>();

const shouldShowBack = computed(() => props.remaining === 0);
</script>

<template>
  <div class="trump-card flex flex-col items-center">
    <PlayingCard
      :code="shouldShowBack ? 'back' : props.trump"
      :width="80"
      :height="110"
      class="mb-1"
    />

    <button
      :disabled="!props.game.canDraw()"
      @click="props.game.drawCard"
      class="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-40"
    >
      Piocher ({{ props.remaining }})
    </button>
  </div>
</template>
