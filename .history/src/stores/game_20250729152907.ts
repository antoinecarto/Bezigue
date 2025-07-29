// // src/stores/game.ts
// import { defineStore } from "pinia";
// import { ref, computed, watchEffect } from "vue";
// import {
//   doc,
//   onSnapshot,
//   runTransaction,
//   updateDoc,
//   getDoc,
//   setDoc,
// } from "firebase/firestore";
// import { db } from "@/services/firebase";
// import type { RoomDoc, RoomState } from "@/types/firestore";
// import type { Suit } from "@/game/models/Card";
// import { generateShuffledDeck, distributeCards } from "@/game/BezigueGame";
// import { arrayToStr } from "@/game/serializers";

// //VERSION OK EN DEV.

// /* ── RANG UNIQUE & PARTAGÉ ─────────────────────────────────────────── */

// function splitCode(code: string) {
//   const [raw, _] = code.split("_"); // raw = "7C", "10D", etc.
//   const rank = raw.slice(0, -1); // Tout sauf le dernier caractère
//   const suit = raw.slice(-1) as Suit; // Dernier caractère (C, D, H, S)
//   return { rank, suit } as const;
// }

// export async function startNewMene(roomId: string): Promise<number> {
//   const roomSnap = await getDoc(doc(db, "rooms", roomId));
//   if (!roomSnap.exists()) throw new Error("Room introuvable");

//   const roomData = roomSnap.data();
//   const players: string[] = roomData.players;
//   const currentMeneIndex: number = roomData.currentMeneIndex ?? 0;
//   const lastFirstPlayer: string = (
//     await getDoc(doc(db, "rooms", roomId, "menes", `${currentMeneIndex}`))
//   ).data()?.firstPlayerUid;

//   if (players.length !== 2) {
//     throw new Error("Il faut exactement 2 joueurs pour démarrer une mène.");
//   }

//   const firstPlayer = players.find((p) => p !== lastFirstPlayer) ?? players[0];
//   const secondPlayer = players.find((p) => p !== firstPlayer) ?? players[1];

//   const fullDeck = generateShuffledDeck();
//   const distrib = distributeCards(fullDeck);
//   const trumpCardStr = distrib.trumpCard;
//   const trumpSuit = trumpCardStr.match(/([a-zA-Z])_(?:1|2)$/)?.[1] ?? null;

//   const newMeneIndex = currentMeneIndex + 1;

//   const initialScores: Record<string, number> = {
//     [players[0]]: roomData.scores?.[players[0]] ?? 0,
//     [players[1]]: roomData.scores?.[players[1]] ?? 0,
//   };

//   // Distribution directe aux 2 joueurs
//   await updateDoc(doc(db, "rooms", roomId), {
//     phase: "play",
//     currentMeneIndex: newMeneIndex,
//     trumpCard: trumpCardStr,
//     trumpSuit,
//     trumpTaken: false,
//     deck: distrib.drawPile,
//     hands: {
//       [firstPlayer]: arrayToStr(distrib.hands.player1),
//       [secondPlayer]: arrayToStr(distrib.hands.player2),
//     },
//     reservedHands: {}, // plus besoin
//     currentTurn: firstPlayer,
//     drawQueue: [],
//     trick: { cards: [], players: [] },
//     melds: {},
//     canMeld: null,
//     combos: {},
//     p1Ready: false,
//     p2Ready: false,
//     targetScore: roomData.targetScore ?? 2000,
//     scores: initialScores,
//   });

//   await setDoc(
//     doc(db, "rooms", roomId, "menes", `${newMeneIndex}`),
//     {
//       firstPlayerUid: firstPlayer,
//       currentPliCards: [],
//       plies: [],
//       scores: {
//         [players[0]]: 0,
//         [players[1]]: 0,
//       },
//     },
//     { merge: true }
//   );
//   return newMeneIndex; // pour afficher dans la popup
// }

// export async function endMene(roomId: string) {
//   const roomSnap = await getDoc(doc(db, "rooms", roomId));
//   if (!roomSnap.exists()) throw new Error("Room introuvable");
//   const roomData = roomSnap.data();

//   const currentMeneIndex = roomData.currentMeneIndex ?? 0;
//   const scores = { ...roomData.scores }; // ✅ Copie défensive des scores

//   // 🔍 On récupère le dernier pli du mene pour le bonus
//   const meneSnap = await getDoc(
//     doc(db, "rooms", roomId, "menes", `${currentMeneIndex}`)
//   );
//   const meneData = meneSnap.data();
//   const plies = meneData?.plies ?? [];

//   if (plies.length > 0) {
//     const lastPli = plies[plies.length - 1];
//     const lastWinner = lastPli?.winner;

//     if (lastWinner && scores[lastWinner] !== undefined) {
//       scores[lastWinner] += 10; // ✅ Bonus pour le dernier pli
//     }
//   }

//   const target = roomData.targetScore ?? 2000;

//   const someoneReachedTarget = Object.values(scores).some(
//     (score) => (score as number) >= target
//   );

//   if (someoneReachedTarget) {
//     // 🎉 Trouver le joueur avec le plus gros score
//     const [winnerUid] = Object.entries(scores).reduce(
//       (maxEntry, currentEntry) =>
//         (currentEntry[1] as number) > (maxEntry[1] as number)
//           ? currentEntry
//           : maxEntry
//     );

//     await updateDoc(doc(db, "rooms", roomId), {
//       phase: "final",
//       winnerUid,
//       scores, // ✅ Sauvegarde des scores mis à jour
//     });
//   } else {
//     await updateDoc(doc(db, "rooms", roomId), {
//       scores, // ✅ Màj des scores même si pas encore fin
//     });
//     await startNewMene(roomId);
//   }
// }

// export const useGameStore = defineStore("game", () => {
//   /* ──────────── state ──────────── */
//   const room = ref<RoomState | null>(null);
//   const myUid = ref<string | null>(null);
//   const hand = computed<string[]>(() => {
//     const uid = myUid.value;
//     return uid && room.value?.hands?.[uid] ? room.value.hands[uid] : [];
//   });
//   const melds = ref<Record<string, string[]>>({});
//   const exchangeTable = ref<Record<string, string>>({});
//   const scores = ref<Record<string, number>>({});

//   const loading = ref(true);
//   const playing = ref(false); // verrou anti double‑clic
//   const showExchange = ref(false);
//   const drawQueue = ref<string[]>([]); // ← Important !
//   const currentTurn = ref<string | null>(null);
//   const getExchange = computed(() => exchangeTable.value);
//   const getScore = (uid: string) => scores.value[uid] ?? 0;
//   /* ──────────── getters ──────────── */
//   watchEffect(() => {
//     if (!room.value) return;
//     scores.value = room.value.scores || {};
//   });
//   watchEffect(() => {
//     if (!room.value) return;
//     targetScore.value = room.value.targetScore ?? 0;
//   });
//   watchEffect(() => {
//     if (!room.value) return;

