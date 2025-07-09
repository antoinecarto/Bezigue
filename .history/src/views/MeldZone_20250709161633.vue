<script setup lang="ts">
import { ref, computed, watch } from "vue";
import draggable from "vuedraggable";
import { useGameStore } from "@/stores/game";
import PlayingCard from "@/views/components/PlayingCard.vue";

const props = defineProps<{ uid: string; readonly?: boolean }>();

/* ---------- état global ---------- */
const game = useGameStore();
const room = computed(() => game.room);
const isMine = computed(() => props.uid === game.myUid);

/* ---------- état local ---------- */
const pending = ref<string[]>([]); // ← obligatoire
const meld = computed(() => game.getMeld(props.uid));
const meldDraft = computed(() => [...meld.value, ...pending.value]);

/* ---------- actions ---------- */
async function validateCards() {
  if (!pending.value.length || !isMine.value) return;
  for (const code of [...pending.value]) {
    await game.addToMeld(props.uid, code);
  }
  pending.value = []; // on vide
}

/* ---------- UI helpers ---------- */
const canValidate = computed(
  () =>
    isMine.value &&
    room.value?.phase === "meld" &&
    room.value.currentTurn === game.myUid &&
    pending.value.length > 0
);

/* ---------- reset en changeant de phase ---------- */
watch(
  () => room.value?.phase,
  (phase) => {
    if (phase !== "meld") pending.value = [];
  }
);
</script>

<template>
  <!-- Zone verte : LISTE CIBLE = pending -->
  <draggable v-model="pending" <!-- ★ -->
    :item-key="c => c" class="meld-zone flex flex-wrap gap-1 bg-green-200/60
    border-2 border-green-500 rounded-md p-2 min-h-[110px]" :group="{ name:
    'cards', put : !props.readonly, /* accepte si non readonly */ pull: false }"
    :sort="false" :disabled="props.readonly" >
    <template #item="{ element }">
      <PlayingCard :code="element" :key="element" />
    </template>
  </draggable>

  <!-- Bouton Valider (seulement pour le propriétaire) -->
  <button v-if="canValidate" class="btn mt-2" @click="validateCards">
    Valider les cartes
  </button>
</template>
