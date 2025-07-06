<template>
  <div>
    <h2>Salles disponibles</h2>

    <p v-if="error" class="text-red-600">{{ error }}</p>
    <p v-if="loadingRooms">Chargement des salles...</p>

    <table v-if="rooms.length" class="w-full border-collapse">
      <thead>
        <tr>
          <th class="border px-2 py-1">Nom de la salle</th>
          <th class="border px-2 py-1">Code</th>
          <th class="border px-2 py-1">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rooms" :key="r.id">
          <td class="border px-2 py-1">{{ r.name || r.id }}</td>
          <td class="border px-2 py-1">{{ r.id }}</td>
          <td class="border px-2 py-1">
            <button @click="joinRoom(r.id)" :disabled="loading || !uid">
              {{ loading ? "Connexion..." : "Rejoindre" }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else>Aucune salle disponible pour le moment.</p>

    <!-- ─── Pop‑up nom joueur ────────────────────────── -->
    <NameModal v-if="showNameModal" @confirm="confirmName" />
  </div>
</template>

<script setup lang="ts">
/* ───────── imports ───────── */
import { ref, onMounted, onUnmounted } from "vue";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { generateShuffledDeck, distributeCards } from "@/game/BezigueGame";
import NameModal from "@/views/components/NameModal.vue";

/* ───────── état réactif ───────── */
const rooms = ref<any[]>([]);
const loadingRooms = ref(false);
const loading = ref(false);
const error = ref("");

const uid = ref<string>("");
const showNameModal = ref(false);

const emit = defineEmits(["room-joined"]);

/* ───────── pop‑up nom joueur ───────── */
onMounted(() => {
  // montre d’abord la pop‑up si aucun nom sauvegardé
  if (!localStorage.getItem("playerName")) showNameModal.value = true;
});

async function confirmName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  localStorage.setItem("playerName", trimmed);
  showNameModal.value = false;

  // si on a déjà rejoint une room → MAJ playerNames
  if (currentRoomId.value && uid.value) {
    await updateDoc(doc(db, "rooms", currentRoomId.value), {
      [`playerNames.${uid.value}`]: trimmed,
    });
  }
}

/* ───────── fetch des rooms "waiting" ───────── */
async function fetchRooms() {
  loadingRooms.value = true;
  try {
    const q = query(collection(db, "rooms"), where("phase", "==", "waiting"));
    const qs = await getDocs(q);
    rooms.value = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(e);
    error.value = "Erreur récupération salles.";
  } finally {
    loadingRooms.value = false;
  }
}

/* ───────── auth listener ───────── */
let intervalId: number | null = null;

onMounted(() => {
  onAuthStateChanged(getAuth(), (user) => {
    if (user) {
      uid.value = user.uid;
      error.value = "";
      fetchRooms();
      if (!intervalId)
        intervalId = setInterval(() => uid.value && fetchRooms(), 5000);
    } else {
      uid.value = "";
      error.value = "Vous devez être connecté pour voir les salles.";
      rooms.value = [];
      if (intervalId) clearInterval(intervalId), (intervalId = null);
    }
  });
});

onUnmounted(() => intervalId && clearInterval(intervalId));

/* ───────── joinRoom + auto‑start ───────── */
const currentRoomId = ref<string | null>(null);

async function maybeStartGame(tx: any, roomRef: any, roomData: any) {
  if (roomData.phase !== "waiting") return;
  if ((roomData.players?.length ?? 0) !== 2) return;

  const deck = generateShuffledDeck();
  const distrib = distributeCards(deck);

  const [host, guest] = roomData.players;
  const hands = {
    [host]: distrib.hands.player1,
    [guest]: distrib.hands.player2,
  };

  tx.update(roomRef, {
    phase: "play",
    currentTurn: host,
    deck: distrib.drawPile,
    trumpCard: distrib.trumpCard,
    trumpSuit: distrib.trumpCard.slice(-1),
    trumpTaken: false,
    hands,
    melds: {},
    trick: { cards: [], players: [] },
    drawQueue: [],
  });
}

async function joinRoom(roomCode: string) {
  if (!uid.value) {
    error.value = "Vous devez être connecté pour rejoindre une salle.";
    return;
  }
  loading.value = true;
  try {
    const roomRef = doc(db, "rooms", roomCode);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Salle introuvable.");
      const room = snap.data();

      if ((room.players?.length ?? 0) >= 2) throw new Error("Salle pleine.");

      // siège libre
      const seat = room.players?.length ? "seat2" : "seat1";
      const reserved = room.reservedHands?.[seat];
      if (!reserved) throw new Error("Pas de main réservée.");

      const players = [...(room.players ?? []), uid.value];
      const playerNames = {
        ...(room.playerNames ?? {}),
        [uid.value]: localStorage.getItem("playerName") ?? "",
      };
      const hands = { ...(room.hands ?? {}), [uid.value]: reserved };

      const newReserved = { ...(room.reservedHands ?? {}) };
      delete newReserved[seat];

      tx.update(roomRef, {
        players,
        playerNames,
        hands,
        reservedHands: newReserved,
        status: "in_progress",
      });

      await maybeStartGame(tx, roomRef, { ...room, players, hands });
    });

    currentRoomId.value = roomCode;
    emit("room-joined", roomCode);
  } catch (e: any) {
    error.value = e.message || "Erreur lors de la connexion à la salle.";
  } finally {
    loading.value = false;
  }
}
</script>