//     const data = room.value;

//     drawQueue.value = data.drawQueue || [];
//     currentTurn.value = data.currentTurn || null;

//     // ...idem pour d'autres champs si nécessaire
//   });

//   watchEffect(() => {
//     if (!room.value) return;
//     console.log("drawQueue:", room.value.drawQueue);
//   });

//   watchEffect(() => {
//     if (!room.value || !myUid.value) return;

//     const trick = room.value.trick;
//     if (!trick || trick.cards?.length !== 2) return;

//     if (playing.value) return;

//     const lastToPlay = trick.players?.[1];
//     if (lastToPlay !== myUid.value) return;

//     playing.value = true;

//     resolveTrickOnServer().finally(() => {
//       playing.value = false;
//     });
//   });

//   /* ─────────── helpers ─────────── */
//   function _subscribeRoom(roomId: string) {
//     return onSnapshot(doc(db, "rooms", roomId), (snap) => {
//       loading.value = false;
//       if (!snap.exists()) {
//         room.value = null;
//         return;
//       }
//       const data = snap.data() as RoomDoc;
//       room.value = { id: snap.id, ...data };

//       exchangeTable.value = { ...(data.exchangeTable ?? {}) };
//       scores.value = { ...(data.scores ?? {}) };
//       //
//       melds.value = {};
//       if (data.melds) {
//         for (const [uid, cards] of Object.entries(data.melds)) {
//           melds.value[uid] = Array.isArray(cards)
//             ? cards
//             : Object.values(cards);
//         }
//       }
//     });
//   }

//   const targetScore = ref(0);

//   function setTargetScore(score: number) {
//     targetScore.value = score;

//     // et éventuellement, synchroniser Firestore :
//     if (room.value?.id) {
//       updateDoc(doc(db, "rooms", room.value.id), {
//         targetScore: score,
//       });
//     }
//   }
//   async function updateHand(newHand: string[]) {
//     if (!room.value || !myUid.value) return;

//     await updateDoc(doc(db, "rooms", room.value.id), {
//       [`hands.${myUid.value}`]: newHand,
//     });

//     // 🧠 Mise à jour locale de room pour refléter le changement immédiatement
//     if (room.value.hands) {
//       room.value.hands[myUid.value] = [...newHand];
//     }
//   }

//   /**
//    * Déplace `code` de la main de `uid` vers sa meld.
//    * - Déclenche la réactivité Vue 3 (nouveaux tableau + objet).
//    * - Annule proprement en cas d'erreur Firestore.
//    */
//   async function addToMeld(uid: string, code: string) {
//     if (!room.value) {
//       console.warn("La pièce est introuvable.");
//       return;
//     }

//     if (!uid || !code) {
//       console.warn("UID ou code de carte manquant.");
//       return;
//     }

//     const currentHand = Array.isArray(room.value.hands?.[uid])
//       ? room.value.hands[uid]
//       : [];
//     const currentMeld = Array.isArray(room.value.melds?.[uid])
//       ? room.value.melds[uid]
//       : [];

//     if (!currentHand.includes(code)) {
//       console.warn(
//         `❌ La carte ${code} n'est pas dans la main du joueur ${uid}.`
//       );
//     }

//     if (currentMeld.includes(code)) {
//       console.warn(`ℹ️ La carte ${code} est déjà dans le meld de ${uid}.`);
//     }

//     const newHand = currentHand.filter((c) => c !== code);
//     const newMeld = [...currentMeld, code];

//     try {
//       await updateDoc(doc(db, "rooms", room.value.id), {
//         [`hands.${uid}`]: newHand,
//         [`melds.${uid}`]: newMeld,
//       });

//       // Met à jour l'état local après succès
//       room.value.hands[uid] = newHand;
//       room.value.melds[uid] = newMeld;
//     } catch (e) {
//       console.error("❌ Erreur Firestore lors de l'ajout au meld :", e);
//       // Ne pas toucher aux données locales si Firestore échoue
//     }
//   }

//   async function removeFromMeldAndReturnToHand(uid: string, code: string) {
//     if (!room.value) {
//       console.warn("La pièce est introuvable.");
//       return;
//     }

//     if (!uid || !code) {
//       console.warn("UID ou code de carte manquant.");
//       return;
//     }

//     const currentMeld = room.value.melds?.[uid] ?? [];
//     const currentHand = room.value.hands?.[uid] ?? [];

//     if (!currentMeld.includes(code)) {
//       console.warn(`La carte ${code} n'est pas dans le meld.`);
//       return;
//     }

//     // Supprimer une seule occurrence du code dans le meld
//     const newMeld = [...currentMeld];
//     const meldIndex = newMeld.indexOf(code);
//     if (meldIndex !== -1) newMeld.splice(meldIndex, 1);

//     // Ajouter la carte uniquement si elle n'est pas déjà dans la main
//     const newHand = [...currentHand];
//     if (!newHand.includes(code)) {
//       newHand.push(code);
//     } else {
//       console.warn(`⚠️ La carte ${code} est déjà dans la main de ${uid}.`);
//     }

//     try {
//       // 🔥 Mise à jour Firestore
//       await updateDoc(doc(db, "rooms", room.value.id), {
//         [`melds.${uid}`]: newMeld,
//         [`hands.${uid}`]: newHand,
//       });

//       // 🧠 Mise à jour locale
//       room.value.melds[uid] = newMeld;
//       room.value.hands[uid] = newHand;

//       console.log(
//         `✔️ Carte ${code} retirée du meld et ajoutée à la main de ${uid}.`
//       );
//     } catch (e) {
//       console.error("❌ Erreur lors de la mise à jour Firestore :", e);
//     }
//   }

//   // async function removeFromMeldAndReturnToHand(uid: string, code: string) {
//   //   if (!room.value) {
//   //     console.warn("La pièce est introuvable.");
//   //     return;
//   //   }

//   //   if (!uid || !code) {
//   //     console.warn("UID ou code de carte manquant.");
//   //     return;
//   //   }

//   //   const currentMeld = room.value.melds?.[uid] ?? [];
//   //   const currentHand = room.value.hands?.[uid] ?? [];

//   //   if (!currentMeld.includes(code)) {
//   //     console.warn(`La carte ${code} n'est pas dans le meld.`);
//   //   }

//   //   // Créer les nouveaux tableaux
//   //   const newMeld = currentMeld.filter((c) => c !== code);
//   //   const newHand = [...currentHand, code];

