import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import VueDnDKitPlugin from "@vue-dnd-kit/core";
import { createPinia } from "pinia";

import "./style.css";

createApp(App)
  .use(router)
  .use(createPinia())
  .use(VueDnDKitPlugin)
  .mount("#app");
