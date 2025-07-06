<!--
  GameRoom.vue – orchestrateur minimal (architecture Pinia + vues dédiées)
  =========================================================================
  • Ne contient plus de logique Firestore / DnD / rules.
  • Se contente dInitialiser le store `game` (joinRoom) et d’afficher
    les sous‑vues : MeldZone, PlayerHand, TrickZone (à ajouter si besoin).
-->
<script setup lang="ts">
import { onMounted, onUnmounted, computed } from "vue";
import { useRoute } from "vue-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { useGameStore } from "@/stores/game.ts";
import PlayerHand from "@/views/PlayerHand.vue";
import MeldZone from "@/views/MeldZone.vue";
import CenterBoard from "@/views/components/CenterBoard.vue";
import GameChat from "./GameChat.vue";

const route = useRoute();
const game = useGameStore();
const myUid = computed(() => game.myUid);
const room = computed(() => game.room);

const opponentUid = computed(() => {
  if (!room.value || !myUid.value) return null;
  return (
    Object.keys(room.value.playerNames).find((uid) => uid !== myUid.value) ??
    null
  );
});

const opponentName = computed(() => {
  if (!room.value || !opponentUid.value) return "Adversaire";
  return room.value.playerNames[opponentUid.value] ?? "Adversaire";
});

const isOpponentTurn = computed(() => {
  if (!room.value || !myUid.value || !room.value.currentTurn) return false;
  return room.value.currentTurn === opponentUid.value;
});

/* libellé complet */
const mainOpponentLabel = computed(
  () => `${game.deOuD(opponentName.value)}${opponentName.value}`
);

let unsubscribeRoom: (() => void) | null = null;

onMounted(() => {
  const auth = getAuth();
  const stopAuth = onAuthStateChanged(auth, (user) => {
    if (!user) return; // non connecté
    // (re)joint la room et écoute Firestore via le store
    unsubscribeRoom?.();
    unsubscribeRoom = game.joinRoom(route.params.roomId as string, user.uid);
  });

  onUnmounted(() => {
    stopAuth();
    unsubscribeRoom?.();
  });
});
</script>

<template>
  <section v-if="game.loading" class="flex items-center justify-center h-full">
    Chargement…
  </section>

  <div v-else class="grid gap-4 min-h-[600px]">
    <!-- *** ZONE STATUT MAIN DE L'ADVERSAIRE EN HAUT *** -->
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

    <!-- Zone des combinaisons / dépôt de l'adversaire -->
    <MeldZone :meld="player2Melds" :isOpponent="true" />

    <!-- Zone de score, d'échange, d'atout -->
    <CenterBoard />

    <!-- Zone des combinaisons / dépôt du joueur -->
    <MeldZone :meld="player1Melds" :isOpponent="false" />

    <!-- Main du joueur (draggable + sortable) -->
    <PlayerHand />

    <!-- *** ZONE STATUT DE VOTRE MAIN EN BAS *** -->
    <div
      class="hand-status-bottom flex justify-start px-8 py-4 border-t border-gray-600 mt-6"
    >
      <div
        :class="{
          'text-green-500': isOpponentTurn,
          'text-red-500': !isOpponentTurn,
        }"
        class="font-semibold"
      >
        Votre main
      </div>
    </div>

    <GameChat class="mt-4" />
  </div>
</template>

<style scoped>
.hand-status-top {
  background: #1a1a1a; /* fond sombre */
  border-radius: 0 0 8px 8px;
}

.hand-status-bottom {
  background: #1a1a1a; /* fond sombre */
  border-radius: 8px 8px 0 0;
}
</style>
