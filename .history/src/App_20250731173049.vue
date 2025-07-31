<!-- src/App.vue -->
<template>
  <router-view />
  <FinalPopup
    v-if="true"
    :winner="'Alice'"
    :winnerScore="100"
    :loser="'Bob'"
    :loserScore="90"
    :isEqual="false"
  />
</template>

<script setup lang="ts"></script>
