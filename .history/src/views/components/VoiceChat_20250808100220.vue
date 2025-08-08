<template>
  <div class="voice-chat">
    <button
      @click="toggleVoiceChat"
      :disabled="connecting || !props.roomId"
      :class="{
        'bg-green-500 hover:bg-green-600': isConnected,
        'bg-blue-500 hover:bg-blue-600': !isConnected && props.roomId,
        'bg-gray-400': connecting || !props.roomId,
      }"
      class="px-4 py-2 text-white rounded transition-colors"
    >
      <span v-if="connecting">Connexion...</span>
      <span v-else-if="!props.roomId">Room ID manquant</span>
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
import { ref, onUnmounted, watch, computed } from "vue";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  setDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/services/firebase";

const props = defineProps<{
  roomId: string;
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

// Configuration ICE servers améliorée
const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

// Computed pour valider le roomId
const isValidRoomId = computed(() => {
  return props.roomId && props.roomId.trim().length > 0;
});

async function startVoiceChat() {
  if (isConnected.value || !isValidRoomId.value) {
    if (!isValidRoomId.value) {
      error.value = "ID de salle invalide";
      emit("error", "ID de salle invalide");
    }
    return;
  }

  connecting.value = true;
  error.value = "";
  connectionStatus.value = "Demande d'accès au microphone...";

  try {
    // Validation supplémentaire
    if (
      !props.roomId ||
      props.roomId.includes("/") ||
      props.roomId.includes(" ")
    ) {
      throw new Error(
        "ID de salle invalide - ne doit pas contenir d'espaces ou de barres obliques"
      );
    }

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
      connectionStatus.value = "Stream distant reçu - Connexion établie";
      const remoteStream = event.streams[0];

      if (!remoteAudio) {
        remoteAudio = new Audio();
        remoteAudio.autoplay = true;
      }

      remoteAudio.srcObject = remoteStream;
      remoteAudio.play().catch((e) => console.warn("Erreur lecture audio:", e));

      // ✅ Marquer comme connecté dès réception du stream
      if (!isConnected.value) {
        isConnected.value = true;
        emit("connected");
      }
    };

    // 5. Gérer les ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate && isValidRoomId.value) {
        try {
          const candidatesRef = collection(
            db,
            "rooms",
            props.roomId.trim(),
            "candidates"
          );
          await addDoc(candidatesRef, {
            ...event.candidate.toJSON(),
            timestamp: new Date(),
            sender: props.isCaller ? "caller" : "joiner",
          });
        } catch (e) {
          console.error("Erreur ajout ICE candidate:", e);
        }
      }
    };

    // 6. Surveiller l'état de la connexion
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection?.connectionState;
      connectionStatus.value = `Connexion: ${state}`;

      if (state === "connected" && !isConnected.value) {
        isConnected.value = true;
        emit("connected");
      } else if (state === "disconnected" || state === "failed") {
        if (isConnected.value) {
          handleConnectionLoss();
        }
      }
    };

    // ✅ Écouter les ICE candidates AVANT de créer l'offre/réponse
    await setupCandidatesListener();

    if (props.isCaller) {
      await handleCaller();
    } else {
      await handleJoiner();
    }
  } catch (e: unknown) {
    console.error("Erreur startVoiceChat:", e);
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
  try {
    connectionStatus.value = "Création de l'offre...";

    const offer = await peerConnection!.createOffer();
    await peerConnection!.setLocalDescription(offer);

    // ✅ CORRECTION 1: Utiliser un sous-document dédié au lieu de modifier le document room principal
    const voiceChatRef = doc(
      db,
      "rooms",
      props.roomId.trim(),
      "voiceChat",
      "session"
    );

    await setDoc(voiceChatRef, {
      offer: {
        type: offer.type,
        sdp: offer.sdp,
      },
      createdAt: new Date(),
      phase: "waiting",
      caller: true,
    });

    connectionStatus.value = "En attente de réponse...";

    // Timeout plus court pour caller
    const timeoutId = setTimeout(() => {
      if (!isConnected.value) {
        error.value = "Timeout: Aucune réponse reçue";
        cleanup();
      }
    }, 45000);

    roomListener = onSnapshot(voiceChatRef, async (snapshot) => {
      const data = snapshot.data();

      if (data?.answer && !peerConnection?.currentRemoteDescription) {
        try {
          clearTimeout(timeoutId);
          connectionStatus.value = "Réponse reçue, finalisation...";

          const answerDesc = new RTCSessionDescription(data.answer);
          await peerConnection!.setRemoteDescription(answerDesc);

          connectionStatus.value = "Connexion en cours...";
        } catch (e) {
          console.error("Erreur lors du traitement de la réponse:", e);
          error.value = "Erreur lors du traitement de la réponse";
        }
      }
    });
  } catch (e) {
    console.error("Erreur handleCaller:", e);
    throw e;
  }
}

