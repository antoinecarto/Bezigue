<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game.ts";
import draggable from "vuedraggable";
import PlayingCard from "@/views/components/PlayingCard.vue";

const props = defineProps<{ isOpponent: boolean }>();
const game = useGameStore();

/* ── UID ciblé ───────────────────── */
const uid = computed(() => {
  if (!game.room) return null;
  return props.isOpponent
    ? game.room.players.find((u) => u !== game.myUid) ?? null
    : game.myUid;
});

/* ── Liste réactive (vraie ref) ──── */
const meldArea = computed({
  get() {
    return uid.value ? game.getMeldArea(uid.value).value : [];
  },
  set(newVal: string[]) {
    // Permet à draggable de pousser les changements
    if (uid.value) game.updateMeldArea(uid.value, newVal);
  },
});

/* ── Drag terminé ────────────────── */
function onEnd() {
  // tu peux déclencher la persistance dans Firestore ici
}
</script>

<template>
  <div class="meld-zone">
    <!-- ⚠️ utilise :list au lieu de v-model si tu ne veux pas que draggable modifie directement -->
    <draggable
      v-model="meldArea"
      :group="{ name: 'cards', pull: true, put: false }"
      :disabled="props.isOpponent"
    >
      item-key="code"
      <!-- clé unique si tu en as une -->
      class="flex gap-2 flex-wrap" @end="onEnd" >
      <template #item="{ element }">
        <PlayingCard :code="element" :width="60" :height="90" />
      </template>
    </draggable>

    <p v-if="meldArea.length === 0" class="text-gray-400 italic text-sm">
      Aucune carte
    </p>
  </div>
</template>

<style scoped>
.meld-zone {
  min-height: 100px;
  border: 2px dashed #96a1b4;
  padding: 8px;
  border-radius: 6px;
}
</style>
