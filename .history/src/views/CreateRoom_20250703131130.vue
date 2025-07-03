<template>
  <div class="space-y-4">
    <button
      class="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-40"
      @click="createRoom"
      :disabled="loading"
    >
      {{ loading ? "Création…" : "Créer une salle" }}
    </button>

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
</template>

<script setup lang="ts">
/* ───────── imports ───────── */
import { ref } from "vue";
import { useRouter } from "vue-router";
import { getAuth } from "firebase/auth";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase.ts";
import { generateShuffledDeck, distributeCards } from "@/game/BezigueGame";
import { arrayToStr } from "@/game/serializers"; // ← helpers string⇄Card

/* ───────── état local ───────── */
const router = useRouter();
const emit = defineEmits<{ "room-created": [string] }>();
const roomId = ref<string | null>(null);
const loading = ref(false);
const targetScore = ref<1000 | 2000>(2000); // choix utilisateur

/* ───────── création de salle ───────── */
async function createRoom() {
  loading.value = true;
  try {
    /* 1. sécurité utilisateur */
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error("Utilisateur non connecté");

    /* 2. nom de la salle */
    const roomName = prompt("Nom de la salle ?")?.trim();
    if (!roomName) {
      loading.value = false;
      return;
    }

    /* 3. distribution immédiate (main P1 + main réservée P2) */
    const fullDeck = generateShuffledDeck();
    const distrib = distributeCards(fullDeck); // renvoie des Card|string
    const hostHand = arrayToStr(distrib.hands.player1);
    const seat2Hand = arrayToStr(distrib.hands.player2);
    const trumpCardStr = distrib.trumpCard.toString();

    /* 4. document « rooms » */
    const roomRef = await addDoc(collection(db, "rooms"), {
      /* méta */
      name: roomName,
      createdAt: serverTimestamp(),
      phase: "waiting", // jeu pas encore lancé
      targetScore: targetScore.value,

      /* joueurs */
      players: [uid],
      playerNames: { [uid]: "" },

      /* cartes & état de jeu (main P1 + main réservée) */
      trumpCard: trumpCardStr,
      trumpSuit: trumpCardStr.slice(-1),
      trumpTaken: false,
      deck: arrayToStr(distrib.drawPile),
      hands: { [uid]: hostHand },
      reservedHands: { seat2: seat2Hand },

      /* pli / melds */
      trick: { cards: [], players: [] },
      melds: {},
      canMeld: null,
      drawQueue: [],
      scores: {},
      currentTurn: uid, // l’hôte commencera
      currentMeneIndex: 0,
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
    alert("Erreur : " + e.message);
  } finally {
    loading.value = false;
  }
}
</script>
