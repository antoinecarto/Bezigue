<template>
  <div>
    <h2>Salles disponibles</h2>
    <p v-if="error" class="text-red-600">{{ error }}</p>
    <p v-if="loadingRooms">Chargement des salles...</p>

    <table v-if="rooms.length > 0" class="w-full border-collapse">
      <thead>
        <tr>
          <th class="border px-2 py-1">Nom de la salle</th>
          <th class="border px-2 py-1">Code</th>
          <th class="border px-2 py-1">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="room in rooms" :key="room.id">
          <td class="border px-2 py-1">{{ room.name || room.id }}</td>
          <td class="border px-2 py-1">{{ room.id }}</td>
          <td class="border px-2 py-1">
            <button @click="joinRoom(room.id)" :disabled="loading || !uid">
              {{ loading ? "Connexion..." : "Rejoindre" }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else>Aucune salle disponible pour le moment.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
} from "firebase/firestore";
import { db } from "../services/firebase.ts";
import { defineEmits } from "vue";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { generateShuffledDeck, distributeCards } from "@/game/BezigueGame.ts";

const rooms = ref<Array<any>>([]);
const loadingRooms = ref(false);
const loading = ref(false);
const error = ref("");
const uid = ref("");
const emit = defineEmits(["room-joined"]);

async function fetchRooms() {
  loadingRooms.value = true;
  error.value = "";
  try {
    const q = query(collection(db, "rooms"), where("phase", "==", "waiting"));
    const querySnapshot = await getDocs(q);
    rooms.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (e) {
    console.error("Erreur récupération salles:", e);
    error.value = "Erreur récupération salles.";
  } finally {
    loadingRooms.value = false;
  }
}

let intervalId: number | null = null;

onMounted(() => {
  const auth = getAuth();
  onAuthStateChanged(auth, (user) => {
    if (user) {
      uid.value = user.uid;
      error.value = "";
      fetchRooms();
      if (!intervalId) {
        intervalId = setInterval(() => {
          if (uid.value) fetchRooms();
        }, 5000);
      }
    } else {
      uid.value = "";
      error.value = "Vous devez être connecté pour voir les salles.";
      rooms.value = [];
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  });
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});

// Fonction pour lancer la partie si 2 joueurs sont prêts
async function maybeStartGame(tx: any, roomRef: any, roomData: any) {
  if (roomData.phase !== "waiting") return;
  if ((roomData.players?.length ?? 0) !== 2) return;

  // Ici, tu dois générer le deck, distribuer les cartes, etc.
  // Exemple simplifié (à adapter selon ta logique métier) :

  const fullDeck = generateShuffledDeck();
  const distrib = distributeCards(fullDeck);

  // Prépare les mains des joueurs selon l’ordre des joueurs
  const host = roomData.players[0];
  const guest = roomData.players[1];
  const hands: Record<string, string[]> = {
    [host]: distrib.hands.player1,
    [guest]: distrib.hands.player2,
  };

  tx.update(roomRef, {
    phase: "play",
    currentTurn: host,
    deck: distrib.drawPile,
    trumpCard: distrib.trumpCard,
    trumpTaken: false,
    trumpSuit: distrib.trumpCard.slice(-1),
    hands,
    melds: {},
    trick: { cards: [], players: [] },
    drawQueue: [],
  });
}

const joinRoom = async (roomCode: string) => {
  error.value = "";
  if (!uid.value) {
    error.value = "Vous devez être connecté pour rejoindre une salle.";
    return;
  }
  loading.value = true;

  try {
    const roomRef = doc(db, "rooms", roomCode);
    await runTransaction(db, async (tx) => {
      const roomSnap = await tx.get(roomRef);
      if (!roomSnap.exists()) throw new Error("Salle introuvable.");
      const room = roomSnap.data();

      if ((room.players?.length ?? 0) >= 2) throw new Error("Salle pleine.");

      // Trouver le seat libre
      let seat = "";
      if (!room.players || room.players.length === 0) seat = "seat1";
      else if (room.players.length === 1) seat = "seat2";
      else throw new Error("Salle pleine.");

      const reservedHand = room.reservedHands?.[seat];
      if (!reservedHand) throw new Error("Pas de main réservée pour ce siège.");

      // Mise à jour des joueurs, mains et réservations
      const newPlayers = [...(room.players || [])];
      if (!newPlayers.includes(uid.value)) newPlayers.push(uid.value);

      const newNames = { ...(room.playerNames ?? {}), [uid.value]: "" };
      const newHands = { ...(room.hands || {}), [uid.value]: reservedHand };

      const newReservedHands = { ...(room.reservedHands || {}) };
      delete newReservedHands[seat];

      tx.update(roomRef, {
        players: newPlayers,
        hands: newHands,
        reservedHands: newReservedHands,
        status: "in_progress",
        playerNames: newNames,
      });

      // Tente de démarrer la partie si possible
      await maybeStartGame(tx, roomRef, {
        ...room,
        players: newPlayers,
        hands: newHands,
        reservedHands: newReservedHands,
        status: "in_progress",
        playerNames: newNames,
      });
    });

    emit("room-joined", roomCode);
  } catch (e: any) {
    error.value = e.message || "Erreur lors de la connexion à la salle.";
  } finally {
    loading.value = false;
  }
};
</script>
