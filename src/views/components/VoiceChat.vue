<template>
  <div>
    <button @click="startVoiceChat" :disabled="connecting">
      {{ isCaller ? "Créer la salle vocale" : "Rejoindre la salle vocale" }}
    </button>
    <p v-if="error" class="text-red-600">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  onSnapshot
} from "firebase/firestore";
import { db } from "@/services/firebase";

const props = defineProps<{
  roomId?: string; // optionnel si on crée une salle
  isCaller: boolean; // true = créateur, false = invité
}>();

const error = ref("");
const connecting = ref(false);
let localStream: MediaStream;
let peerConnection: RTCPeerConnection;

async function startVoiceChat() {
  connecting.value = true;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = event => {
      const remoteStream = event.streams[0];
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.play();
    };

    peerConnection.onicecandidate = async event => {
      if (event.candidate) {
        const candidatesRef = collection(db, `rooms/${roomId.value}/candidates`);
        await addDoc(candidatesRef, event.candidate.toJSON());
      }
    };

    if (props.isCaller) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const roomRef = await addDoc(collection(db, "rooms"), {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });

      roomId.value = roomRef.id;

      onSnapshot(doc(db, "rooms", roomId.value), async snapshot => {
        const data = snapshot.data();
        if (data?.answer && !peerConnection.currentRemoteDescription) {
          const answerDesc = new RTCSessionDescription(data.answer);
          await peerConnection.setRemoteDescription(answerDesc);
        }
      });
    } else {
      const roomRef = doc(db, "rooms", props.roomId!);
      const roomSnapshot = await getDoc(roomRef);
      const roomData = roomSnapshot.data();

      const offerDesc = new RTCSessionDescription(roomData!.offer);
      await peerConnection.setRemoteDescription(offerDesc);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      await updateDoc(roomRef, {
        answer: {
          type: answer.type,
          sdp: answer.sdp
        }
      });
    }

    // Écoute des ICE candidates distants
    const candidatesRef = collection(db, `rooms/${roomId.value}/candidates`);
    onSnapshot(candidatesRef, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    });
  } catch (e: any) {
    error.value = e.message || "Erreur lors de la connexion vocale.";
  } finally {
    connecting.value = false;
  }
}

const roomId = ref(props.roomId ?? "");
</script>