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

/* ── RANG UNIQUE & PARTAGÉ ─────────────────────────────────────────── */

function splitCode(code: string) {
  const [raw, _] = code.split("_"); // raw = "7C", "10D", etc.
  const rank = raw.slice(0, -1); // Tout sauf le dernier caractère
  const suit = raw.slice(-1) as Suit; // Dernier caractère (C, D, H, S)
  return { rank, suit } as const;
}

export async function startNewMene(roomId: string) {
  // 1. Récupérer les infos actuelles de la room
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

  // 2. Déterminer le prochain premier joueur (celui qui n’a pas commencé la dernière mène)
  const firstPlayer = players.find((p) => p !== lastFirstPlayer) ?? players[0];
  const secondPlayer = players.find((p) => p !== firstPlayer) ?? players[1];

  // 3. Générer et distribuer le jeu
  const fullDeck = generateShuffledDeck();
  const distrib = distributeCards(fullDeck);
  const trumpCardStr = distrib.trumpCard;
  const trumpSuit = trumpCardStr.match(/([a-zA-Z])_(?:1|2)$/)?.[1] ?? null;

  // 4. Incrément de l'index de mène
  const newMeneIndex = currentMeneIndex + 1;

  // 5. Mise à jour du document principal
  await updateDoc(doc(db, "rooms", roomId), {
    phase: "play",
    currentMeneIndex: newMeneIndex,
    trumpCard: trumpCardStr,
    trumpSuit,
    trumpTaken: false,
    deck: distrib.drawPile,
    hands: {
      [firstPlayer]: arrayToStr(distrib.hands.player1),
    },
    reservedHands: {
      [secondPlayer]: arrayToStr(distrib.hands.player2),
    },
    currentTurn: firstPlayer,
    drawQueue: [],
    trick: { cards: [], players: [] },
    melds: {},
    canMeld: null,
    combos: {},
  });

  // 6. Création du document « menes/newMeneIndex »
  await setDoc(doc(db, "rooms", roomId, "menes", `${newMeneIndex}`), {
    firstPlayerUid: firstPlayer,
    currentPliCards: [],
    plies: [],
    scores: {
      [players[0]]: 0,
      [players[1]]: 0,
    },
    targetScore: roomData.targetScore,
  });
}

export async function startNewMeneForP2(roomId: string) {
  const roomRef = doc(db, "rooms", roomId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const room = snap.data();

    const players = room.players ?? [];
    if (players.length < 2) return; // Pas de P2
    const p2Uid = players[1];
    const seat2 = "seat2";

    // Si la main est déjà là, pas besoin de la réassigner
    if (room.hands?.[p2Uid]) return;

    const reserved = room.reservedHands?.[seat2];
    if (!reserved) return;

    const newHands = { ...(room.hands ?? {}), [p2Uid]: reserved };
    const newReserved = { ...(room.reservedHands ?? {}) };
    delete newReserved[seat2];

    tx.update(roomRef, {
      hands: newHands,
      reservedHands: newReserved,
    });
  });
}
/// end mènes :
export async function endMene(roomId: string) {
  const roomSnap = await getDoc(doc(db, "rooms", roomId));
  if (!roomSnap.exists()) throw new Error("Room introuvable");
  const roomData = roomSnap.data();

  const currentMeneIndex = roomData.currentMeneIndex ?? 0;
  const meneSnap = await getDoc(
    doc(db, "rooms", roomId, "menes", `${currentMeneIndex}`)
  );
  const meneData = meneSnap.data();
  console.log("meneData : ", meneData);
  // Exemple : récupérer les scores
  const scores = meneData?.scores ?? {};
  console.log("scores : ", scores);
  const plies = meneData?.plies ?? [];
  if (plies.length > 0) {
    const lastPli = plies[plies.length - 1];
    const lastWinner = lastPli?.winner;
    if (lastWinner && scores[lastWinner] !== undefined) {
      scores[lastWinner] += 10; // ✅ Bonus dernier pli
    }
  }

  const target = roomData.targetScore ?? 2000;
  console.log("target : ", target);

  // Trouver si quelqu’un a atteint la cible
  const someoneReachedTarget = Object.values(scores).some(
    (score) => (score as number) >= target
  );
  console.log("someoneReachedTarget : ", someoneReachedTarget);

  if (someoneReachedTarget) {
    // Passage en phase final avec affichage du gagnant
    await updateDoc(doc(db, "rooms", roomId), {
      phase: "final",
      winnerUid: Object.entries(scores).reduce((max, curr) =>
        (curr[1] as number) > (max[1] as number) ? curr : max
      )[0],
    });
  } else {
    // Sinon, lancer une nouvelle mène
    await startNewMene(roomId);
    await startNewMeneForP2(roomId);
  }
}

