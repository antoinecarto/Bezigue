<script setup lang="ts">
import { ref, computed } from "vue";
import { doc, runTransaction, updateDoc } from "firebase/firestore";
import { useGameStore } from "@/stores/game";
import {
  detectCombinations,
  type Combination,
} from "@/core/rules/detectCombinations";
import { db } from "@/services/firebase";
import type { RoomDoc } from "@/types/firestore";
// import Card from "@/components/Card.vue"; // composant d'affichage d'une carte

/* --------------------------------------------------------------
   État et dérivés réactifs
----------------------------------------------------------------*/
const game = useGameStore();
const room = computed(() => game.room);
const myUid = computed(() => game.myUid);

const hand = computed(() => game.hand); // codes string
const meld = computed(() => game.getMeld(myUid.value!));
const already = computed(() => game.getCombos(myUid.value!));

/* Liste de propositions après clic "Valider la pose" */
const proposals = ref<Combination[]>([]);

const canValidate = computed(
  () =>
    room.value?.phase === "meld" &&
    room.value.currentTurn === myUid.value &&
    meld.value.length > 0
);

/* --------------------------------------------------------------
   Calcul des combinaisons possibles à partir de la pose actuelle
----------------------------------------------------------------*/
function computeProposals() {
  if (!room.value) return;
  proposals.value = detectCombinations(
    hand.value,
    meld.value,
    room.value.trumpSuit as any,
    already.value
  );
}

/* --------------------------------------------------------------
   Validation d'une combinaison choisie par l'utilisateur
----------------------------------------------------------------*/
async function confirmCombo(combo: Combination) {
  if (!room.value || !myUid.value) return;
  const roomRef = doc(db, "rooms", room.value.id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const d = snap.data() as RoomDoc;

    const prev = d.combos?.[myUid.value] ?? [];
    if (prev.some((c) => c.name === combo.name)) return; // déjà validée

    tx.update(roomRef, {
      [`combos.${myUid.value}`]: [...prev, combo],
      [`scores.${myUid.value}`]: (d.scores?.[myUid.value] ?? 0) + combo.points,
    });
  });

  // retire localement la combinaison validée
  proposals.value = proposals.value.filter((c) => c.name !== combo.name);
}

/* --------------------------------------------------------------
   Fin de la phase meld (même si aucune combo posée)
----------------------------------------------------------------*/
async function finishMeldPhase() {
  if (!room.value) return;
  const roomRef = doc(db, "rooms", room.value.id);
  await updateDoc(roomRef, { phase: "draw" });
  proposals.value = [];
}
</script>

<template>
  <div class="meld-zone">
    <!-- cartes déjà déposées dans la zone meld -->
    <Card v-for="code in meld" :key="code" :code="code" />

    <!-- bouton : affiche la liste des combinaisons possibles -->
    <button v-if="canValidate" class="btn mt-2" @click="computeProposals">
      Valider la pose
    </button>

    <!-- liste des combinaisons détectées -->
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

    <!-- fin de phase meld -->
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
  min-height: 90px;
  background-color: #0b5e1e; /* tapis vert foncé */
  color: white;
  padding: 0.5rem;
  border-radius: 0.25rem;
}

.btn {
  @apply px-3 py-1 bg-amber-500 hover:bg-amber-600 rounded text-white text-sm;
}
</style>
