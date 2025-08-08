// Améliorations clés pour éviter les conflits avec les données de jeu async
function handleCaller() { try { connectionStatus.value = "Création de
l'offre..."; const offer = await peerConnection!.createOffer(); await
peerConnection!.setLocalDescription(offer); const roomRef = doc(db, "rooms",
props.roomId.trim()); // ✅ CORRECTION: Utiliser merge et ne toucher QUE
voiceChat await updateDoc(roomRef, { "voiceChat.offer": { type: offer.type, sdp:
offer.sdp, }, "voiceChat.createdAt": new Date(), "voiceChat.status": "waiting",
"voiceChat.caller": true, }); connectionStatus.value = "En attente de
réponse..."; // ... reste du code } catch (e) { console.error("Erreur
handleCaller:", e); throw e; } } async function handleJoiner() { try {
connectionStatus.value = "Recherche de la salle vocale..."; const roomRef =
doc(db, "rooms", props.roomId.trim()); let retries = 0; const maxRetries = 15;
while (retries < maxRetries) { const roomSnapshot = await getDoc(roomRef); const
roomData = roomSnapshot.data(); if (roomSnapshot.exists() &&
roomData?.voiceChat?.offer) { const offerDesc = new
RTCSessionDescription(roomData.voiceChat.offer); await
peerConnection!.setRemoteDescription(offerDesc); connectionStatus.value =
"Création de la réponse..."; const answer = await
peerConnection!.createAnswer(); await
peerConnection!.setLocalDescription(answer); // ✅ CORRECTION: Mise à jour
ciblée, sans affecter les autres données await updateDoc(roomRef, {
"voiceChat.answer": { type: answer.type, sdp: answer.sdp, }, "voiceChat.status":
"connecting", "voiceChat.answeredAt": new Date(), }); connectionStatus.value =
"Finalisation de la connexion..."; return; } retries++; await new
Promise((resolve) => setTimeout(resolve, 1500)); } throw new Error("La salle
vocale n'existe pas ou aucune offre trouvée"); } catch (e) {
console.error("Erreur handleJoiner:", e); throw e; } } // ✅ CORRECTION: Cleanup
plus sûr async function cleanup() { isConnected.value = false;
connectionStatus.value = ""; // Arrêter le stream local en premier if
(localStream) { localStream.getTracks().forEach((track) => { track.stop(); });
localStream = null; } // Fermer la connexion peer de façon sécurisée if
(peerConnection) { // Arrêter d'écouter les événements avant de fermer
peerConnection.ontrack = null; peerConnection.onicecandidate = null;
peerConnection.onconnectionstatechange = null; peerConnection.close();
peerConnection = null; } // Arrêter l'audio distant if (remoteAudio) {
remoteAudio.pause(); remoteAudio.srcObject = null; remoteAudio = null; } // ✅
Désabonner les listeners Firebase de façon sécurisée try { if (roomListener) {
roomListener(); roomListener = null; } if (candidatesListener) {
candidatesListener(); candidatesListener = null; } } catch (e) {
console.warn("Erreur lors du nettoyage des listeners:", e); } // ✅ NE PAS
nettoyer les données de la room dans Firestore // Car cela pourrait affecter les
données de jeu }
