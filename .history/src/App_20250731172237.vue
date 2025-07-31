<!-- src/App.vue -->
<template>
  <router-view />
  <FinalPopup
    :winner="'Test'"
    :winnerScore="42"
    :loser="'Test2'"
    :loserScore="24"
    :isEqual="false"
    @close="() => console.log('Popup fermée')"
  />
</template>

<script setup lang="ts"></script>
