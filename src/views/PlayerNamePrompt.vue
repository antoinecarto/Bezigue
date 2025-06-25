<!-- components/PlayerNamePrompt.vue -->
<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded shadow max-w-sm w-full">
      <h2 class="text-lg font-bold mb-4">Entrez votre nom</h2>
      <input v-model="name" class="border px-3 py-2 w-full" placeholder="Votre nom" />
      <div class="mt-4 text-right">
        <button class="btn" :disabled="!name.trim()" @click="confirm">Valider</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['confirmed'])
const name = ref('')

const confirm = () => {
  emit('confirmed', name.value.trim())
}
</script>
