import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import VueDnDKitPlugin from "@vue-dnd-kit/core";
import "./style.css";

createApp(App).use(router).use(VueDnDKitPlugin).mount("#app");
