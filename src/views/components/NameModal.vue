<template>
  <div class="fixed inset-0 grid place-items-center bg-black/60">
    <div class="bg-white rounded-lg p-6 w-72">
      <h2 class="text-lg font-semibold mb-4">Votre nom</h2>
      <input
        v-model="localName"
        type="text"
        class="w-full border px-2 py-1 rounded mb-4"
        placeholder="Entrez votre nom"
      />
      <button
        @click="$emit('confirm', localName.trim())"
        class="w-full bg-green-600 text-white py-1 rounded disabled:opacity-50"
        :disabled="!localName.trim()"
      >
        OK
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
const localName = ref("");
</script>
