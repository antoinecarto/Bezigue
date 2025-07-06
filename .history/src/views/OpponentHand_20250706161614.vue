<template>
  <div class="opponent-hand flex gap-2 justify-center">
    <img
      v-for="(card, index) in cards"
      :key="index"
      src="/back.svg"
      alt="Carte dos"
      class="w-14 h-20"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  cards: string[];
}>();
</script>

<style scoped>
.opponent-hand img {
  cursor: default;
  user-select: none;
}
</style>
