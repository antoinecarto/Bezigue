<script setup lang="ts">
import draggable from "vuedraggable";
import { ref, computed } from "vue";
import { doc, runTransaction, updateDoc } from "firebase/firestore";
import { useGameStore } from "@/stores/game";
import {
  detectCombinations,
  type Combination,
} from "@/core/rules/detectCombinations";
import { db } from "@/services/firebase";
import type { RoomDoc } from "@/types/firestore";
import PlayingCard from "@/views/components/PlayingCard.vue";

const game = useGameStore();
const room = computed(() => game.room);
const myUid = computed(() => game.myUid);

const hand = computed(() => game.hand); // string codes
const meld = computed(() => game.getMeld(myUid.value!));
const already = computed(() => game.getCombos(myUid.value!));

const pending = ref<string[]>([]); // cartes posées localement en attente de validation

// Le draft est la combinaison de la pose déjà validée + la pose en cours (pending)
const meldDraft = computed(() => [...meld.value, ...pending.value]);

const canValidate = computed(() => {
  return (
    room.value?.phase === "meld" &&
    room.value.currentTurn === myUid.value &&
    pending.value.length > 0
  );
});

const proposals = ref<Combination[]>([]);

function computeProposals() {
  if (!room.value) return;
  proposals.value = detectCombinations(
    hand.value,
    meldDraft.value,
    room.value.trumpSuit as any,
    already.value
  );
}

function onAdd(evt: any) {
  const code: string = evt.item.__draggable_context.element;
  if (!pending.value.includes(code)) {
    pending.value.push(code);
  }
}

async function validateCards() {
  if (!myUid.value) return;
  for (const code of pending.value) {
    await game.addToMeld(myUid.value, code);
  }
  pending.value = [];
  computeProposals();
}

async function confirmCombo(combo: Combination) {
  if (!room.value || !myUid.value) return;
  const roomRef = doc(db, "rooms", room.value.id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const d = snap.data() as RoomDoc;

    const prev = d.combos?.[myUid.value] ?? [];
    if (prev.some((c) => c.name === combo.name)) return;

    tx.update(roomRef, {
      [`combos.${myUid.value}`]: [...prev, combo],
      [`scores.${myUid.value}`]: (d.scores?.[myUid.value] ?? 0) + combo.points,
    });
  });

  proposals.value = proposals.value.filter((c) => c.name !== combo.name);
}

async function finishMeldPhase() {
  if (!room.value) return;
  const roomRef = doc(db, "rooms", room.value.id);
  await updateDoc(roomRef, { phase: "draw" });
  proposals.value = [];
}
</script>

<template>
  <draggable
    v-model="meldDraft"
    :item-key="(c) => c"
    class="meld-zone"
    :group="{ name: 'cards', put: true, pull: false }"
    :sort="false"
    @add="onAdd"
  >
    <template #item="{ element }">
      <PlayingCard
        :code="element"
        :key="element"
        @click="() => $emit('cardClick', element)"
      />
    </template>
  </draggable>

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
      :key="combo.name"
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