export const useGameStore = defineStore("game", () => {
  /* ──────────── state ──────────── */
  const room = ref<RoomState | null>(null);
  const myUid = ref<string | null>(null);
  const hand = ref<string[]>([]);
  const melds = ref<Record<string, string[]>>({});
  const exchangeTable = ref<Record<string, string>>({});
  const scores = ref<Record<string, number>>({});

  const loading = ref(true);
  const playing = ref(false); // verrou anti double‑clic
  const showExchange = ref(false);
  const drawQueue = ref<string[]>([]); // ← Important !

  /* ──────────── getters ──────────── */
  watchEffect(() => {
    if (!room.value) return;

    const data = room.value;

    drawQueue.value = data.drawQueue || [];
    currentTurn.value = data.currentTurn || null;

    // ...idem pour d'autres champs si nécessaire
  });

  watchEffect(() => {
    if (!room.value) return;
    console.log("drawQueue:", room.value.drawQueue);
  });

  watchEffect(() => {
    if (!room.value || !myUid.value) return;

    const trick = room.value.trick;
    if (!trick || trick.cards?.length !== 2) return;

    // ⚠️ Ne pas lancer deux fois
    if (playing.value) return;

    // Ne pas résoudre si ce n'est pas moi qui ai posé la 2e carte
    const lastToPlay = trick.players?.[1];
    if (lastToPlay !== myUid.value) return;

    // Appel unique : pose un verrou
    playing.value = true;
    resolveTrickOnServer().finally(() => {
      playing.value = false;
    });
  });

  const currentTurn = computed(() => room.value?.currentTurn ?? null);

  const getExchange = computed(() => exchangeTable.value);
  const getScore = (uid: string) => scores.value[uid] ?? 0;

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

      if (myUid.value) hand.value = data.hands?.[myUid.value] ?? []; //melds.value = { ...data.melds };
      exchangeTable.value = { ...(data.exchangeTable ?? {}) };
      scores.value = { ...(data.scores ?? {}) };
      //
      melds.value = {};
      if (data.melds) {
        for (const [uid, cards] of Object.entries(data.melds)) {
          melds.value[uid] = Array.isArray(cards)
            ? cards
            : Object.values(cards);
        }
      }
      //
      console.log("🔥 Firestore hands reçues :", hand.value);
      console.log("🔥 Firestore melds reçus :", melds.value);
    });
  }

  const targetScore = ref(0);

  function setTargetScore(score: number) {
    targetScore.value = score;
  }

  async function updateHand(newHand: string[]) {
    if (!room.value || !myUid.value) return;
    await updateDoc(doc(db, "rooms", room.value.id), {
      [`hands.${myUid.value}`]: newHand,
    });
    hand.value = [...newHand];
  }

  /**
   * Déplace `code` de la main de `uid` vers sa meld.
   * - Déclenche la réactivité Vue 3 (nouveaux tableau + objet).
   * - Annule proprement en cas d'erreur Firestore.
   */
  async function addToMeld(uid: string, code: string) {
    if (!room.value) {
      console.warn("La pièce est introuvable.");
      return;
    }

    if (!uid || !code) {
      console.warn("UID ou code de carte manquant.");
      return;
    }

    const currentHand = Array.isArray(room.value.hands?.[uid])
      ? room.value.hands[uid]
      : [];
    const currentMeld = Array.isArray(room.value.melds?.[uid])
      ? room.value.melds[uid]
      : [];

    if (!currentHand.includes(code)) {
      console.warn(
        `❌ La carte ${code} n'est pas dans la main du joueur ${uid}.`
      );
    }

    if (currentMeld.includes(code)) {
      console.warn(`ℹ️ La carte ${code} est déjà dans le meld de ${uid}.`);
    }

    const newHand = currentHand.filter((c) => c !== code);
    const newMeld = [...currentMeld, code];

    try {
      await updateDoc(doc(db, "rooms", room.value.id), {
        [`hands.${uid}`]: newHand,
        [`melds.${uid}`]: newMeld,
      });

      // Met à jour l'état local après succès
      room.value.hands[uid] = newHand;
      room.value.melds[uid] = newMeld;

      console.log(`✅ Carte ${code} déplacée de la main au meld pour ${uid}.`);
    } catch (e) {
      console.error("❌ Erreur Firestore lors de l'ajout au meld :", e);
      // Ne pas toucher aux données locales si Firestore échoue
    }
  }

  async function removeFromMeldAndReturnToHand(uid: string, code: string) {
    console.log(
      "Début de removeFromMeldAndReturnToHand avec UID:",
      uid,
      "et code:",
      code
    );

    if (!room.value) {
      console.warn("La pièce est introuvable.");
    }

    if (!uid || !code) {
      console.warn("UID ou code de carte manquant.");
    }

    const currentMeld = room.value.melds?.[uid] ?? [];
    const currentHand = room.value.hands?.[uid] ?? [];

    if (!currentMeld.includes(code)) {
      console.warn(`La carte ${code} n'est pas dans le meld.`);
    }

    // Créer les nouveaux tableaux
    const newMeld = currentMeld.filter((c) => c !== code);
    const newHand = [...currentHand, code];
    console.log("newHand :", newHand);
    console.log("newMeld :", newMeld);

    try {
      // 🔥 Mise à jour Firestore
      await updateDoc(doc(db, "rooms", room.value.id), {
        [`melds.${uid}`]: newMeld,
        [`hands.${uid}`]: newHand,
      });

      // 🧠 Mise à jour locale
      room.value.melds[uid] = newMeld;
      room.value.hands[uid] = newHand;

      console.log(
        `✔️ Carte ${code} retirée du meld et ajoutée à la main de ${uid}.`
      );
    } catch (e) {
      console.error("❌ Erreur lors de la mise à jour Firestore :", e);
    }
  }

  async function removeFromMeld(uid: string, code: string) {
    console.log("⚙️ Début de removeFromMeld", { uid, code });
    if (!room.value) {
      console.warn("⛔️ Pas de room");
      return;
    }

    const currentHand = room.value.hands[uid] ?? [];
    const currentMeld = room.value.melds[uid] ?? [];
    console.log("🃏 currentMeld avant suppression :", currentMeld);

    if (!currentMeld.includes(code)) {
      console.warn(`⛔️ ${code} n'est pas dans le meld`);
      // return;
    }

    const newMeld = currentMeld.filter((c) => c !== code);
    const newHand = [...currentHand, code];

    if (newHand.length + newMeld.length > 9) {
      console.warn("⛔️ Trop de cartes (main + meld > 9)");
      // return;
    }
    console.log("room.value.id dans removeFromMeld : ", room.value.id);

    console.log("🔁 Suppression dans Firestore (removeFromMeld)", {
      [`hands.${uid}`]: newHand,
      [`melds.${uid}`]: newMeld,
    });

    await updateDoc(doc(db, "rooms", room.value.id), {
      [`hands.${uid}`]: newHand,
      [`melds.${uid}`]: newMeld,
    });
  }

  async function drawCard() {
    if (!room.value || !myUid.value) return;
    if (!canDraw()) return;

    const roomRef = doc(db, "rooms", room.value.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room missing");

      const d = snap.data() as RoomDoc;
      const dq = d.drawQueue ?? [];

      if (dq[0] !== myUid.value) throw new Error("Not your turn to draw");

      const hand = [...(d.hands[myUid.value] ?? [])];
      const meld = d.melds?.[myUid.value] ?? [];
      if (hand.length + meld.length >= 9) throw new Error("Hand full");

      const deck = [...(d.deck ?? [])];
      if (!deck.length) throw new Error("Deck is empty");

      const card = deck.shift()!;
      hand.push(card);

      const newQueue = dq.slice(1); // on retire le joueur qui vient de piocher

      const update: Record<string, any> = {
        [`hands.${myUid.value}`]: hand,
        deck,
        drawQueue: newQueue,
        opponentHasDrawn: true,
      };

      if (deck.length === 0) {
        update.phase = "battle"; // On entre dans la 2e phase de la mène
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
    const a = splitCode(first); // { rank, suit }
    const b = splitCode(second);
    // 1) même couleur → plus haute l’emporte
    if (a.suit === b.suit) {
      return RANK_ORDER[a.rank] >= RANK_ORDER[b.rank] ? firstUid : secondUid;
    }
    // 2) couleurs diff. : atout > non‑atout
    if (a.suit === trump && b.suit !== trump) return firstUid;
    if (b.suit === trump && a.suit !== trump) return secondUid;
    // 3) couleurs diff., pas d’atout → le meneur gagne

    return firstUid;
  }

  // delay utilitaire
  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function playCard(code: string) {
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
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room missing");
        const d = snap.data() as RoomDoc;

        if ((d.trick.cards?.length ?? 0) >= 2) throw new Error("Trick full");

        console.log("Server Hand:", d.hands[myUid.value]);
        console.log("Server Meld:", d.melds?.[myUid.value]);
        // Récupérer la main et le meld côté serveur
        const srvHand = [...(d.hands[myUid.value] ?? [])];
        const srvMeld = [...(d.melds?.[myUid.value] ?? [])];

        let removedFrom = "";

        // Essayer de retirer la carte de la main
        let pos = srvHand.indexOf(code);
        if (pos !== -1) {
          srvHand.splice(pos, 1);
          removedFrom = "hand";
        } else {
          // Sinon, essayer de la retirer du meld
          pos = srvMeld.indexOf(code);
          if (pos !== -1) {
            srvMeld.splice(pos, 1);
            removedFrom = "meld";
          } else {
            throw new Error("Card not in hand or meld server");
          }
        }

        const cards = [...(d.trick.cards ?? []), code];
        const players = [...(d.trick.players ?? []), myUid.value];
        const opponent = d.players.find((p) => p !== myUid.value)!;

        const update: Record<string, any> = {
          [`hands.${myUid.value}`]: srvHand,
          [`melds.${myUid.value}`]: srvMeld,
          trick: { cards, players },
          exchangeTable: { ...(d.exchangeTable ?? {}), [myUid.value]: code },
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

  async function resolveTrickOnServer() {
    if (!room.value) return;

    const roomRef = doc(db, "rooms", room.value.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room missing");
      const d = snap.data() as RoomDoc;

      const cards = d.trick.cards ?? [];
      const players = d.trick.players ?? [];
      if (cards.length !== 2) throw new Error("Trick not full");
      await delay(2000); // Laisse le pli affiché 3s dans l’UI

      // Code pour déterminer le gagnant, points, etc (idem dans playCard)

      function getSuit(card: string): string {
        const [raw] = card.split("_");
        return raw.slice(-1);
      }
      const trumpSuit = getSuit(d.trumpCard);
      const winner = resolveTrick(
        cards[0],
        cards[1],
        players[0],
        players[1],
        trumpSuit
      );
      const loser = players.find((p) => p !== winner)!;

      const points = cards.reduce(
        (acc, c) => (["10", "A"].includes(splitCode(c).rank) ? acc + 10 : acc),
        0
      );

      const update: Record<string, any> = {
        trick: { cards: [], players: [] },
        exchangeTable: {},
        currentTurn: winner,
        drawQueue: [winner, loser],
      };

      if (points) {
        update[`scores.${winner}`] = (d.scores?.[winner] ?? 0) + points;
      }

      if (d.deck.length === 0) {
        update.phase = "battle";
        update.drawQueue = []; // ne pas attendre une pioche impossible
      } else {
        update.drawQueue = [winner, loser];
      }

      tx.update(roomRef, update);
      const allHandsEmpty = d.players.every(
        (uid) => (d.hands[uid]?.length ?? 0) === 0
      );
      return allHandsEmpty;
    }).then(async (allHandsEmpty) => {
      if (allHandsEmpty) {
        await endMene(room.value!.id);
      }
    });
  }

  function checkExchangePossibility() {
    console.log("entrée dans checkExchangePossibility");
    const d = room.value;
    const uid = myUid.value;
    if (!d || !uid) return;
    if (d.currentTurn !== uid) {
      showExchange.value = false; // fermer si ce n'est plus le tour

      return;
    }

    const handCards = d.hands?.[uid];
    if (!handCards) {
      showExchange.value = false; // fermer si pas de main
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
  // ----- échange confirmé -----
  async function confirmExchange() {
    if (!room.value || !myUid.value) return;
    showExchange.value = false;

    const roomRef = doc(db, "rooms", room.value.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");

      const d = snap.data() as RoomDoc;
      const uid = myUid.value;

      const hand = d.hands?.[uid];
      if (!hand) {
        console.warn("Pas de main trouvée pour ce joueur");
        return;
      }

      const sevenPrefix = "7" + d.trumpSuit;
      const sevenCode = hand.find((card) => card.startsWith(sevenPrefix));
      if (!sevenCode) {
        console.warn("Le 7 d’atout n’est pas présent dans la main");
        return;
      }

      const trumpCard = d.trumpCard;
      const trumpRank = trumpCard.split("_")[0].slice(0, -1);
      const allowedRanks = ["A", "10", "K", "Q", "J"];

      if (!allowedRanks.includes(trumpRank)) {
        console.warn("Carte d’atout non échangeable :", trumpRank);
        return;
      }

      // Mise à jour de la main (remplace le 7 par la carte d’atout)
      const newHand = hand.filter((c) => c !== sevenCode);
      newHand.push(trumpCard);

      const update: Record<string, any> = {
        trumpCard: sevenCode,
        [`hands.${uid}`]: newHand,
        [`scores.${uid}`]: (d.scores?.[uid] || 0) + 10,
      };

      tx.update(roomRef, update);
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

  function cancelExchange() {
    showExchange.value = false;
  }

  async function joinRoom(roomId: string, uid: string, playerName: string) {
    myUid.value = uid;

    /* 1️⃣ — transaction pour s’enregistrer — */
    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const d = snap.data() as RoomDoc;

      /* déjà dedans → rien à faire */
      if (d.players.includes(uid)) return;

      /* salle pleine → refuse l’entrée  */
      if (d.players.length >= 2) throw new Error("Room already full");

      /* récupère la main réservée et prépare les updates */
      const seat2Hand = d.reservedHands?.seat2 ?? [];
      const updates: Record<string, any> = {
        players: [...d.players, uid],
        [`playerNames.${uid}`]: playerName,
        [`hands.${uid}`]: seat2Hand,
        [`scores.${uid}`]: 0,
      };

      /* dès qu’on est 2 on peut passer en phase 'play' */
      updates.currentTurn = d.currentTurn ?? d.players[0]; // ou tirage au sort

      tx.update(roomRef, updates);
    });

    /* 2️⃣ — s’abonner en temps réel — */
    return _subscribeRoom(roomId);
  }

  async function dropToMeld(code: string) {
    if (!room.value || !myUid.value) return;
    await addToMeld(myUid.value, code);
  }

  /** Préfixe "d'" ou "de " selon voyelle */
  const deOuD = (name: string) =>
    /^[aeiouyàâäéèëêïîôöùûüh]/i.test(name.trim()) ? "d'" : "de ";

  // helper facultatif
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
  };
});
