<template>
  <transition name="fade">
    <div v-if="visible" class="toast">
      <strong>{{ title }}</strong>
      <p>{{ description }}</p>
    </div>
  </transition>
</template>

<script setup>
import { ref } from "vue";

const visible = ref(false);
const title = ref("");
const description = ref("");

export function showToast(newTitle, newDescription, duration = 3000) {
  title.value = newTitle;
  description.value = newDescription;
  visible.value = true;
  setTimeout(() => (visible.value = false), duration);
}

defineExpose({ showToast });
</script>

<style>
.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #333;
  color: white;
  padding: 12px 24px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 9999;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