//   //   try {
//   //     // 🔥 Mise à jour Firestore
//   //     await updateDoc(doc(db, "rooms", room.value.id), {
//   //       [`melds.${uid}`]: newMeld,
//   //       [`hands.${uid}`]: newHand,
//   //     });

//   //     // 🧠 Mise à jour locale
//   //     room.value.melds[uid] = newMeld;
//   //     room.value.hands[uid] = newHand;

//   //     console.log(
//   //       `✔️ Carte ${code} retirée du meld et ajoutée à la main de ${uid}.`
//   //     );
//   //   } catch (e) {
//   //     console.error("❌ Erreur lors de la mise à jour Firestore :", e);
//   //   }
//   // }

//   async function removeFromMeld(uid: string, code: string) {
//     console.log("⚙️ Début de removeFromMeld", { uid, code });
//     if (!room.value) {
//       console.warn("⛔️ Pas de room");
//       return;
//     }

//     const currentHand = room.value.hands[uid] ?? [];
//     const currentMeld = room.value.melds[uid] ?? [];
//     console.log("🃏 currentMeld avant suppression :", currentMeld);

//     if (!currentMeld.includes(code)) {
//       console.warn(`⛔️ ${code} n'est pas dans le meld`);
//       // return;
//     }

//     const newMeld = currentMeld.filter((c) => c !== code);
//     const newHand = [...currentHand, code];

//     if (newHand.length + newMeld.length > 9) {
//       console.warn("⛔️ Trop de cartes (main + meld > 9)");
//       // return;
//     }
//     console.log("room.value.id dans removeFromMeld : ", room.value.id);

//     console.log("🔁 Suppression dans Firestore (removeFromMeld)", {
//       [`hands.${uid}`]: newHand,
//       [`melds.${uid}`]: newMeld,
//     });

//     await updateDoc(doc(db, "rooms", room.value.id), {
//       [`hands.${uid}`]: newHand,
//       [`melds.${uid}`]: newMeld,
//     });
//   }

//   async function drawCard() {
//     if (!room.value || !myUid.value) return;
//     if (!canDraw()) return;

//     const roomRef = doc(db, "rooms", room.value.id);

//     await runTransaction(db, async (tx) => {
//       const snap = await tx.get(roomRef);
//       if (!snap.exists()) throw new Error("Room missing");

//       const d = snap.data() as RoomDoc;
//       const dq = d.drawQueue ?? [];

//       if (dq[0] !== myUid.value) throw new Error("Not your turn to draw");

//       const hand = [...(d.hands[myUid.value] ?? [])];
//       const meld = d.melds?.[myUid.value] ?? [];
//       if (hand.length + meld.length >= 9) throw new Error("Hand full");

//       const deck = [...(d.deck ?? [])];
//       if (!deck.length) throw new Error("Deck is empty");

//       const card = deck.shift()!;
//       hand.push(card);

//       const newQueue = dq.slice(1); // on retire le joueur qui vient de piocher

//       const update: Record<string, any> = {
//         [`hands.${myUid.value}`]: hand,
//         deck,
//         drawQueue: newQueue,
//         opponentHasDrawn: true,
//       };

//       if (deck.length === 0) {
//         update.phase = "battle";
//       }

//       tx.update(roomRef, update);
//     });
//   }

//   function resolveTrick(
//     first: string,
//     second: string,
//     firstUid: string,
//     secondUid: string,
//     trump: Suit
//   ): string {
//     const a = splitCode(first); // { rank, suit }
//     const b = splitCode(second);
//     // 1) même couleur → plus haute l’emporte
//     if (a.suit === b.suit) {
//       return RANK_ORDER[a.rank] >= RANK_ORDER[b.rank] ? firstUid : secondUid;
//     }
//     // 2) couleurs diff. : atout > non‑atout
//     if (a.suit === trump && b.suit !== trump) return firstUid;
//     if (b.suit === trump && a.suit !== trump) return secondUid;
//     // 3) couleurs diff., pas d’atout → le meneur gagne

//     return firstUid;
//   }

//   // delay utilitaire
//   function delay(ms: number) {
//     return new Promise((resolve) => setTimeout(resolve, ms));
//   }

//   async function playCard(code: string) {
//     if (
//       playing.value ||
//       !room.value ||
//       !myUid.value ||
//       room.value.currentTurn !== myUid.value
//     )
//       return;

//     playing.value = true;

//     const roomRef = doc(db, "rooms", room.value.id);

//     try {
//       await runTransaction(db, async (tx) => {
//         const uid = myUid.value;
//         if (!uid) return; // pour rassurer TypeScript

//         const snap = await tx.get(roomRef);
//         if (!snap.exists()) throw new Error("Room missing");
//         const d = snap.data() as RoomDoc;

//         if ((d.trick.cards?.length ?? 0) >= 2) throw new Error("Trick full");
//         console.log("youpi Nouveau !!");

//         console.log("Server Hand:", d.hands[uid]);
//         console.log("Server Meld:", d.melds?.[uid]);

//         // Copie main et meld côté serveur
//         const srvHand = [...(d.hands[uid] ?? [])];
//         const srvMeld = [...(d.melds?.[uid] ?? [])];

//         // Chercher la carte dans la main
//         let index = srvHand.indexOf(code);
//         if (index !== -1) {
//           srvHand.splice(index, 1);
//         } else {
//           // Sinon chercher dans le meld
//           index = srvMeld.indexOf(code);
//           if (index !== -1) {
//             srvMeld.splice(index, 1);
//           } else {
//             throw new Error("Carte absente de la main et du meld");
//           }
//         }

//         const cards = [...(d.trick.cards ?? []), code];
//         const players = [...(d.trick.players ?? []), uid];
//         const opponent = d.players.find((p) => p !== uid)!;

//         const update: Record<string, any> = {
//           [`hands.${uid}`]: srvHand,
//           [`melds.${uid}`]: srvMeld,
//           trick: { cards, players },
//           exchangeTable: { ...(d.exchangeTable ?? {}), [uid]: code },
//         };

//         if (cards.length === 1) {
//           update.currentTurn = opponent;
//         }

//         tx.update(roomRef, update);
//       });
//     } finally {
//       playing.value = false;
//     }
//   }

//   async function resolveTrickOnServer() {
//     console.log("[resolveTrickOnServer] called");

//     if (!room.value) return;

//     const roomRef = doc(db, "rooms", room.value.id);

//     await runTransaction(db, async (tx) => {
//       const snap = await tx.get(roomRef);
//       if (!snap.exists()) throw new Error("Room missing");
//       const d = snap.data() as RoomDoc;

