<template>
  <div class="voice-chat">
    <button
      @click="toggleVoiceChat"
      :disabled="connecting"
      :class="{
        'bg-green-500 hover:bg-green-600': isConnected,
        'bg-blue-500 hover:bg-blue-600': !isConnected,
        'bg-gray-400': connecting,
      }"
      class="px-4 py-2 text-white rounded transition-colors"
    >
      <span v-if="connecting">Connexion...</span>
      <span v-else-if="isConnected">🎤 Vocal activé</span>
      <span v-else>{{
        isCaller ? "Créer la salle vocale" : "Rejoindre la salle vocale"
      }}</span>
    </button>

    <div v-if="connectionStatus" class="mt-2 text-sm text-gray-600">
      Status: {{ connectionStatus }}
    </div>

    <p v-if="error" class="text-red-600 mt-2">{{ error }}</p>

    <button
      v-if="isConnected"
      @click="disconnectVoiceChat"
      class="ml-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
    >
      Déconnecter
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch } from "vue";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/services/firebase";

const props = defineProps<{
  roomId: string; // Maintenant obligatoire
  isCaller: boolean;
}>();

const emit = defineEmits<{
  roomCreated: [roomId: string];
  connected: [];
  disconnected: [];
  error: [message: string];
}>();

// États réactifs
const error = ref("");
const connecting = ref(false);
const isConnected = ref(false);
const connectionStatus = ref("");

// Variables pour WebRTC et Firebase
let localStream: MediaStream | null = null;
let peerConnection: RTCPeerConnection | null = null;
let roomListener: Unsubscribe | null = null;
let candidatesListener: Unsubscribe | null = null;
let remoteAudio: HTMLAudioElement | null = null;

// Configuration ICE servers (ajout de serveurs TURN pour plus de fiabilité)
const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

async function startVoiceChat() {
  if (isConnected.value) return;

  connecting.value = true;
  error.value = "";
  connectionStatus.value = "Demande d'accès au microphone...";

  try {
    // 1. Obtenir le stream audio local
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    connectionStatus.value = "Initialisation de la connexion...";

    // 2. Créer la connexion peer-to-peer
    peerConnection = new RTCPeerConnection({ iceServers });

    // 3. Ajouter le stream local
    localStream.getTracks().forEach((track) => {
      peerConnection!.addTrack(track, localStream!);
    });

    // 4. Gérer le stream distant
    peerConnection.ontrack = (event) => {
      connectionStatus.value = "Stream distant reçu";
      const remoteStream = event.streams[0];

      if (!remoteAudio) {
        remoteAudio = new Audio();
        remoteAudio.autoplay = true;
      }

      remoteAudio.srcObject = remoteStream;
      remoteAudio.play().catch((e) => console.warn("Erreur lecture audio:", e));
    };

    // 5. Gérer les ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate && props.roomId) {
        try {
          const candidatesRef = collection(
            db,
            `rooms/${props.roomId}/candidates`
          );
          await addDoc(candidatesRef, event.candidate.toJSON());
        } catch (e) {
          console.error("Erreur ajout ICE candidate:", e);
        }
      }
    };

    // 6. Surveiller l'état de la connexion
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection?.connectionState;
      connectionStatus.value = `Connexion: ${state}`;

      if (state === "connected") {
        isConnected.value = true;
        emit("connected");
      } else if (state === "disconnected" || state === "failed") {
        if (isConnected.value) {
          handleConnectionLoss();
        }
      }
    };

    if (props.isCaller) {
      await handleCaller();
    } else {
      await handleJoiner();
    }

    // Écouter les ICE candidates distants
    setupCandidatesListener();
  } catch (e: unknown) {
    const errorMessage =
      e instanceof Error ? e.message : "Erreur lors de la connexion vocale.";
    error.value = errorMessage;
    emit("error", errorMessage);
    await cleanup();
  } finally {
    connecting.value = false;
  }
}

