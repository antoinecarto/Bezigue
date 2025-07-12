<!--
  GameRoom.vue – orchestrateur minimal (architecture Pinia + vues dédiées)
  =========================================================================
  • Ne contient plus de logique Firestore / DnD / rules.
  • Se contente dInitialiser le store `game` (joinRoom) et d’afficher
    les sous‑vues : MeldZone, PlayerHand, TrickZone (à ajouter si besoin).
-->
<script setup lang="ts">
import { onMounted, onUnmounted, computed } from "vue";
import { storeToRefs } from "pinia"; // ← ①
import { useRoute } from "vue-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { Unsubscribe } from "firebase/firestore";
import { updateDoc, doc } from "firebase/firestore";

import { useGameStore } from "@/stores/game";
import PlayerHand from "@/views/PlayerHand.vue";
import MeldZone from "@/views/MeldZone.vue";
import CenterBoard from "@/views/components/CenterBoard.vue";
import GameChat from "./GameChat.vue";

const route = useRoute();
const game = useGameStore();
/* ① — les refs du store --------------------------------------------- */
const { myUid, room, loading } = storeToRefs(game); // <- myUid et room sont VRAIS refs

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
/* 6 — opponentMeld ---------------------------------------------- */

const opponentMeld = computed(() => {
  if (!opponentUid.value || !room.value) return [];
  return room.value.melds?.[opponentUid.value] ?? [];
});
/* 7 — myMeld ---------------------------------------------- */

const myMeld = computed(() => {
  if (!myUid.value || !room.value) return [];
  return room.value.melds?.[myUid.value] ?? [];
});

/* ⑥ — gestion du cycle de vie -------------------------------------- */
let unsubscribeRoom: Unsubscribe | null = null;

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
  });

  onUnmounted(() => {
    stopAuth();
    unsubscribeRoom?.();
  });
});

/* fonction de mise à jour dans Firestore */
async function updateMelds(uid: string, newCards: string[]) {
  if (!room.value) return;
  const roomRef = doc(db, "rooms", room.value.id);
  try {
    await updateDoc(roomRef, {
      [`melds.${uid}`]: newCards,
    });
  } catch (error) {
    console.error("Erreur mise à jour melds Firestore:", error);
  }
}
</script>

<template>
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
      :cards="opponentMeld"
    />
    <!-- plateau central -->
    <CenterBoard />

    <!-- Meld du joueur (interactive) -->
    <MeldZone v-if="myUid" :uid="myUid" :cards="myMeld" />

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
</template>

<style scoped>
.hand-status-top {
}

.hand-status-bottom {
}
</style>
