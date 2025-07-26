<!--
  GameRoom.vue – orchestrateur minimal (architecture Pinia + vues dédiées)
  =========================================================================
  • Ne contient plus de logique Firestore / DnD / rules.
  • Se contente dInitialiser le store `game` (joinRoom) et d’afficher
    les sous‑vues : MeldZone, PlayerHand, TrickZone (à ajouter si besoin).
-->
<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from "vue";
import { storeToRefs } from "pinia"; // ← ①
import { useRoute } from "vue-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { Unsubscribe } from "firebase/firestore";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/services/firebase";

import { useGameStore } from "@/stores/game";
import PlayerHand from "@/views/PlayerHand.vue";
import MeldZone from "@/views/MeldZone.vue";
import CenterBoard from "@/views/components/CenterBoard.vue";
import GameChat from "./GameChat.vue";
import VoiceChat from "@/views/components/VoiceChat.vue";
import Exchange7Dialog from "@/views/components/Exchange7Dialog.vue";
import { startNewMene } from "@/stores/game";
import FinalPopup from "@/views/components/FinalPopup.vue";

const isHost = ref(true); // ou false selon le joueur
const route = useRoute();
const game = useGameStore();
/* ① — les refs du store --------------------------------------------- */
const { myUid, room, loading, melds } = storeToRefs(game); // <- myUid et room sont VRAIS refs

const roomId = computed(() => room.value?.id ?? "");
const phase = computed(() => room.value?.phase ?? "waiting");

/* ② — uid de l’adversaire ------------------------------------------- */
const opponentUid = computed(() => {
  if (!room.value || !myUid.value) return "";
  return room.value.players.find((u) => u !== myUid.value) ?? "";
});

/* ③ — nom de l’adversaire (optionnel) ------------------------------- */
const opponentName = computed(() => {
  if (!room.value || !opponentUid.value) return "Adversaire";
  return room.value.playerNames[opponentUid.value] ?? "Adversaire";
});

/* ④ — tour de l’adversaire ? ---------------------------------------- */
const isOpponentTurn = computed(() => {
  if (!room.value || !room.value.currentTurn) return false;
  return room.value.currentTurn === opponentUid.value;
});

/* ⑤ — libellé complet ---------------------------------------------- */
const mainOpponentLabel = computed(() =>
  opponentUid.value
    ? `${game.deOuD(opponentName.value)}${opponentName.value}`
    : ""
);

const winnerName = computed(() => {
  if (!game.room?.scores) return "";
  const scores = game.room.scores;
  const playerIds = Object.keys(scores);
  if (scores[playerIds[0]] > scores[playerIds[1]])
    return game.room.playerNames[playerIds[0]];
  else if (scores[playerIds[1]] > scores[playerIds[0]])
    return game.room.playerNames[playerIds[1]];
  else return "Égalité";
});

// const opponentMeld = computed(() => {
//   if (!room.value || !opponentUid.value) return [];
//   return room.value.melds?.[opponentUid.value] ?? [];
// });
/* ⑥ — gestion du cycle de vie -------------------------------------- */
let unsubscribeRoom: Unsubscribe | null = null;

defineProps(["roomId"]);

onMounted(() => {
  const auth = getAuth();
  const stopAuth = onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    unsubscribeRoom?.();
    unsubscribeRoom = await game.joinRoom(
      route.params.roomId as string,
      user.uid,
      localStorage.getItem("playerName") ?? ""
    );
    console.log("opponent melds ???? : ", melds[opponentUid]);
  });

  onUnmounted(() => {
    stopAuth();
    unsubscribeRoom?.();
  });
});

function onCloseFinalPopup() {
  // Retour à la page d'accueil.
  window.location.href = "https://app-bezigue.web.app/";
}

function updateMeldAdd(uid: string, card: string) {
  // Appelle ton store pour ajouter la carte dans Firestore
  game.addToMeld(uid, card).catch(console.error);
}

function updateMeldRemove(uid: string, card: string) {
  // Appelle ton store pour retirer la carte dans Firestore
  game.removeFromMeld(uid, card).catch(console.error);
}

const showMenePopup = ref(false);
const meneNumber = ref(0);

onMounted(async () => {
  const newIndex = await startNewMene(roomId.value);
  meneNumber.value = newIndex;
  showMenePopup.value = true;

  setTimeout(() => {
    showMenePopup.value = false;
  }, 2000);
});
</script>

<template>
  <Exchange7Dialog v-if="game.showExchange" />
  <div v-if="showMenePopup" class="popup">
    Début de la mène {{ meneNumber }}
  </div>
  <FinalPopup
    v-if="game.room?.phase === 'final'"
    :winner="winnerName"
    @close="onCloseFinalPopup"
  />

  <!-- écran de chargement -->
  <section v-if="loading" class="flex items-center justify-center h-full">
    Chargement…
  </section>

  <!-- table de jeu -->
  <div v-else class="grid gap-4 min-h-[600px]">
    <!-- statut main adversaire -->
    <div
      class="hand-status-top flex justify-end px-8 py-2 border-b border-gray-600"
    >
      <div
        :class="{
          'text-green-500': isOpponentTurn,
          'text-red-500': !isOpponentTurn,
        }"
        class="font-semibold"
      >
        Main {{ mainOpponentLabel }}
      </div>
    </div>

    <!-- Meld adverse (lecture seule) -->
    <MeldZone
      v-if="opponentUid"
      :uid="opponentUid"
      :readonly="true"
      :cards="melds[opponentUid] ?? []"
    />

    <!-- plateau central -->
    <CenterBoard />

    <!-- Meld du joueur (interactive) -->
    <MeldZone
      v-if="myUid"
      :uid="myUid"
      :cards="melds[myUid] ?? []"
      @addToMeld="(uid, card) => updateMeldAdd(uid, card)"
      @removeFromMeld="(uid, card) => updateMeldRemove(uid, card)"
    />

    <!-- main du joueur -->
    <PlayerHand />

    <!-- statut main joueur -->
    <div
      class="hand-status-bottom flex justify-start px-8 py-4 border-t border-gray-600 mt-6"
    >
      <div
        :class="{
          'text-green-500': !isOpponentTurn,
          'text-red-500': isOpponentTurn,
        }"
        class="font-semibold"
      >
        Votre main
      </div>
    </div>

    <!-- chat -->
    <GameChat class="mt-4" />
  </div>
  <div>
    <h2>Room #{{ roomId }}</h2>
    <VoiceChat :roomId="roomId" :isCaller="isHost" />
  </div>
  <button v-if="phase === 'finished'" @click="startNewMene(roomId)">
    Lancer la prochaine mène
  </button>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  /* styles visuels pour les toasts */
}
.toast {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem 1rem;
  margin-bottom: 0.5rem;
  border-radius: 0.25rem;
}
.popup {
  position: fixed;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  background: #f5f5f5;
  padding: 1rem 2rem;
  border: 2px solid #333;
  border-radius: 8px;
  font-size: 1.5rem;
  z-index: 1000;
  animation: fadeOut 2s forwards;
}

@keyframes fadeOut {
  0% {
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