//       const cards = d.trick.cards ?? [];
//       const players = d.trick.players ?? [];
//       if (cards.length !== 2) throw new Error("Trick not full");
//       await delay(2000); // Laisse le pli affiché 3s dans l’UI

//       // Code pour déterminer le gagnant, points, etc (idem dans playCard)

//       function getSuit(card: string): string {
//         const [raw] = card.split("_");
//         return raw.slice(-1);
//       }
//       const trumpSuit = getSuit(d.trumpCard) as Suit;

//       console.log("Trump card:", d.trumpCard);
//       console.log("Trump suit:", trumpSuit);
//       console.log("Cards:", cards);
//       console.log("Players:", players);
//       const winner = resolveTrick(
//         cards[0],
//         cards[1],
//         players[0],
//         players[1],
//         trumpSuit
//       );
//       if (!winner) {
//         console.error("resolveTrick() a retourné un winner invalide");
//         throw new Error("resolveTrick failed to find winner");
//       }

//       const loser = players.find((p) => p !== winner)!;

//       const points = cards.reduce(
//         (acc, c) => (["10", "A"].includes(splitCode(c).rank) ? acc + 10 : acc),
//         0
//       );

//       const update: Record<string, any> = {
//         trick: { cards: [], players: [], winner: winner },
//         exchangeTable: {},
//         currentTurn: winner,
//         drawQueue: [winner, loser],
//       };

//       if (points) {
//         update[`scores.${winner}`] = (d.scores?.[winner] ?? 0) + points;
//       }

//       if (d.deck.length === 0) {
//         update.phase = "battle";
//         update.drawQueue = []; // ne pas attendre une pioche impossible
//       } else {
//         update.drawQueue = [winner, loser];
//       }

//       tx.update(roomRef, update);
//       const allHandsEmpty = d.players.every(
//         (uid) => (d.hands[uid]?.length ?? 0) === 0
//       );
//       return allHandsEmpty;
//     }).then(async (allHandsEmpty) => {
//       if (allHandsEmpty) {
//         await endMene(room.value!.id);
//       }
//     });
//   }

//   function checkExchangePossibility() {
//     console.log("entrée dans checkExchangePossibility");
//     const d = room.value;
//     const uid = myUid.value;
//     if (!d || !uid) return;
//     if (d.currentTurn !== uid) {
//       showExchange.value = false; // fermer si ce n'est plus le tour

//       return;
//     }

//     const handCards = d.hands?.[uid];
//     if (!handCards) {
//       showExchange.value = false; // fermer si pas de main
//       return;
//     }

//     const sevenCode = "7" + d.trumpSuit;
//     const trumpRank = d.trumpCard.split("_")[0].slice(0, -1);
//     const allowedRanks = ["A", "10", "K", "Q", "J"];
//     const isExchangeable = allowedRanks.includes(trumpRank);
//     const hasSeven = handCards.some((card) => card.startsWith(sevenCode));
//     const canExchange = hasSeven && isExchangeable;

//     showExchange.value = canExchange;
//   }
//   // ----- échange confirmé -----
//   async function confirmExchange() {
//     if (!room.value || !myUid.value) return;
//     showExchange.value = false;

//     const roomRef = doc(db, "rooms", room.value.id);

//     return await runTransaction(db, async (tx) => {
//       const snap = await tx.get(roomRef);
//       if (!snap.exists()) throw new Error("Room not found");

//       const d = snap.data() as RoomDoc;
//       const uid = myUid.value!;

//       const hand = d.hands?.[uid];
//       if (!hand) {
//         console.warn("Pas de main trouvée pour ce joueur");
//         return;
//       }

//       const sevenPrefix = "7" + d.trumpSuit;
//       const sevenCode = hand.find((card) => card.startsWith(sevenPrefix));
//       if (!sevenCode) {
//         console.warn("Le 7 d’atout n’est pas présent dans la main");
//         return;
//       }

//       const trumpCard = d.trumpCard;
//       const trumpRank = trumpCard.split("_")[0].slice(0, -1);
//       const allowedRanks = ["A", "10", "K", "Q", "J"];

//       if (!allowedRanks.includes(trumpRank)) {
//         console.warn("Carte d’atout non échangeable :", trumpRank);
//         return;
//       }

//       // Mise à jour de la main (remplace le 7 par la carte d’atout)
//       const newHand = hand.filter((c) => c !== sevenCode);
//       newHand.push(trumpCard);

//       const update: Record<string, any> = {
//         trumpCard: sevenCode,
//         [`hands.${uid}`]: newHand,
//         [`scores.${uid}`]: (d.scores?.[uid] || 0) + 10,
//       };

//       tx.update(roomRef, update);

//       return sevenCode;
//     });
//   }

//   async function doExchangeProcess() {
//     try {
//       const newTrumpCard = await confirmExchange();
//       // Si confirmExchange s'est bien passée (pas d'erreur), on continue
//       if (!newTrumpCard) {
//         console.warn(
//           "Aucune nouvelle carte d'atout, mise à jour du deck annulée."
//         );
//         return;
//       }
//       if (!room.value) {
//         throw new Error("Room value is null");
//       }
//       await updateDeckAfterExchange(room.value.id, newTrumpCard);
//     } catch (e) {
//       console.error("L'échange a échoué, on ne met pas à jour le deck", e);
//     }
//   }

//   async function updateDeckAfterExchange(roomId: string, newTrumpCard: string) {
//     const roomRef = doc(db, "rooms", roomId);

//     await runTransaction(db, async (tx) => {
//       const snap = await tx.get(roomRef);
//       if (!snap.exists()) throw new Error("Room not found");

//       const d = snap.data() as RoomDoc;
//       let deck = [...(d.deck ?? [])];

//       if (deck.length === 0) {
//         console.warn("Deck vide, rien à remplacer");
//         return;
//       }

//       // 🔥 Supprimer l'ancienne trumpCard du deck s'il y est (évite les doublons)
//       deck = deck.filter((card) => card !== d.trumpCard);

//       // 🔁 Ajouter la nouvelle trumpCard (le 7) en dernière position
//       deck.push(newTrumpCard);

//       tx.update(roomRef, { deck });
//     });
//   }

//   function canDraw(): boolean {
//     if (!room.value || !myUid.value) return false;

//     const d = room.value;

//     // 1. Vérifie que le pli est terminé
//     const trickDone = (d.trick.cards?.length ?? 0) === 0;

//     // 2. Vérifie que c'est bien à ce joueur de piocher
//     const isInDrawQueue = d.drawQueue?.[0] === myUid.value;

//     // 3. Vérifie la taille de la main + meld <= 9
//     const hand = d.hands?.[myUid.value] ?? [];
//     const meld = d.melds?.[myUid.value] ?? [];
//     const cardCountOk = hand.length + meld.length < 9;

