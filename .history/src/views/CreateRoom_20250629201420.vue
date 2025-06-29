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
  <label class="block mb-2 font-semibold">Partie en : </label>
  <select v-model="targetScore" class="border p-2 rounded w-40 mb-4">
    <option :value="1000">1000 points</option>
    <option :value="2000">2000 points</option>
  </select>
</template>

<script setup lang="ts">
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
import { db } from "@/firebase";
import { getPlayerId } from "@/utils/playerId";
import { generateShuffledDeck, distributeCards } from "@/game/BezigueGame";

const emit = defineEmits<{ "room-created": [string] }>();
const router = useRouter();
const targetScore = ref(2000); // défaut 2000

const roomId = ref<string | null>(null);
const loading = ref(false);
const showTurnAlert = ref(false);

/** Création d'une nouvelle salle + mène 0 */
const createRoom = async () => {
  loading.value = true;
  try {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Utilisateur non connecté");

    /* --- 0. Nom de la salle --------------------------------- */
    const roomName = prompt("Entrez un nom pour la salle :")?.trim();
    if (!roomName) {
      alert("Le nom de la salle est obligatoire !");
      loading.value = false;
      return;
    }

    /* --- 1. Id joueur + distribution ------------------------ */
    const playerId = getPlayerId();
    const fullDeck = generateShuffledDeck();
    const deckInfo = distributeCards(fullDeck);

    /* --- 2. Doc room ---------------------------------------- */
    const roomData = {
      /* --- méta --- */
      name: roomName,
      createdAt: serverTimestamp(),
      status: "waiting",

      /* --- joueurs --- */
      players: [uid],
      playerNames: { [uid]: "" },

      /* --- état de la partie --- */
      currentMeneIndex: 0,
      nextTurnIndex: 0,
      currentTurn: uid,
      nextTurnUid: uid,
      /* partie*/
      targetScore: targetScore.value, // ← dynamique
      /* --- cartes --- */
      trumpCard: deckInfo.trumpCard,
      deck: deckInfo.drawPile,
      hands: { [uid]: deckInfo.hands.player1 },
      reservedHands: { seat2: deckInfo.hands.player2 },
      /* --- Pioche, pli --- */
      phase: "waiting",
      drawQueue: [],
      trick: { cards: [], players: [] },
      canMeld: null,
      melds: {},
    };

    const roomRef = await addDoc(collection(db, "rooms"), roomData);

    /* --- 3. Doc mène 0 (sous-collection) -------------------- */
    const mene0Ref = doc(db, "rooms", roomRef.id, "menes", "0");
    await setDoc(mene0Ref, {
      firstPlayerUid: uid,
      currentPliCards: [],
      plies: [],
      scores: { [uid]: 0 },
      targetScore: targetScore.value,
    });

    /* --- 4. Log & navigation -------------------------------- */
    console.log("Room créée :", roomRef.id);
    console.log("Main P1    :", deckInfo.hands.player1);
    console.log("Main P2    :", deckInfo.hands.player2);

    roomId.value = roomRef.id;
    emit("room-created", roomRef.id);
    router.push(`/room/${roomRef.id}`);
  } catch (err: any) {
    console.error("Erreur création salle :", err);
    alert("Erreur lors de la création de la salle : " + err.message);
  } finally {
    loading.value = false;
  }
};
</script>
