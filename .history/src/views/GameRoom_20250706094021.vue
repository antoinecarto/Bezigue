<!--
  GameRoomRefactored.vue
  =====================
  Salle de Bézigue (2 joueurs) : logique temps‑réel, drag‑and‑drop,
  chat, score.  
  ✨ Refactor : code compact, commenté, organisé en 7 sections.
-->
<script setup lang="ts">
/* =====================================================================
 * 1. IMPORTS & CONSTANTES
 * ===================================================================*/
import {
  ref,
  computed,
  reactive,
  watchEffect,
  onMounted,
  onUnmounted,
} from "vue";
import { useRoute } from "vue-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  runTransaction,
  onSnapshot,
  updateDoc,
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useDroppable, useDraggable } from "@vue-dnd-kit/core";

import { Card, type Suit } from "@/game/types/Card";
import { generateShuffledDeck, distributeCards } from "@/game/BezigueGame";
import {
  detectCombinations,
  type Combination,
} from "@/core/rules/detectCombinations";
import { cardToStr } from "@/game/types/Card";
import PlayingCard from "@/components/PlayingCard.vue";

/* =====================================================================
 * 2. RÉACTIVE STATE
 * ===================================================================*/
const route = useRoute();
const db = getFirestore();
const roomRef = doc(db, "rooms", route.params.roomId as string);

const myUid = ref<string | null>(null);
const room = ref<RoomDoc | null>(null);
const loading = ref(true);
const { setNodeRef } = useDroppable({ id: "zone-id" });

// UI flags regroupés dans un objet réactif
const ui = reactive({
  nameModal: false,
  comboModal: false,
  exchange: false,
});

// Cartes & melds locaux
const localHand = ref<string[]>([]);
const meldAreaCards = ref<string[]>([]);
const validCombos = ref<Combination[]>([]);

/* =====================================================================
 * 3. FIRESTORE / AUTH LISTENERS
 * ===================================================================*/
let roomUnsub: (() => void) | null = null;

function subscribeRoom(uid: string) {
  return onSnapshot(roomRef, (snap) => {
    loading.value = false;
    if (!snap.exists()) {
      room.value = null;
      return;
    }

    const data = snap.data() as RoomDoc;
    room.value = data;
    localHand.value = data.hands?.[uid] ?? [];
    ui.nameModal = !data.playerNames?.[uid];
  });
}

onMounted(() => {
  const auth = getAuth();
  const stopAuth = onAuthStateChanged(auth, (user) => {
    myUid.value = user?.uid ?? null;
    roomUnsub?.(); // nettoie ancienne sub
    if (myUid.value) roomUnsub = subscribeRoom(myUid.value);
    else loading.value = false;
  });
  onUnmounted(() => {
    stopAuth();
    roomUnsub?.();
  });
});

/* =====================================================================
 * 4. WATCHERS
 * ===================================================================*/
// Ouvre la popup meld dès qu’une combinaison est possible
watchEffect(() => {
  const r = room.value;
  const uid = myUid.value;
  if (!r || !uid || r.phase !== "meld" || r.canMeld !== uid) return;

  const combos = detectCombinations(
    r.hands[uid].map(Card.fromCode),
    (r.melds?.[uid] ?? []).flatMap((m) => m.cards.map(Card.fromCode)),
    r.trumpSuit
  );
  if (combos.length) {
    validCombos.value = combos;
    ui.comboModal = true;
  }
});

/* =====================================================================
 * 5. DRAG‑AND‑DROP HELPERS
 * ===================================================================*/
function useCardDnD(code: string) {
  return useDraggable({ id: code, data: { code } });
}

const { elementRef: meldZoneRef, isOver } = useDroppable({
  id: "MELD_ZONE",
  events: {
    onDrop({ items }) {
      const code = items[0].data.code;
      const idx = localHand.value.indexOf(code);
      if (idx !== -1) {
        localHand.value.splice(idx, 1);
        meldAreaCards.value.push(code);
      }
      const best = detectCombinations(
        meldAreaCards.value.map(Card.fromCode),
        [],
        trumpSuit.value
      )[0];
      if (best) validCombos.value.push(best); // historique local
    },
  },
});

/* =====================================================================
 * 6. FONCTIONS MÉTIER (extraits)
 * ===================================================================*/
async function playCardFromHand(code: string) {
  if (!myUid.value) return;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const d = snap.data() as RoomDoc;
    if (d.currentTurn !== myUid.value) throw "Pas votre tour";

    const hand = [...d.hands[myUid.value]];
    hand.splice(hand.indexOf(code), 1);

    const trick = {
      cards: [...d.trick.cards, code],
      players: [...d.trick.players, myUid.value!],
    };
    tx.update(roomRef, { [`hands.${myUid.value}`]: hand, trick });
  });
}

/* =====================================================================
 * 7. COMPUTED SHORTCUTS & FORMATTING
 * ===================================================================*/
const trumpCard = computed(() => room.value?.trumpCard ?? "");
const trumpSuit = computed(() => trumpCard.value.slice(-1));

/* ---------------------------------------------------------------------
 *  Types Firestore (simplifiés)
 * ------------------------------------------------------------------*/
interface RoomDoc {
  players: string[];
  playerNames: Record<string, string>;
  phase: "waiting" | "play" | "draw" | "meld" | "battle" | "finished";
  currentTurn: string;
  drawQueue: string[];
  trumpCard: string;
  deck: string[];
  hands: Record<string, string[]>;
  melds: Record<string, Combination[]>;
  scores: Record<string, number>;
  trick: { cards: string[]; players: string[] };
  trumpSuit: Suit;
}

interface ChatMsg {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
}
</script>

<template>
  <section v-if="loading" class="flex items-center justify-center h-full">
    Chargement…
  </section>

  <div v-else>
    <!-- Zone meld droppable -->
    <div
      ref="meldZoneRef"
      class="drop-zone min-h-[160px] border-2 border-dashed rounded p-4 flex gap-2 overflow-x-auto overflow-y-hidden"
      :class="
        isOver ? 'border-blue-400 bg-blue-50' : 'border-green-400 bg-green-50'
      "
    >
      <p class="text-xs font-semibold mb-1 mr-2">Vos combinaisons</p>
      <PlayingCard
        v-for="c in meldAreaCards"
        :key="c"
        :code="c"
        :width="60"
        :height="90"
      />
      <span
        v-if="!meldAreaCards.length"
        class="text-[10px] italic text-gray-400"
        >Aucune</span
      >
    </div>

    <!-- Main du joueur (sortable) -->
    <SortableContext :items="localHand">
      <div
        class="cards flex gap-2 flex-wrap justify-center mt-4 overflow-x-auto overflow-y-hidden"
      >
        <template v-for="code in localHand" :key="code">
          <DraggableCard :code="code" @click="playCardFromHand(code)" />
        </template>
      </div>
    </SortableContext>
  </div>
</template>

<style scoped>
.drop-zone {
  user-select: none;
}
.cards {
  min-width: 60px;
  min-height: 90px;
}
</style>