//     return trickDone && isInDrawQueue && cardCountOk;
//   }

//   function cancelExchange() {
//     showExchange.value = false;
//   }

//   async function joinRoom(roomId: string, uid: string, playerName: string) {
//     myUid.value = uid;

//     /* 1️⃣ — transaction pour s’enregistrer — */
//     const roomRef = doc(db, "rooms", roomId);
//     await runTransaction(db, async (tx) => {
//       const snap = await tx.get(roomRef);
//       if (!snap.exists()) throw new Error("Room not found");
//       const d = snap.data() as RoomDoc;

//       /* déjà dedans → rien à faire */
//       if (d.players.includes(uid)) return;

//       /* salle pleine → refuse l’entrée  */
//       if (d.players.length >= 2) throw new Error("Room already full");

//       /* récupère la main réservée et prépare les updates */
//       const seat2Hand = d.reservedHands?.seat2 ?? [];
//       const updates: Record<string, any> = {
//         players: [...d.players, uid],
//         [`playerNames.${uid}`]: playerName,
//         [`hands.${uid}`]: seat2Hand,
//         [`scores.${uid}`]: 0,
//       };

//       /* dès qu’on est 2 on peut passer en phase 'play' */
//       updates.currentTurn = d.currentTurn ?? d.players[0]; // ou tirage au sort

//       tx.update(roomRef, updates);
//     });

//     /* 2️⃣ — s’abonner en temps réel — */
//     return _subscribeRoom(roomId);
//   }

//   async function dropToMeld(code: string) {
//     if (!room.value || !myUid.value) return;
//     await addToMeld(myUid.value, code);
//   }

//   /** Préfixe "d'" ou "de " selon voyelle */
//   const deOuD = (name: string) =>
//     /^[aeiouyàâäéèëêïîôöùûüh]/i.test(name.trim()) ? "d'" : "de ";

//   // helper facultatif
//   const RANK_ORDER: Record<string, number> = {
//     A: 8,
//     "10": 7,
//     K: 6,
//     Q: 5,
//     J: 4,
//     "9": 3,
//     "8": 2,
//     "7": 1,
//   };

//   /* ───────── expose ───────── */
//   return {
//     // state
//     room,
//     myUid,
//     hand,
//     melds,
//     exchangeTable,
//     loading,
//     playing,
//     showExchange,
//     drawQueue,
//     targetScore,
//     // getters
//     canDraw,
//     currentTurn,
//     getExchange,
//     // setters
//     setTargetScore,
//     // actions
//     removeFromMeldAndReturnToHand,
//     removeFromMeld,
//     startNewMene,
//     getScore,
//     updateHand,
//     addToMeld,
//     playCard,
//     drawCard,
//     dropToMeld,
//     joinRoom,
//     deOuD,
//     resolveTrick,
//     confirmExchange,
//     cancelExchange,
//     checkExchangePossibility,
//     doExchangeProcess,
//   };
// });