async function handleJoiner() {
  try {
    connectionStatus.value = "Recherche de la salle vocale...";
    const voiceChatRef = doc(
      db,
      "rooms",
      props.roomId.trim(),
      "voiceChat",
      "session"
    );

    // Attendre l'offre avec retry logic améliorée
    let retries = 0;
    const maxRetries = 15;

    while (retries < maxRetries) {
      const voiceChatSnapshot = await getDoc(voiceChatRef);
      const voiceChatData = voiceChatSnapshot.data();

      if (voiceChatSnapshot.exists() && voiceChatData?.offer) {
        // Traitement de l'offre
        const offerDesc = new RTCSessionDescription(voiceChatData.offer);
        await peerConnection!.setRemoteDescription(offerDesc);

        connectionStatus.value = "Création de la réponse...";
        const answer = await peerConnection!.createAnswer();
        await peerConnection!.setLocalDescription(answer);

        // ✅ CORRECTION 2: Sauvegarder la réponse dans le sous-document
        await updateDoc(voiceChatRef, {
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
          status: "connecting",
          answeredAt: new Date(),
        });

        connectionStatus.value = "Finalisation de la connexion...";

        // Timeout pour joiner aussi
        setTimeout(() => {
          if (!isConnected.value) {
            console.warn("Joiner: Timeout après envoi de la réponse");
            error.value = "Timeout: Connexion non établie";
            cleanup();
          }
        }, 30000);

        return;
      }

      retries++;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error("La salle vocale n'existe pas ou aucune offre trouvée");
  } catch (e) {
    console.error("Erreur handleJoiner:", e);
    throw e;
  }
}

async function setupCandidatesListener() {
  if (!isValidRoomId.value) {
    throw new Error("Room ID invalide pour l'écoute des candidates");
  }

  const candidatesRef = collection(
    db,
    "rooms",
    props.roomId.trim(),
    "candidates"
  );

  candidatesListener = onSnapshot(candidatesRef, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "added" && peerConnection) {
        const candidateData = change.doc.data();
        const sender = candidateData.sender;

        // Ne traiter que les candidates de l'autre peer
        if (
          (props.isCaller && sender === "joiner") ||
          (!props.isCaller && sender === "caller")
        ) {
          try {
            // Vérifier que la connexion est dans le bon état
            if (peerConnection.signalingState === "closed") {
              console.warn("PeerConnection fermée, ignore candidate");
              return;
            }

            const candidate = new RTCIceCandidate({
              candidate: candidateData.candidate,
              sdpMLineIndex: candidateData.sdpMLineIndex,
              sdpMid: candidateData.sdpMid,
            });

            await peerConnection.addIceCandidate(candidate);
          } catch (e) {
            console.warn("Erreur ajout ICE candidate:", e);
          }
        }
      }
    });
  });
}

function handleConnectionLoss() {
  connectionStatus.value = "Connexion perdue";
  isConnected.value = false;
  emit("disconnected");
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

  // ✅ CORRECTION 3: Nettoyer le sous-document voiceChat à la déconnexion
  try {
    if (isValidRoomId.value) {
      const voiceChatRef = doc(
        db,
        "rooms",
        props.roomId.trim(),
        "voiceChat",
        "session"
      );
      await updateDoc(voiceChatRef, {
        status: "disconnected",
        disconnectedAt: new Date(),
      }).catch(() => {
        // Ignore les erreurs de nettoyage si le document n'existe plus
      });
    }
  } catch (e) {
    console.warn("Erreur lors du nettoyage voiceChat:", e);
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
      if (isValidRoomId.value) {
        setTimeout(() => startVoiceChat(), 1000);
      }
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
