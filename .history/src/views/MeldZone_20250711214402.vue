<script setup lang="ts">
import { ref, computed, watch } from "vue";
import draggable from "vuedraggable";
import { useGameStore } from "@/stores/game";
import PlayingCard from "@/views/components/PlayingCard.vue";

const props = defineProps<{ uid: string; readonly?: boolean }>();

/* ---------- état local ---------- */
const pending = ref<string[]>([]); // cartes en attente dans la zone verte

/* ---------- reset en changeant de phase ---------- */
</script>

<template>
  <!-- Zone verte : LISTE CIBLE = pending -->
  <draggable
    v-model="pending"
    :item-key="(c) => c"
    class="meld-zone flex flex-wrap gap-1 bg-green-200/60 border-2 border-green-500 rounded-md p-2 min-h-[110px]"
    :group="{
      name: 'cards',
      put: !props.readonly,
      pull: false,
    }"
    :sort="false"
    :disabled="props.readonly"
  >
    <template #item="{ element }">
      <PlayingCard :code="element" :key="element" />
    </template>
  </draggable>
</template>
