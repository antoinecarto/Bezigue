<script setup lang="ts">
import draggable from "vuedraggable";
import { ref, computed, watch } from "vue";
import { doc, runTransaction, updateDoc } from "firebase/firestore";
import { useGameStore } from "@/stores/game";
import {
  detectCombinations,
  type Combination,
} from "@/core/rules/detectCombinations";
import { db } from "@/services/firebase";
import type { RoomDoc } from "@/types/firestore";
import PlayingCard from "@/views/components/PlayingCard.vue";

/* --- props ------------------------------------------------------------ */
interface Props {
  uid: string; // propriétaire de la zone
  readonly?: boolean; // true = zone passive (adversaire)
}
const props = defineProps<Props>();

/* --- store & états ---------------------------------------------------- */
const game = useGameStore();
const room = computed(() => game.room);
const myUid = computed(() => game.myUid);
const isMine = computed(() => props.uid === myUid.value);
const readOnly = computed(() => props.readonly || !isMine.value);

const hand = computed(() => game.hand); // ma main
const meld = computed(() => game.getMeld(props.uid)); // cartes déjà posées
const already = computed(() => game.getCombos(props.uid)); // combos déjà validés

/* cartes qu’on vient de faire glisser (pas encore confirmées) */
const pending = ref<string[]>([]);
const meldDraft = computed(() => [...meld.value, ...pending.value]);

/* --- logique de validation ------------------------------------------- */
const proposals = ref<Combination[]>([]);
function computeProposals() {
  if (!room.value || !isMine.value) return;
  proposals.value = detectCombinations(
    hand.value,
    meldDraft.value,
    room.value.trumpSuit as any,
    already.value
  );
}

function onAdd(evt: any) {
  if (readOnly.value) return;
  const code: string = evt.item.__draggable_context.element;
  if (!pending.value.includes(code)) pending.value.push(code);
}

async function validateCards() {
  if (!isMine.value) return;
  for (const code of pending.value) {
    await game.addToMeld(myUid.value!, code);
  }
  pending.value = [];
  computeProposals();
}

async function confirmCombo(combo: Combination) {
  if (!room.value || !isMine.value) return;
  const roomRef = doc(db, "rooms", room.value.id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const d = snap.data() as RoomDoc;

    const prev = d.combos?.[myUid.value!] ?? [];
    const duplicate = prev.some(
      (c: any) => c.name === combo.name && c.suit === (combo as any).suit
    );
    if (duplicate) return;

    const pts = Number((combo as any).points) || 0;

    tx.update(roomRef, {
      [`combos.${myUid.value}`]: [...prev, combo],
      [`scores.${myUid.value}`]: (d.scores?.[myUid.value] ?? 0) + pts,
    });
  });

  proposals.value = proposals.value.filter(
    (c) => !(c.name === combo.name && (c as any).suit === (combo as any).suit)
  );
}

async function finishMeldPhase() {
  if (!room.value || !isMine.value) return;
  await updateDoc(doc(db, "rooms", room.value.id), { phase: "draw" });
  proposals.value = [];
}

/* --- réaffiche automatiquement la pop‑up quand on entre en phase meld */
watch(
  () => room.value?.phase,
  (phase) => {
    if (phase === "meld" && isMine.value) computeProposals();
    else proposals.value = [];
  },
  { immediate: true }
);

/* --- boutons ---------------------------------------------------------- */
const canValidate = computed(
  () =>
    !readOnly.value &&
    room.value?.phase === "meld" &&
    room.value.currentTurn === myUid.value &&
    pending.value.length > 0
);
</script>

<template>
  <div
    class="meld-wrapper bg-green-200/60 border-2 border-green-500 rounded-md p-2 min-h-[112px] flex flex-wrap gap-1"
  >
    <!-- Zone drag‑and‑drop -->
    <draggable
      :list="pending"
      :item-key="(c) => c"
      class="meld-zone"
      :group="{ name: 'cards', put: true, pull: false }"
      :sort="false"
    >
      <template #item="{ element }">
        <PlayingCard :code="element" :key="element" />
      </template>
    </draggable>
  </div>

  <!-- Boutons interactifs (uniquement pour ma zone) -->
  <template v-if="isMine && !readOnly">
    <button v-if="canValidate" class="btn mt-2" @click="validateCards">
      Valider les cartes
    </button>

    <button
      v-if="!canValidate && meldDraft.length > 0"
      class="btn mt-2"
      @click="computeProposals"
    >
      Voir les combinaisons possibles
    </button>

    <ul v-if="proposals.length" class="mt-2 space-y-1">
      <li
        v-for="combo in proposals"
        :key="combo.name + (combo as any).suit"
        class="flex justify-between"
      >
        <span>{{ combo.name }} ({{ combo.points }} pts)</span>
        <button class="btn" @click="confirmCombo(combo)">Poser</button>
      </li>
    </ul>

    <button
      v-if="room?.phase === 'meld' && room.currentTurn === myUid"
      class="btn mt-4"
      @click="finishMeldPhase"
    >
      Terminer la pose
    </button>
  </template>
</template>

<style scoped>
.meld-wrapper {
  /* garde le fond même lorsqu’il n’y a aucune carte */
}
</style>
