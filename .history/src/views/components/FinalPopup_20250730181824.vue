<script setup lang="ts">
import { defineProps, defineEmits } from "vue";

/* ① — les refs du store --------------------------------------------- */

const props = defineProps<{
  winner: string | null;
  loser: string | null;
  winnerScore: number | null;
  loserScore: number | null;
  isEqual: boolean | null;
}>();
const emit = defineEmits(["close"]);
const deOuD = (name: string): string =>
  /^[aeiouyàâäéèëêïîôöùûüh]/i.test(name.trim()) ? "d'" : "de ";

function close() {
  emit("close");
}
</script>

<template>
  <div
    v-if="props.winner"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
  >
    <div class="bg-white rounded p-6 text-center shadow-lg max-w-sm">
      <h2 class="text-xl font-bold mb-4">Fin de la partie !</h2>

      <template v-if="props.isEqual">
        <p class="mb-2">🤝 Match nul entre :</p>
        <p>
          <strong>{{ props.winner }}</strong> : {{ props.winnerScore }} pts
        </p>
        <p>
          <strong>{{ props.loser }}</strong> : {{ props.loserScore }} pts
        </p>
      </template>

      <template v-else>
        <p class="mb-2">
          🎉 Victoire {{ deOud }} <strong>{{ props.winner }}</strong> !
        </p>
        <p>
          <strong>{{ props.winner }}</strong> : {{ props.winnerScore }} pts
        </p>
        <p>
          <strong>{{ props.loser }}</strong> : {{ props.loserScore }} pts
        </p>
      </template>

      <button @click="close" class="btn-primary mt-6">Fermer</button>
    </div>
  </div>
</template>
