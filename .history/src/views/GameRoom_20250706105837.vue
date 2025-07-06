<!--
  GameRoom.vue – orchestrateur minimal (architecture Pinia + vues dédiées)
  =========================================================================
  • Ne contient plus de logique Firestore / DnD / rules.
  • Se contente dInitialiser le store `game` (joinRoom) et d’afficher
    les sous‑vues : MeldZone, PlayerHand, TrickZone (à ajouter si besoin).
-->
<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { useGameStore } from "@/stores/game";
import PlayerHand from "@/views/PlayerHand.vue";
import MeldZone from "@/views/MeldZone.vue";

const route = useRoute();
const game = useGameStore();

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

  <div v-else class="grid gap-4">
    <!-- Zone de score, d'échange, d'atout -->
    <CenterBoard />
    <!-- Zone des combinaisons / dépôt -->
    <MeldZone />

    <!-- Main du joueur (draggable + sortable) -->
    <PlayerHand />
  </div>
</template>

<style scoped>
/* Pas de règles spécifiques ici ; la mise en page se fait dans les sous‑vues. */
</style>

<!-- GameRoom.vue -->
<template>
  <section v-if="game.loading" class="flex items-center justify-center h-full">
    Chargement…
  </section>

  <div v-else class="grid gap-4">
    <CenterBoard />
    <!-- <- nouvelle zone centrale -->
    <MeldZone />
    <PlayerHand />
  </div>
</template>

<script setup lang="ts">
import CenterBoard from "@/views/components/CenterBoard.vue";
</script>