// src/stores/game.ts
import { defineStore } from "pinia";
import { ref, computed, watchEffect } from "vue";
import {
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import type { RoomDoc, RoomState } from "@/types/firestore";
import type { Suit } from "@/game/models/Card";
import { generateShuffledDeck, distributeCards } from "@/game/BezigueGame";
import { arrayToStr } from "@/game/serializers";

function splitCode(code: string) {
  const [raw, _] = code.split("_"); // raw = "7C", "10D", etc.
  const rank = raw.slice(0, -1); // Tout sauf le dernier caractère
  const suit = raw.slice(-1) as Suit; // Dernier caractère (C, D, H, S)
  return { rank, suit } as const;
}

export async function startNewMene(roomId: string): Promise<number> {
  const roomSnap = await getDoc(doc(db, "rooms", roomId));
  if (!roomSnap.exists()) throw new Error("Room introuvable");

  const roomData = roomSnap.data();
  const players: string[] = roomData.players;
  const currentMeneIndex: number = roomData.currentMeneIndex ?? 0;
  const lastFirstPlayer: string = (
    await getDoc(doc(db, "rooms", roomId, "menes", `${currentMeneIndex}`))
  ).data()?.firstPlayerUid;

  if (players.length !== 2) {
    throw new Error("Il faut exactement 2 joueurs pour démarrer une mène.");
  }

  const firstPlayer = players.find((p) => p !== lastFirstPlayer) ?? players[0];
  const secondPlayer = players.find((p) => p !== firstPlayer) ?? players[1];

  const fullDeck = generateShuffledDeck();
  const distrib = distributeCards(fullDeck);
  const trumpCardStr = distrib.trumpCard;
  const trumpSuit = trumpCardStr.match(/([a-zA-Z])_(?:1|2)$/)?.[1] ?? null;

  const newMeneIndex = currentMeneIndex + 1;

  const initialScores: Record<string, number> = {
    [players[0]]: roomData.scores?.[players[0]] ?? 0,
    [players[1]]: roomData.scores?.[players[1]] ?? 0,
  };

  // ✅ Distribution conforme à l'interface RoomDoc
  await updateDoc(doc(db, "rooms", roomId), {
    phase: "play",
    currentMeneIndex: newMeneIndex,
    trumpCard: trumpCardStr,
    trumpSuit,
    trumpTaken: false,
    deck: distrib.drawPile,
    hands: {
      [firstPlayer]: distrib.hands.player1, // ✅ string[] directement
      [secondPlayer]: distrib.hands.player2, // ✅ string[] directement
    },
    reservedHands: {},
    currentTurn: firstPlayer,
    drawQueue: [],
    trick: { cards: [], players: [] },
    melds: {},
    canMeld: null,
    combos: {},
    p1Ready: false,
    p2Ready: false,
    targetScore: roomData.targetScore ?? 2000,
    scores: initialScores,
  });

  await setDoc(
    doc(db, "rooms", roomId, "menes", `${newMeneIndex}`),
    {
      firstPlayerUid: firstPlayer,
      currentPliCards: [],
      plies: [],
      scores: {
        [players[0]]: 0,
        [players[1]]: 0,
      },
    },
    { merge: true }
  );
  return newMeneIndex;
}
export async function endMene(roomId: string) {
  const roomSnap = await getDoc(doc(db, "rooms", roomId));
  if (!roomSnap.exists()) throw new Error("Room introuvable");
  const roomData = roomSnap.data();

  const currentMeneIndex = roomData.currentMeneIndex ?? 0;
  const scores = { ...roomData.scores };
  const trick = roomData.trick; // ✅ trick vient bien de rooms ici

  const meneSnap = await getDoc(
    doc(db, "rooms", roomId, "menes", `${currentMeneIndex}`)
  );
  const meneData = meneSnap.data();
  if (!meneData) throw new Error("Mène introuvable");

  const hands = meneData.hands as Record<string, string[]>;
  const melds = meneData.melds as Record<string, any[]>;

  const allHandsEmpty = Object.values(hands).every((h) => h.length === 0);
  const allMeldsEmpty = Object.values(melds).every((m) => m.length === 0);
  const trickEmpty = trick?.cards?.length === 0;

  if (allHandsEmpty && allMeldsEmpty && trickEmpty) {
    const lastWinner = trick?.winner;
    if (lastWinner && scores[lastWinner] !== undefined) {
      console.log("10 de der pour", lastWinner);
      scores[lastWinner] += 10;
    }
  }

  const target = roomData.targetScore ?? 2000;
  const someoneReachedTarget = Object.values(scores).some(
    (score) => (score as number) >= target
  );

  if (someoneReachedTarget) {
    const [winnerUid] = Object.entries(scores).reduce(
      (maxEntry, currentEntry) =>
        (currentEntry[1] as number) > (maxEntry[1] as number)
          ? currentEntry
          : maxEntry
    );

    await updateDoc(doc(db, "rooms", roomId), {
      phase: "final",
      winnerUid,
      scores,
    });
  } else {
    await updateDoc(doc(db, "rooms", roomId), {
      scores,
    });
    await startNewMene(roomId);
  }
}

export const useGameStore = defineStore("game", () => {
  /* ──────────── state ──────────── */
  const room = ref<RoomState | null>(null);
  const myUid = ref<string | null>(null);

  // ✅ CORRECTION : hand maintenant toujours string[] selon RoomDoc
  const hand = computed<string[]>(() => {
    const uid = myUid.value;
    if (!uid || !room.value?.hands?.[uid]) {
      return [];
    }

    const handData = room.value.hands[uid];
    // ✅ Selon RoomDoc, hands est Record<string, string[]>
    return Array.isArray(handData) ? handData : [];
  });

  const melds = ref<Record<string, string[]>>({});
  const exchangeTable = ref<Record<string, string>>({});
  const scores = ref<Record<string, number>>({});
  const targetScore = ref<number>(0);

  const loading = ref<boolean>(true);
  const playing = ref<boolean>(false);
  const showExchange = ref<boolean>(false);
  const drawQueue = ref<string[]>([]);
  const currentTurn = ref<string | null>(null);

  /* ──────────── getters ──────────── */
  const getExchange = computed(() => exchangeTable.value);
  const getScore = (uid: string): number => scores.value[uid] ?? 0;

  /* ──────────── watchers ──────────── */
  watchEffect(() => {
    if (!room.value) return;
    scores.value = room.value.scores || {};
  });

  watchEffect(() => {
    if (!room.value) return;
    targetScore.value = room.value.targetScore ?? 0;
  });

  watchEffect(() => {
    if (!room.value) return;
    const data = room.value;
    drawQueue.value = data.drawQueue || [];
    currentTurn.value = data.currentTurn || null;
  });

  watchEffect(() => {
    if (!room.value) return;
    console.log("drawQueue:", room.value.drawQueue);
  });

  watchEffect(() => {
    if (!room.value || !myUid.value) return;

    const trick = room.value.trick;
    if (!trick || trick.cards?.length !== 2) return;
    if (playing.value) return;

    const lastToPlay = trick.players?.[1];
    if (lastToPlay !== myUid.value) return;

    playing.value = true;
    resolveTrickOnServer().finally(() => {
      playing.value = false;
    });
  });

  /* ─────────── helpers ─────────── */
  function _subscribeRoom(roomId: string) {
    return onSnapshot(doc(db, "rooms", roomId), (snap) => {
      loading.value = false;
      if (!snap.exists()) {
        room.value = null;
        return;
      }
      const data = snap.data() as RoomDoc;
      room.value = { id: snap.id, ...data };

      exchangeTable.value = { ...(data.exchangeTable ?? {}) };
      scores.value = { ...(data.scores ?? {}) };

      // ✅ Gestion des melds selon RoomDoc
      melds.value = {};
      if (data.melds) {
        for (const [uid, cards] of Object.entries(data.melds)) {
          melds.value[uid] = Array.isArray(cards) ? cards : [];
        }
      }
    });
  }

  function setTargetScore(score: number): void {
    targetScore.value = score;
    if (room.value?.id) {
      updateDoc(doc(db, "rooms", room.value.id), {
        targetScore: score,
      });
    }
  }

  // ✅ updateHand simplifié selon RoomDoc
  async function updateHand(newHand: string[]): Promise<void> {
    if (!room.value || !myUid.value) return;

    await updateDoc(doc(db, "rooms", room.value.id), {
      [`hands.${myUid.value}`]: newHand,
    });

    // Mise à jour locale
    if (room.value.hands) {
      room.value.hands[myUid.value] = [...newHand];
    }
  }

  async function addToMeld(uid: string, code: string): Promise<void> {
    if (!room.value || !uid || !code) return;

    // ✅ Selon RoomDoc, hands est toujours string[]
    const currentHand = room.value.hands?.[uid] ?? [];
    const currentMeld = room.value.melds?.[uid] ?? [];

    if (!currentHand.includes(code)) {
      console.warn(
        `❌ La carte ${code} n'est pas dans la main du joueur ${uid}.`
      );
      return;
    }

    if (currentMeld.includes(code)) {
      console.warn(`ℹ️ La carte ${code} est déjà dans le meld de ${uid}.`);
      return;
    }

    const newHand = currentHand.filter((c) => c !== code);
    const newMeld = [...currentMeld, code];

    try {
      await updateDoc(doc(db, "rooms", room.value.id), {
        [`hands.${uid}`]: newHand,
        [`melds.${uid}`]: newMeld,
      });

      // Mise à jour locale
      if (room.value.hands) room.value.hands[uid] = newHand;
      if (room.value.melds) room.value.melds[uid] = newMeld;
    } catch (e) {
      console.error("❌ Erreur Firestore lors de l'ajout au meld :", e);
    }
  }

  async function removeFromMeldAndReturnToHand(
    uid: string,
    code: string
  ): Promise<void> {
    if (!room.value || !uid || !code) return;

    const currentMeld = room.value.melds?.[uid] ?? [];
    const currentHand = room.value.hands?.[uid] ?? [];

    if (!currentMeld.includes(code)) {
      console.warn(`La carte ${code} n'est pas dans le meld.`);
      return;
    }

    const newMeld = [...currentMeld];
    const meldIndex = newMeld.indexOf(code);
    if (meldIndex !== -1) newMeld.splice(meldIndex, 1);

    const newHand = [...currentHand];
    if (!newHand.includes(code)) {
      newHand.push(code);
    } else {
      console.warn(`⚠️ La carte ${code} est déjà dans la main de ${uid}.`);
    }

    try {
      await updateDoc(doc(db, "rooms", room.value.id), {
        [`melds.${uid}`]: newMeld,
        [`hands.${uid}`]: newHand,
      });

      // Mise à jour locale
      if (room.value.melds) room.value.melds[uid] = newMeld;
      if (room.value.hands) room.value.hands[uid] = newHand;

      console.log(
        `✔️ Carte ${code} retirée du meld et ajoutée à la main de ${uid}.`
      );
    } catch (e) {
      console.error("❌ Erreur lors de la mise à jour Firestore :", e);
    }
  }

  async function removeFromMeld(uid: string, code: string): Promise<void> {
    if (!room.value) return;

    const currentHand = room.value.hands?.[uid] ?? [];
    const currentMeld = room.value.melds?.[uid] ?? [];

    if (!currentMeld.includes(code)) {
      console.warn(`⛔️ ${code} n'est pas dans le meld`);
      return;
    }

    const newMeld = currentMeld.filter((c) => c !== code);
    const newHand = [...currentHand, code];

    if (newHand.length + newMeld.length > 9) {
      console.warn("⛔️ Trop de cartes (main + meld > 9)");
      return;
    }

    try {
      await updateDoc(doc(db, "rooms", room.value.id), {
        [`hands.${uid}`]: newHand,
        [`melds.${uid}`]: newMeld,
      });
    } catch (e) {
      console.error("❌ Erreur Firestore dans removeFromMeld:", e);
    }
  }

  async function drawCard(): Promise<void> {
    if (!room.value || !myUid.value || !canDraw()) return;

    const roomRef = doc(db, "rooms", room.value.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room missing");

      const d = snap.data() as RoomDoc;
      const dq = d.drawQueue ?? [];

      if (dq[0] !== myUid.value) throw new Error("Not your turn to draw");

      // ✅ Selon RoomDoc, hands est string[]
      const hand = [...(d.hands?.[myUid.value] ?? [])];
      const meld = d.melds?.[myUid.value] ?? [];

      if (hand.length + meld.length >= 9) throw new Error("Hand full");

      const deck = [...(d.deck ?? [])];
      if (!deck.length) throw new Error("Deck is empty");

      const card = deck.shift()!;
      hand.push(card);

      const newQueue = dq.slice(1);

      const update: Record<string, any> = {
        [`hands.${myUid.value}`]: hand,
        deck,
        drawQueue: newQueue,
        opponentHasDrawn: true,
      };

      if (deck.length === 0) {
        update.phase = "battle";
      }

      tx.update(roomRef, update);
    });
  }

  function resolveTrick(
    first: string,
    second: string,
    firstUid: string,
    secondUid: string,
    trump: Suit
  ): string {
    const a = splitCode(first);
    const b = splitCode(second);

    if (a.suit === b.suit) {
      return RANK_ORDER[a.rank] >= RANK_ORDER[b.rank] ? firstUid : secondUid;
    }

    if (a.suit === trump && b.suit !== trump) return firstUid;
    if (b.suit === trump && a.suit !== trump) return secondUid;

    return firstUid;
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function playCard(code: string): Promise<void> {
    if (
      playing.value ||
      !room.value ||
      !myUid.value ||
      room.value.currentTurn !== myUid.value
    )
      return;

    playing.value = true;

    const roomRef = doc(db, "rooms", room.value.id);

    try {
      await runTransaction(db, async (tx) => {
        const uid = myUid.value;
        if (!uid) return;

        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room missing");
        const d = snap.data() as RoomDoc;

        if ((d.trick.cards?.length ?? 0) >= 2) throw new Error("Trick full");

        // ✅ Selon RoomDoc, hands et melds sont string[]
        const srvHand = [...(d.hands?.[uid] ?? [])];
        const srvMeld = [...(d.melds?.[uid] ?? [])];

        let index = srvHand.indexOf(code);
        if (index !== -1) {
          srvHand.splice(index, 1);
        } else {
          index = srvMeld.indexOf(code);
          if (index !== -1) {
            srvMeld.splice(index, 1);
          } else {
            throw new Error("Carte absente de la main et du meld");
          }
        }

        const cards = [...(d.trick.cards ?? []), code];
        const players = [...(d.trick.players ?? []), uid];
        const opponent = d.players.find((p) => p !== uid)!;

        const update: Record<string, any> = {
          [`hands.${uid}`]: srvHand,
          [`melds.${uid}`]: srvMeld,
          trick: { cards, players },
          exchangeTable: { ...(d.exchangeTable ?? {}), [uid]: code },
        };

        if (cards.length === 1) {
          update.currentTurn = opponent;
        }

        tx.update(roomRef, update);
      });
    } finally {
      playing.value = false;
    }
  }

  async function resolveTrickOnServer(): Promise<void> {
    if (!room.value) return;

    const roomRef = doc(db, "rooms", room.value.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room missing");
      const d = snap.data() as RoomDoc;

      const cards = d.trick.cards ?? [];
      const players = d.trick.players ?? [];
      if (cards.length !== 2) throw new Error("Trick not full");

      await delay(2000);

      function getSuit(card: string): string {
        const [raw] = card.split("_");
        return raw.slice(-1);
      }

      const trumpSuit = getSuit(d.trumpCard) as Suit;

      const winner = resolveTrick(
        cards[0],
        cards[1],
        players[0],
        players[1],
        trumpSuit
      );

      if (!winner) {
        throw new Error("resolveTrick failed to find winner");
      }

      const loser = players.find((p) => p !== winner)!;

      const points = cards.reduce(
        (acc, c) => (["10", "A"].includes(splitCode(c).rank) ? acc + 10 : acc),
        0
      );

      const update: Record<string, any> = {
        trick: { cards: [], players: [], winner: winner },
        exchangeTable: {},
        currentTurn: winner,
        drawQueue: [winner, loser],
      };

      if (points) {
        update[`scores.${winner}`] = (d.scores?.[winner] ?? 0) + points;
      }

      if (d.deck.length === 0) {
        update.phase = "battle";
        update.drawQueue = [];
      } else {
        update.drawQueue = [winner, loser];
      }

      tx.update(roomRef, update);

      // ✅ Vérification hands selon RoomDoc
      const allHandsEmpty = d.players.every((uid) => {
        const handData = d.hands?.[uid];
        return Array.isArray(handData) ? handData.length === 0 : true;
      });

      return allHandsEmpty;
    }).then(async (allHandsEmpty) => {
      if (allHandsEmpty) {
        await endMene(room.value!.id);
      }
    });
  }

  function checkExchangePossibility(): void {
    const d = room.value;
    const uid = myUid.value;
    if (!d || !uid) return;

    if (d.currentTurn !== uid) {
      showExchange.value = false;
      return;
    }

    // ✅ Selon RoomDoc, hands est string[]
    const handCards = d.hands?.[uid] ?? [];

    if (handCards.length === 0) {
      showExchange.value = false;
      return;
    }

    const sevenCode = "7" + d.trumpSuit;
    const trumpRank = d.trumpCard.split("_")[0].slice(0, -1);
    const allowedRanks = ["A", "10", "K", "Q", "J"];
    const isExchangeable = allowedRanks.includes(trumpRank);
    const hasSeven = handCards.some((card) => card.startsWith(sevenCode));
    const canExchange = hasSeven && isExchangeable;

    showExchange.value = canExchange;
  }

  async function confirmExchange(): Promise<
    { newTrumpCard: string; oldTrumpCard: string } | undefined
  > {
    if (!room.value || !myUid.value) return;
    showExchange.value = false;

    const roomRef = doc(db, "rooms", room.value.id);

    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");

      const d = snap.data() as RoomDoc;
      const uid = myUid.value!;
      const hand = d.hands?.[uid] ?? [];

      if (hand.length === 0) {
        console.warn("Pas de main trouvée pour ce joueur");
        return;
      }

      const sevenPrefix = "7" + d.trumpSuit;
      const sevenCode = hand.find((card) => card.startsWith(sevenPrefix));
      if (!sevenCode) {
        console.warn("Le 7 d'atout n'est pas présent dans la main");
        return;
      }

      const trumpCard = d.trumpCard;
      const trumpRank = trumpCard.split("_")[0].slice(0, -1);
      const allowedRanks = ["A", "10", "K", "Q", "J"];

      if (!allowedRanks.includes(trumpRank)) {
        console.warn("Carte d'atout non échangeable :", trumpRank);
        return;
      }

      const newHand = hand.filter((c) => c !== sevenCode);
      newHand.push(trumpCard);

      const update: Record<string, any> = {
        trumpCard: sevenCode,
        [`hands.${uid}`]: newHand,
        [`scores.${uid}`]: (d.scores?.[uid] || 0) + 10,
      };

      tx.update(roomRef, update);

      return {
        newTrumpCard: sevenCode,
        oldTrumpCard: trumpCard,
      };
    });
  }

  async function doExchangeProcess(): Promise<void> {
    try {
      const result = await confirmExchange();

      if (!result || !room.value) {
        console.warn(
          "Aucune nouvelle carte d'atout, mise à jour du deck annulée."
        );
        return;
      }

      const { newTrumpCard, oldTrumpCard } = result;

      await updateDeckAfterExchange(room.value.id, newTrumpCard, oldTrumpCard);
    } catch (e) {
      console.error("L'échange a échoué, on ne met pas à jour le deck", e);
    }
  }
  async function updateDeckAfterExchange(
    roomId: string,
    newTrumpCard: string,
    oldTrumpCard: string
  ): Promise<void> {
    const roomRef = doc(db, "rooms", roomId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");

      const d = snap.data() as RoomDoc;
      let deck = [...(d.deck ?? [])];

      if (deck.length === 0) {
        console.warn("Deck vide, rien à remplacer");
        return;
      }

      // 🔍 Log de vérification (facultatif mais utile en debug)
      console.log("Deck AVANT suppression :", deck);
      console.log("Ancienne trumpCard à supprimer :", oldTrumpCard);

      // ✅ Supprimer l'ancienne trumpCard (donnée au joueur)
      deck = deck.filter((card) => card !== oldTrumpCard);

      // ✅ Ajouter le 7 (nouvelle trumpCard) en fin de pile
      deck.push(newTrumpCard);

      console.log("Deck APRÈS mise à jour :", deck);

      tx.update(roomRef, { deck });
    });
  }

  function canDraw(): boolean {
    if (!room.value || !myUid.value) return false;

    const d = room.value;

    // 1. Vérifie que le pli est terminé
    const trickDone = (d.trick.cards?.length ?? 0) === 0;

    // 2. Vérifie que c'est bien à ce joueur de piocher
    const isInDrawQueue = d.drawQueue?.[0] === myUid.value;

    // 3. Vérifie la taille de la main + meld <= 9
    const hand = d.hands?.[myUid.value] ?? [];
    const meld = d.melds?.[myUid.value] ?? [];
    const cardCountOk = hand.length + meld.length < 9;

    return trickDone && isInDrawQueue && cardCountOk;
  }

  function cancelExchange(): void {
    showExchange.value = false;
  }

  async function joinRoom(roomId: string, uid: string, playerName: string) {
    myUid.value = uid;

    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const d = snap.data() as RoomDoc;

      if (d.players.includes(uid)) return;
      if (d.players.length >= 2) throw new Error("Room already full");

      const seat2Hand = d.reservedHands?.seat2 ?? [];
      const updates: Record<string, any> = {
        players: [...d.players, uid],
        [`playerNames.${uid}`]: playerName,
        [`hands.${uid}`]: seat2Hand,
        [`scores.${uid}`]: 0,
      };

      updates.currentTurn = d.currentTurn ?? d.players[0];
      tx.update(roomRef, updates);
    });

    return _subscribeRoom(roomId);
  }

  async function dropToMeld(code: string): Promise<void> {
    if (!room.value || !myUid.value) return;
    await addToMeld(myUid.value, code);
  }

  /** Préfixe "d'" ou "de " selon voyelle */
  const deOuD = (name: string): string =>
    /^[aeiouyàâäéèëêïîôöùûüh]/i.test(name.trim()) ? "d'" : "de ";

  // helper pour le classement des cartes
  const RANK_ORDER: Record<string, number> = {
    A: 8,
    "10": 7,
    K: 6,
    Q: 5,
    J: 4,
    "9": 3,
    "8": 2,
    "7": 1,
  };

  /* ───────── expose ───────── */
  return {
    // state
    room,
    myUid,
    hand,
    melds,
    exchangeTable,
    loading,
    playing,
    showExchange,
    drawQueue,
    targetScore,
    // getters
    canDraw,
    currentTurn,
    getExchange,
    // setters
    setTargetScore,
    // actions
    removeFromMeldAndReturnToHand,
    removeFromMeld,
    startNewMene,
    getScore,
    updateHand,
    addToMeld,
    playCard,
    drawCard,
    dropToMeld,
    joinRoom,
    deOuD,
    resolveTrick,
    confirmExchange,
    cancelExchange,
    checkExchangePossibility,
    doExchangeProcess,
  };
});
