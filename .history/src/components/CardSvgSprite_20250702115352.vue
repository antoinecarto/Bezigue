<template>
  <!-- sprite réutilisable -->
  <svg
    :width="w"
    :height="h"
    viewBox="0 0 80 120"
    class="cursor-pointer select-none"
  >
    <!-- on référence le groupe de la carte dans le sprite -->
    <use :href="`${spritePath}#${id}`" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { svgId } from "@/utils/svgIdFr";

interface Props {
  card: string; // ex "7H", "AS", "10D"
  width?: number;
  height?: number;
  spritePath?: string; // permet de changer de jeu si besoin
}
const props = withDefaults(defineProps<Props>(), {
  width: 80,
  height: 120,
  spritePath: "/cards/svg-cards-2.0.svg",
});
const id = computed(() => svgId(props.card));
const w = props.width;
const h = props.height;
</script>
