<template>
  <!-- Chat container -->
  <div
    class="chat-box flex flex-col rounded-2xl shadow-lg p-4 bg-white w-full max-h-72 overflow-hidden"
  >
    <!-- Message list -->
    <div ref="scrollArea" class="flex-1 overflow-y-auto pr-1 space-y-2">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="[
          'rounded-xl px-3 py-1.5 max-w-[70%] break-words',
          msg.uid === myUid
            ? 'self-end bg-primary/80 text-white'
            : 'self-start bg-muted',
        ]"
      >
        <p
          v-if="msg.uid !== myUid"
          class="text-xs font-semibold mb-0.5 text-gray-700"
        >
          {{ playerNames[msg.uid] ?? "???" }}
        </p>
        <p>{{ msg.text }}</p>
      </div>
    </div>

    <!-- Input -->
    <form @submit.prevent="sendMessage" class="mt-3 flex gap-2">
      <input
        v-model="draft"
        type="text"
        placeholder="Envoyer un message…"
        class="flex-1 rounded-full border px-4 py-2 focus:outline-none focus:ring"
      />
      <button
        type="submit"
        :disabled="!draft.trim()"
        class="btn btn-primary rounded-full px-4"
      >
        Envoyer
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from "vue";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useGameStore } from "@/stores/game";

/*
 * Chat en temps réel pour une room Bézigue
 * - stocke les messages dans `rooms/{roomId}/messages`
 * - chaque doc: { uid, text, createdAt }
 * - affichage auto‑scroll vers le bas
 */

const game = useGameStore();
const roomId = game.room?.id ?? "";
const myUid = game.myUid;

// joueur -> nom pour l'entête
const playerNames = game.room?.playerNames ?? {};

interface MessageDoc {
  id: string;
  uid: string;
  text: string;
  createdAt: any;
}

const messages = ref<MessageDoc[]>([]);
const draft = ref("");
const scrollArea = ref<HTMLElement>();

// scroll en bas quand messages changent
watch(messages, () => {
  nextTick(() => {
    scrollArea.value?.scrollTo({ top: scrollArea.value.scrollHeight });
  });
});

onMounted(() => {
  if (!roomId) return;
  const q = query(
    collection(db, "rooms", roomId, "messages"),
    orderBy("createdAt")
  );
  onSnapshot(q, (snap) => {
    messages.value = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<MessageDoc, "id">),
    }));
  });
});

async function sendMessage() {
  if (!draft.value.trim() || !roomId || !myUid) return;
  await addDoc(collection(db, "rooms", roomId, "messages"), {
    senderId: myUid,
    text: draft.value.trim(),
    createdAt: serverTimestamp(),
  });
  draft.value = "";
}
</script>

<style scoped>
.chat-box {
  /* place any custom styles here */
}
.bg-muted {
  background-color: #f3f4f6; /* tailwind gray-100 */
}
.bg-primary\/80 {
  background-color: theme("colors.blue.500 / 0.8");
}
</style>
