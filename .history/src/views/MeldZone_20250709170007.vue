<script setup lang="ts">
import { ref, computed, watch } from "vue";
import draggable from "vuedraggable";
import { useGameStore } from "@/stores/game";
import PlayingCard from "@/views/components/PlayingCard.vue";
import { doc, updateDoc } from "firebase/firestore"; // ← ici
import { db } from "@/services/firebase";

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
const validating = ref(false);

async function validateCards() {
  if (!pending.value.length || !isMine.value || validating.value) return;

  validating.value = true;
  const toValidate = [...pending.value];
  pending.value = []; // vide la zone verte : la carte restera via meld

  for (const code of toValidate) {
    try {
      await game.addToMeld(props.uid, code); // séquentiel → plus d’erreur « removed »
    } catch (e) {
      console.error(e);
      pending.value.push(code); // rollback local si Firestore refuse
    }
  }

  validating.value = false;
}

/* ---------- actions ---------- */
async function finishMeldPhase() {
  // 1.  Seul le joueur maître, sans cartes en attente, peut finir
  if (!isMine.value || pending.value.length) return;
  if (!room.value) return;

  try {
    /* 2.  On passe la room en phase "draw" : la pioche s'ouvrira
          (drawQueue a déjà été préparée dans playCard). */
    const roomRef = doc(db, "rooms", room.value.id);
    await updateDoc(roomRef, { phase: "draw" });
  } catch (err) {
    console.error("finishMeldPhase:", err);
  }
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
  <draggable
    v-model="pending"
    :item-key="(c) => c"
    class="meld-zone flex flex-wrap gap-1 bg-green-200/60 border-2 border-green-500 rounded-md p-2 min-h-[110px]"
    :group="{
      name: 'cards',
      put: !props.readonly,
      /* accepte si non readonly */ pull: false,
    }"
    :sort="false"
    :disabled="props.readonly"
  >
    <template #item="{ element }">
      <PlayingCard :code="element" :key="element" />
    </template>
  </draggable>

  <!-- bouton Valider -->
  <button
    v-if="pending.length && isMine && room?.phase === 'meld'"
    class="btn mt-2"
    @click="validateCards"
  >
    Valider les cartes
  </button>

  <!-- bouton Terminer la pose (pioche) -->
  <button
    v-if="isMine && room?.phase === 'meld' && !pending.length"
    class="btn mt-4"
    @click="finishMeldPhase"
  >
    Terminer la pose
  </button>
</template>
