<script setup lang="ts">
import { ref, computed } from "vue";
import { doc, runTransaction, updateDoc } from "@firebase/firestore";
import { useGameStore } from "@/stores/game";
import {
  detectCombinations,
  type Combination,
} from "@/core/rules/detectCombinations";
import { db } from "@/services/firebase";
import type { RoomDoc } from "@/types/firestore";

const game = useGameStore();
const room = computed(() => game.room);
const myUid = computed(() => game.myUid);

const hand = computed(() => game.hand);
const meld = computed(() => game.getMeld(myUid.value!));
const already = computed(() => game.getCombos(myUid.value!));

/* liste affichée après clic « Valider la pose » */
const proposals = ref<Combination[]>([]);

const canValidate = computed(
  () =>
    room.value?.phase === "meld" &&
    room.value.currentTurn === myUid.value &&
    meld.value.length > 0
);

function computeProposals() {
  if (!room.value) return;

  proposals.value = detectCombinations(
    hand.value,
    meld.value,
    room.value.trumpSuit,
    already.value // combos déjà validées → elles bloquent leurs cartes
  );
}

async function confirmCombo(combo: Combination) {
  if (!room.value || !myUid.value) return;

  const roomRef = doc(db, "rooms", room.value.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const d = snap.data() as RoomDoc;

    const prev = d.combos?.[myUid.value] ?? [];
    if (prev.some((c) => c.name === combo.name)) return; // déjà posée

    tx.update(roomRef, {
      [`combos.${myUid.value}`]: [...prev, combo],
      [`scores.${myUid.value}`]: (d.scores?.[myUid.value] ?? 0) + combo.points,
    });
  });

  // retire la ligne de la liste locale
  proposals.value = proposals.value.filter((c) => c.name !== combo.name);
}

async function finishMeldPhase() {
  if (!room.value) return;
  const roomRef = doc(db, "rooms", room.value.id);
  await updateDoc(roomRef, { phase: "draw" });
  proposals.value = []; // on ferme la liste locale
}
</script>

<template>
  <div class="meld-zone">
    <Card v-for="c in meld" :key="c.code" :code="c.code" />

    <!-- Bouton de validation -->
    <button v-if="canValidate" class="btn mt-2" @click="computeProposals">
      Valider la pose
    </button>

    <!-- Liste des combinaisons proposées -->
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

    <!-- Bouton pour finir la phase meld -->
    <button
      v-if="room?.phase === 'meld' && room.currentTurn === myUid"
      class="btn mt-4"
      @click="finishMeldPhase"
    >
      Terminer la pose
    </button>
  </div>
</template>

<style scoped>
.meld-zone {
  min-height: 90px; /* hauteur au moins égale à la hauteur de la carte */
  background-color: #0b5e1e; /* couleur tapis vert foncé */
  color: white;
  position: relative;
}

.empty-message {
  font-size: 1rem;
  font-weight: bold;
  user-select: none;
}
</style>