async function handleCaller() {
  connectionStatus.value = "Création de l'offre...";

  // Vérifier si la room existe déjà
  const roomRef = doc(db, "rooms", props.roomId);
  const roomSnapshot = await getDoc(roomRef);

  const offer = await peerConnection!.createOffer();
  await peerConnection!.setLocalDescription(offer);

  const offerData = {
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
    createdAt: new Date(),
    status: "waiting",
  };

  if (roomSnapshot.exists()) {
    // Mettre à jour la room existante
    await updateDoc(roomRef, offerData);
  } else {
    // Créer la room avec l'ID spécifié
    await updateDoc(roomRef, offerData);
  }

  connectionStatus.value = "En attente de réponse...";

  // Écouter la réponse
  roomListener = onSnapshot(roomRef, async (snapshot) => {
    const data = snapshot.data();
    if (data?.answer && !peerConnection?.currentRemoteDescription) {
      connectionStatus.value = "Réponse reçue, finalisation...";
      const answerDesc = new RTCSessionDescription(data.answer);
      await peerConnection!.setRemoteDescription(answerDesc);
    }
  });
}

async function handleJoiner() {
  connectionStatus.value = "Récupération de l'offre...";

  const roomRef = doc(db, "rooms", props.roomId);
  const roomSnapshot = await getDoc(roomRef);

  if (!roomSnapshot.exists()) {
    throw new Error("La salle vocale n'existe pas");
  }

  const roomData = roomSnapshot.data();
  if (!roomData?.offer) {
    throw new Error("Aucune offre trouvée dans la salle");
  }

  const offerDesc = new RTCSessionDescription(roomData.offer);
  await peerConnection!.setRemoteDescription(offerDesc);

  connectionStatus.value = "Création de la réponse...";
  const answer = await peerConnection!.createAnswer();
  await peerConnection!.setLocalDescription(answer);

  await updateDoc(roomRef, {
    answer: {
      type: answer.type,
      sdp: answer.sdp,
    },
    status: "connected",
  });

  connectionStatus.value = "Connexion établie";
}

function setupCandidatesListener() {
  const candidatesRef = collection(db, `rooms/${props.roomId}/candidates`);
  candidatesListener = onSnapshot(candidatesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added" && peerConnection) {
        const candidate = new RTCIceCandidate(change.doc.data());
        peerConnection
          .addIceCandidate(candidate)
          .catch((e) => console.warn("Erreur ajout ICE candidate:", e));
      }
    });
  });
}

function handleConnectionLoss() {
  connectionStatus.value = "Connexion perdue, tentative de reconnexion...";
  isConnected.value = false;
  emit("disconnected");

  // Tentative de reconnexion après 2 secondes
  setTimeout(() => {
    if (!isConnected.value && !connecting.value) {
      startVoiceChat();
    }
  }, 2000);
}

async function disconnectVoiceChat() {
  await cleanup();
  emit("disconnected");
}

async function cleanup() {
  isConnected.value = false;
  connectionStatus.value = "";

  // Arrêter le stream local
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  // Fermer la connexion peer
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  // Arrêter l'audio distant
  if (remoteAudio) {
    remoteAudio.pause();
    remoteAudio.srcObject = null;
    remoteAudio = null;
  }

  // Désabonner les listeners Firebase
  if (roomListener) {
    roomListener();
    roomListener = null;
  }

  if (candidatesListener) {
    candidatesListener();
    candidatesListener = null;
  }
}

async function toggleVoiceChat() {
  if (isConnected.value) {
    await disconnectVoiceChat();
  } else {
    await startVoiceChat();
  }
}

// Observer les changements de roomId
watch(
  () => props.roomId,
  async (newRoomId, oldRoomId) => {
    if (newRoomId !== oldRoomId && isConnected.value) {
      await cleanup();
      // Reconnexion automatique avec le nouveau roomId
      setTimeout(() => startVoiceChat(), 1000);
    }
  }
);

// Nettoyage au démontage du composant
onUnmounted(async () => {
  await cleanup();
});
</script>

<style scoped>
.voice-chat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
</style>
