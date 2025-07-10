<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal-content">
      <h3>Choisissez une combinaison à valider</h3>
      <ul>
        <li v-for="combo in combos" :key="combo.id">
          <button @click="selectCombo(combo)">
            {{ comboLabel(combo) }} — {{ comboPoints(combo) }} pts
          </button>
        </li>
      </ul>
      <button @click="pass">Passer</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineEmits, defineProps } from "vue";

interface Combo {
  id: string;
  type: string;
  cards: string[];
  points: number;
}

const props = defineProps<{
  combos: Combo[];
}>();

const emit = defineEmits<{
  (e: "select", combo: Combo): void;
  (e: "pass"): void;
}>();

function selectCombo(combo: Combo) {
  emit("select", combo);
}

function pass() {
  emit("pass");
}

function comboLabel(combo: Combo): string {
  // Par exemple, traduire le type de combo
  switch (combo.type) {
    case "marriage":
      return "Mariage";
    case "sequence":
      return "Suite";
    case "four_of_a_kind":
      return "Carré";
    case "bezigue":
      return "Bézigue";
    case "double_bezigue":
      return "Double Bézigue";
    default:
      return combo.type;
  }
}

function comboPoints(combo: Combo): number {
  return combo.points;
}

function close() {
  emit("pass"); // fermer popup sans rien faire
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal-content {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  min-width: 300px;
}
button {
  margin: 0.5rem 0;
}
</style>
