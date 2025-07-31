<!-- src/App.vue -->
<template>
  <router-view />
  <FinalPopup
    v-if="game.room?.phase === 'final'"
    :winner="winnerName"
    :winnerScore="winnerScore"
    :loser="isEqual ? names?.[uid2] : loserName"
    :loserScore="loserScore"
    :isEqual="isEqual"
    @close="onCloseFinalPopup"
  />
</template>

<script setup lang="ts"></script>
