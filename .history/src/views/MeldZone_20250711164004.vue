<script setup lang="ts">
import { ref, computed, watch } from "vue";
import draggable from "vuedraggable";
import { useGameStore } from "@/stores/game";
import PlayingCard from "@/views/components/PlayingCard.vue";
import ComboChoicePopup from "@/views/components/ComboChoicePopup.vue"; // popup combo
import { detectCombosInMeld, type Combo } from "@/game/comboUtils"; // détection combos
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

const props = defineProps<{ uid: string; readonly?: boolean }>();

/* ---------- état global ---------- */
const game = useGameStore();
const room = computed(() => game.room);
const isMine = computed(() => props.uid === game.myUid);

/* ---------- état local ---------- */
const pending = ref<string[]>([]); // cartes en attente dans la zone verte
const meld = computed(() => game.getMeld(props.uid));
const meldDraft = computed(() => [...meld.value, ...pending.value]);

/* ---------- combo popup ---------- */
const isComboPopupVisible = ref(false);
const availableCombos = ref([]);

/* ---------- actions ---------- */
const validating = ref(false);

async function validateCards() {
  if (!pending.value.length || !isMine.value || validating.value) return;

  validating.value = true;
  const toValidate = [...pending.value];
  pending.value = []; // vide la zone verte

  // Ajouter cartes dans le meld (existant)
  for (const code of toValidate) {
    try {
      await game.addToMeld(props.uid, code);
    } catch (e) {
      console.error(e);
      pending.value.push(code); // rollback local si Firestore refuse
      validating.value = false;
      return;
    }
  }

  const meldTags = game.getMeldTags(props.uid);
  const combos = detectCombosInMeld(meldDraft.value, meldTags);

  // Détecter combos après ajout dans meld
  if (combos.length > 0) {
    availableCombos.value = combos;
    isComboPopupVisible.value = true;
  }

  validating.value = false;
}

// async function onComboSelected(combo) {
//   try {
//     await applyCombo(room.value.id, props.uid, combo);
//   } catch (e) {
//     console.error("Erreur application combo", e);
//   }
//   isComboPopupVisible.value = false;
// }

// function onComboPass() {
//   isComboPopupVisible.value = false;
// }

// async function finishMeldPhase() {
//   if (!isMine.value || pending.value.length) return;
//   if (!room.value) return;

//   try {
//     const roomRef = doc(db, "rooms", room.value.id);
//     await updateDoc(roomRef, { phase: "draw" });
//   } catch (err) {
//     console.error("finishMeldPhase:", err);
//   }
// }

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
      pull: false,
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
    :disabled="validating"
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

  <!-- Popup de choix de combos -->
  <ComboChoicePopup
    v-if="isComboPopupVisible"
    :combos="availableCombos"
    @select="onComboSelected"
    @pass="onComboPass"
  />
</template>
