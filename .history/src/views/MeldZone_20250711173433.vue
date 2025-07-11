<script setup lang="ts">
import { ref, computed, watch } from "vue";
import draggable from "vuedraggable";
import { useGameStore } from "@/stores/game";
import PlayingCard from "@/views/components/PlayingCard.vue";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

const props = defineProps<{ uid: string; readonly?: boolean }>();

/* ---------- état global ---------- */
const game = useGameStore();
const room = computed(() => game.room);
const isMine = computed(() => props.uid === game.myUid);

/* ---------- état local ---------- */
const pending = ref<string[]>([]); // cartes en attente dans la zone verte

/* ---------- combo popup ---------- */
const isComboPopupVisible = ref(false);
const availableCombos = ref([]);

/* ---------- actions ---------- */
const validating = ref(false);

async function finishMeldPhase() {
  if (!isMine.value || pending.value.length) return;
  if (!room.value) return;

  try {
    const roomRef = doc(db, "rooms", room.value.id);
    await updateDoc(roomRef, { phase: "draw" });
  } catch (err) {
    console.error("finishMeldPhase:", err);
  }
}

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

  <!-- bouton Terminer la pose (pioche) -->
  <button
    v-if="isMine && room?.phase === 'meld' && !pending.length"
    class="btn mt-4"
    @click="finishMeldPhase"
  >
    Terminer la pose
  </button>
</template>
