<template>
  <div class="space-y-4">
    <!-- Bouton création -->
    <button
      class="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-40"
      @click="createRoom"
      :disabled="loading"
    >
      {{ loading ? "Création…" : "Créer une salle" }}
    </button>

    <!-- Affichage de l’ID créé -->
    <p v-if="roomId">
      ID de la salle&nbsp;: <code>{{ roomId }}</code>
    </p>
  </div>

  <!-- Choix 1 000 / 2 000 -->
  <label class="block mt-6 mb-2 font-semibold">Partie en&nbsp;:</label>
  <select v-model="targetScore" class="border p-2 rounded w-40">
    <option :value="1000">1 000&nbsp;pts</option>
    <option :value="2000">2 000&nbsp;pts</option>
  </select>

  <!-- ─── Modale Nom Joueur ────────────────── -->
  <NameModal v-if="showNameModal" @confirm="confirmName" />
</template>

<script setup lang="ts">
/* ───────── imports ───────── */
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getAuth } from "@firebase/auth";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { generateShuffledDeck, distributeCards } from "@/game/BezigueGame";
import { arrayToStr } from "@/game/serializers";
import NameModal from "@/views/components/NameModal.vue";
import { useGameStore } from "@/stores/game.ts";

const game = useGameStore();

/* ───────── état local ───────── */
const router = useRouter();
const emit = defineEmits<{ "room-created": [string] }>();
const roomId = ref<string | null>(null);
const loading = ref(false);
const targetScore = ref<1000 | 2000>(2000);

/* ───────── modale nom ───────── */
const showNameModal = ref(false);
const nameCallback = ref<(() => void) | null>(null);

function askPlayerName(callback: () => void) {
  if (!localStorage.getItem("playerName")) {
    showNameModal.value = true;
    nameCallback.value = callback;
  } else {
    callback();
  }
}

async function confirmName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  localStorage.setItem("playerName", trimmed);
  showNameModal.value = false;

  if (roomId.value && game.myUid) {
    await updateDoc(doc(db, "rooms", roomId.value), {
      [`playerNames.${game.myUid}`]: trimmed,
    });
  }

  if (nameCallback.value) {
    nameCallback.value();
    nameCallback.value = null;
  }
}

/* ───────── création de salle ───────── */
async function createRoom() {
  askPlayerName(() => actuallyCreateRoom());
}

async function actuallyCreateRoom() {
  loading.value = true;
  try {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error("Utilisateur non connecté");
    game.myUid = uid;

    const roomName = prompt("Nom de la salle ?")?.trim();
    if (!roomName) {
      loading.value = false;
      return;
    }
    /* 3. distribution immédiate (main P1 + main réservée P2) */
    const fullDeck = generateShuffledDeck();
    const distrib = distributeCards(fullDeck);
    const hostHand = arrayToStr(distrib.hands.player1);
    const seat2Hand = arrayToStr(distrib.hands.player2);
    const trumpCardStr = distrib.trumpCard;
    /* 4. document « rooms » */
    const roomRef = await addDoc(collection(db, "rooms"), {
      name: roomName,
      createdAt: serverTimestamp(),
      phase: "waiting",
      targetScore: targetScore.value,
      players: [uid],
      playerNames: { [uid]: localStorage.getItem("playerName") ?? "" },
      trumpCard: trumpCardStr,
      trumpSuit: trumpCardStr.match(/([a-zA-Z])_(?:1|2)$/)?.[1] ?? null,
      trumpTaken: false,
      deck: distrib.drawPile,
      hands: { [uid]: hostHand },
      reservedHands: { seat2: seat2Hand },
      trick: { cards: [], players: [] },
      melds: {},
      canMeld: null,
      drawQueue: [],
      scores: { [uid]: 0 },
      currentTurn: uid,
      currentMeneIndex: 0,
      combos: {},
    });
    /* 5. sous‑collection « menes/0 » */
    await setDoc(doc(db, "rooms", roomRef.id, "menes", "0"), {
      firstPlayerUid: uid,
      currentPliCards: [],
      plies: [],
      scores: { [uid]: 0 },
      targetScore: targetScore.value,
    });
    /* 6. navigation + emit */
    roomId.value = roomRef.id;
    emit("room-created", roomRef.id);
    router.push(`/room/${roomRef.id}`);
  } catch (e: any) {
    console.error(e);
    alert("Erreur : " + e.message);
  } finally {
    loading.value = false;
  }
}
</script>
