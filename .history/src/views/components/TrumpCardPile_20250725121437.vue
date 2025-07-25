<script setup lang="ts">
import { computed } from "vue";
import PlayingCard from "@/views/components/PlayingCard.vue";

const props = defineProps<{
  trump?: string;
  remaining?: number;
  game?: {
    drawCard: () => void;
    canDraw: () => boolean;
  };
}>();

// Fallback trump card
const trumpCard = computed(() => props.trump ?? "back");

// Bouton activé uniquement si canDraw existe et renvoie true
const canDraw = computed(() => props.game?.canDraw?.() ?? false);
</script>

<template>
  <div class="trump-card flex flex-col items-center">
    <PlayingCard :code="trumpCard" :width="80" :height="110" class="mb-1" />

    <button
      :disabled="!canDraw"
      @click="props.game?.drawCard?.()"
      class="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-40"
    >
      Piocher ({{ props.remaining ?? 0 }})
    </button>
  </div>
</template>

<style>
.trump-card {
  border: 6px solid black;
  border-radius: 8px;
  padding: 12px;
  margin: 16px;
  box-sizing: border-box;
  background: radial-gradient(circle at 30% 30%, #116d30 0%, #0c4f28 50%);
  display: inline-block;
}
</style>

<!-- <script setup lang="ts">
import { computed } from "vue";
import PlayingCard from "@/views/components/PlayingCard.vue";

const props = defineProps<{
  trump?: string;
  remaining?: number;
  game?: {
    drawCard: () => void;
    canDraw: () => boolean;
  };
}>();

// Affiche le dos si plus de carte à piocher
const shouldShowBack = computed(() => props.remaining === 0);

// Fallback trump card
const trumpCard = computed(() => props.trump ?? "back");

const displayCardCode = computed(() =>
  shouldShowBack.value ? "back" : trumpCard.value
);
// Bouton activé uniquement si canDraw existe et renvoie true
const canDraw = computed(() => props.game?.canDraw?.() ?? false);
</script>

<template>
  <div class="trump-card flex flex-col items-center">
    <PlayingCard
      :code="displayCardCode"
      :width="80"
      :height="110"
      class="mb-1"
    />

    <button
      :disabled="!canDraw"
      @click="props.game?.drawCard?.()"
      class="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-40"
    >
      Piocher ({{ props.remaining ?? 0 }})
    </button>
  </div>
</template>

<style>
.trump-card {
  border: 6px solid black;
  border-radius: 8px;
  padding: 12px;
  margin: 16px;
  box-sizing: border-box;
  background: radial-gradient(circle at 30% 30%, #116d30 0%, #0c4f28 50%);
  display: inline-block;
}
</style> -->
