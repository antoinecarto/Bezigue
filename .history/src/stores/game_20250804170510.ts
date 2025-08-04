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

export function splitCode(code: string) {
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

  const scores = { ...roomData.scores };
  if (!roomData) throw new Error("Mène introuvable");

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
  });

  watchEffect(() => {
    if (!room.value || !myUid.value) return;

    const trick = room.value.trick;
    if (!trick || trick.cards?.length !== 2) return;
    if (playing.value) return;

    // ✅ Permettre aux 2 joueurs de déclencher (au lieu de seulement le dernier)
    const isPlayerInTrick = trick.players?.includes(myUid.value);
    if (!isPlayerInTrick) return;

    console.log("🚀 Tentative résolution pli par", myUid.value);

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

  async function updateHand(newHand: string[]): Promise<void> {
    if (!room.value || !myUid.value) return;

    // 🔍 Supprime les doublons
    const uniqueHand = [...new Set(newHand)];

    await updateDoc(doc(db, "rooms", room.value.id), {
      [`hands.${myUid.value}`]: uniqueHand,
    });

    // Mise à jour locale
    if (room.value.hands) {
      room.value.hands[myUid.value] = [...uniqueHand];
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

      // 🛡️ Vérification doublons
      const allHands = d.hands ?? {};
      allHands[myUid.value] = hand;

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
  // ========================================
  // NOUVELLES RÈGLES POUR LA PHASE BATTLE
  // ========================================

  // 🎯 Fonction pour vérifier si une carte est jouable en phase battle
  function isCardPlayableInBattle(
    card: string,
    playerHand: string[],
    leadSuit: Suit | null, // Couleur menée par J1 (null si c'est J1 qui joue)
    trumpSuit: Suit,
    isFirstPlayer: boolean
  ): { playable: boolean; reason?: string } {
    if (isFirstPlayer) {
      // J1 peut jouer n'importe quelle carte
      return { playable: true };
    }
    console.log("leadSuit : ", leadSuit);
    console.log("trumpSuit : ", trumpSuit);

    // J2 doit suivre les règles strictes
    const cardInfo = splitCode(card);
    const handSuits = playerHand.map((c) => splitCode(c).suit);

    // Si aucune couleur menée, erreur
    if (!leadSuit) {
      return { playable: false, reason: "Couleur menée non définie" };
    }

    // 1️⃣ OBLIGATION DE SUIVRE LA COULEUR
    const hasLeadSuit = handSuits.includes(leadSuit);
    if (hasLeadSuit) {
      if (cardInfo.suit === leadSuit) {
        return { playable: true };
      } else {
        return {
          playable: false,
          reason: `Vous devez jouer  ${suitLabel(
            leadSuit
          )} (vous en avez dans votre main)`,
        };
      }
    }

    // 2️⃣ OBLIGATION DE JOUER ATOUT SI PAS DE COULEUR MENÉE
    const hasTrump = handSuits.includes(trumpSuit);
    if (hasTrump) {
      if (cardInfo.suit === trumpSuit) {
        return { playable: true };
      } else {
        return {
          playable: false,
          reason: `Vous n'avez pas de  ${suitLabel(
            leadSuit
          )}, vous devez jouer atout (${trumpSuit})`,
        };
      }
    }

    // 3️⃣ DÉFAUSSE LIBRE SI NI COULEUR NI ATOUT
    return { playable: true }; // Se défausse (perdra le pli)
  }

  function suitLabel(suit: Suit): string {
    switch (suit) {
      case "♥":
        return "Cœur";
      case "♦":
        return "Carreau";
      case "♣":
        return "Trèfle";
      case "♠":
        return "Pique";
      default:
        return suit;
    }
  }

  function letterToSymbol(letter: string): Suit {
    switch (letter) {
      case "S":
        return "♠";
      case "H":
        return "♥";
      case "D":
        return "♦";
      case "C":
        return "♣";
      default:
        return letter as Suit;
    }
  }

  // 🎯 Fonction pour filtrer les cartes jouables
  function getPlayableCardsInBattle(
    playerHand: string[],
    leadSuit: Suit | null,
    trumpSuit: Suit,
    isFirstPlayer: boolean
  ): string[] {
    return playerHand.filter(
      (card) =>
        isCardPlayableInBattle(
          card,
          playerHand,
          leadSuit,
          trumpSuit,
          isFirstPlayer
        ).playable
    );
  }

  // 🎯 Fonction pour obtenir le message d'aide pour le joueur
  function getBattlePlayHint(
    playerHand: string[],
    leadSuit: Suit | null,
    trumpSuit: Suit,
    isFirstPlayer: boolean
  ): string {
    if (isFirstPlayer) {
      return "Vous menez le pli, jouez la carte de votre choix.";
    }

    if (!leadSuit) return "Erreur: couleur menée inconnue";

    const handSuits = playerHand.map((c) => splitCode(c).suit);
    const hasLeadSuit = handSuits.includes(leadSuit);
    const hasTrump = handSuits.includes(trumpSuit);

    const leadLabel = suitLabel(letterToSymbol(leadSuit));
    const trumpLabel = suitLabel(letterToSymbol(trumpSuit));

    if (hasLeadSuit) {
      return `Vous devez suivre la couleur ${leadLabel}.`;
    } else if (hasTrump) {
      return `Vous n'avez pas de ${leadSuit}, vous devez jouer atout (${trumpLabel}).`;
    } else {
      return `Vous n'avez ni ${leadSuit} ni atout, vous pouvez vous défausser.`;
    }
  }

  // 🎯 Message d'aide pour l'interface
  // 🔧 4. CORRIGER battleHint pour vérifier isMyTurn
  const battleHint = computed(() => {
    if (!hand.value || !room.value || room.value.phase !== "battle") {
      return null;
    }

    // ✅ AJOUT: Seulement afficher l'aide si c'est mon tour
    if (room.value.currentTurn !== myUid.value) {
      return null;
    }

    const currentTrick = room.value.trick?.cards || [];
    const leadSuit =
      currentTrick.length > 0 ? splitCode(currentTrick[0]).suit : null;
    const trumpSuit = splitCode(room.value.trumpCard).suit;
    const amFirstPlayer = currentTrick.length === 0;

    // ✅ CORRECTION: Utiliser toutes les cartes
    const allMyCards = [
      ...hand.value,
      ...(room.value.melds?.[myUid.value!] ?? []),
    ];

    return getBattlePlayHint(allMyCards, leadSuit, trumpSuit, amFirstPlayer);
  });

  // 🎯 Fonction pour jouer une carte avec validation
  // ========================================
  // CORRECTIONS À APPORTER À VOTRE STORE
  // ========================================

  // 🔧 1. CORRIGER playCardWithValidation pour vérifier isMyTurn
  async function playCardWithValidation(cardCode: string) {
    if (room.value == null) return;
    const allMyCards = [
      ...hand.value,
      ...(room.value.melds?.[myUid.value!] ?? []),
    ];
    if (!room.value || !hand.value) return;

    // ✅ AJOUT: Vérifier que c'est le tour du joueur
    if (room.value.currentTurn !== myUid.value) {
      console.error("❌ Ce n'est pas votre tour de jouer");
      return;
    }

    // Validation spéciale en phase battle
    if (room.value.phase === "battle") {
      const currentTrick = room.value.trick?.cards || [];
      const leadSuit =
        currentTrick.length > 0 ? splitCode(currentTrick[0]).suit : null;
      const trumpSuit = splitCode(room.value.trumpCard).suit;
      const amFirstPlayer = currentTrick.length === 0;

      const validation = isCardPlayableInBattle(
        cardCode,
        allMyCards,
        leadSuit,
        trumpSuit,
        amFirstPlayer
      );

      if (!validation.playable) {
        console.error("❌ Carte non jouable:", validation.reason);
        // ✅ AMÉLIORATION: Retourner l'erreur au lieu d'alert
        throw new Error(validation.reason);
      }
    }

    // Jouer la carte normalement
    await playCard(cardCode);
  }

  // ========================================
  // MISE À JOUR DE LA RÉSOLUTION DE PLI
  // ========================================

  // 🎯 Fonction de résolution mise à jour (optionnel: ajouter plus de logs)
  function resolveTrickBattle(
    first: string,
    second: string,
    firstUid: string,
    secondUid: string,
    trump: Suit
  ): string {
    const a = splitCode(first);
    const b = splitCode(second);

    console.log("🎯 Résolution pli battle:", {
      first: `${a.rank}${a.suit}`,
      second: `${b.rank}${b.suit}`,
      trump,
      firstPlayer: firstUid,
      secondPlayer: secondUid,
    });

    // Même couleur: le plus fort gagne
    if (a.suit === b.suit) {
      const winner =
        RANK_ORDER[a.rank] >= RANK_ORDER[b.rank] ? firstUid : secondUid;
      console.log(`✅ Même couleur (${a.suit}), gagnant: ${winner}`);
      return winner;
    }

    // Atout vs non-atout: atout gagne
    if (a.suit === trump && b.suit !== trump) {
      console.log(
        `✅ ${firstUid} joue atout (${a.suit}) vs ${b.suit}, ${firstUid} gagne`
      );
      return firstUid;
    }

    if (b.suit === trump && a.suit !== trump) {
      console.log(
        `✅ ${secondUid} joue atout (${b.suit}) vs ${a.suit}, ${secondUid} gagne`
      );
      return secondUid;
    }

    // Couleurs différentes, pas d'atout: premier joueur gagne
    console.log(
      `✅ Couleurs différentes sans atout, ${firstUid} (premier) gagne`
    );
    return firstUid;
  }

  // ========================================
  // SOLUTION 1: Intégrer le bonus dans resolveTrickOnServer
  // ========================================

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

      // ✅ CORRECTION: Utiliser resolveTrick (pas resolveTrickBattle)
      // ou créer une fonction qui choisit selon la phase
      const winner =
        d.phase === "battle"
          ? resolveTrickBattle(
              cards[0],
              cards[1],
              players[0],
              players[1],
              trumpSuit
            )
          : resolveTrick(cards[0], cards[1], players[0], players[1], trumpSuit);

      if (!winner) {
        throw new Error("resolveTrick failed to find winner");
      }

      const loser = players.find((p) => p !== winner)!;

      // 🎯 Points du pli (As et 10)
      const trickPoints = cards.reduce(
        (acc, c) => (["10", "A"].includes(splitCode(c).rank) ? acc + 10 : acc),
        0
      );

      // 🎯 VÉRIFIER SI C'EST LE DERNIER PLI
      const allHandsEmpty = d.players.every((uid) => {
        const handData = d.hands?.[uid];
        return Array.isArray(handData) ? handData.length === 0 : true;
      });

      const allMeldsEmpty = d.players.every((uid) => {
        const meldData = d.melds?.[uid];
        return Array.isArray(meldData) ? meldData.length === 0 : true;
      });

      const deckEmpty = d.deck.length === 0;
      const isLastTrick = allHandsEmpty && allMeldsEmpty && deckEmpty;

      // 🎯 CALCULER LE TOTAL DES POINTS
      let totalPoints = trickPoints;
      if (isLastTrick) {
        totalPoints += 10; // Bonus dernier pli
        console.log("🏆 Dernier pli détecté ! +10 bonus pour", winner);
      }

      console.log(
        `💰 Points calculés: ${trickPoints} (pli) ${
          isLastTrick ? "+ 10 (bonus)" : ""
        } = ${totalPoints} pour ${winner}`
      );

      const update: Record<string, any> = {
        trick: { cards: [], players: [], winner: winner },
        exchangeTable: {},
        currentTurn: winner,
      };

      // ✅ CORRECTION: Gérer drawQueue selon la phase
      if (d.phase === "battle") {
        // En phase battle, pas de pioche
        update.drawQueue = [];
      } else {
        // En phase normale, le gagnant et perdant piochent
        update.drawQueue = [winner, loser];
      }

      // 🎯 ATTRIBUTION DES POINTS EN UNE SEULE FOIS
      if (totalPoints > 0) {
        update[`scores.${winner}`] = (d.scores?.[winner] ?? 0) + totalPoints;
        console.log(
          `💰 +${totalPoints} pts pour ${winner} (${trickPoints} pli ${
            isLastTrick ? "+ 10 bonus" : ""
          })`
        );
      }

      // ✅ CORRECTION: Ne pas changer la phase si déjà en battle
      if (d.deck.length === 0 && d.phase !== "battle") {
        update.phase = "battle";
      }

      tx.update(roomRef, update);
      console.log("✅ Transaction terminée avec update:", update);

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

      // ✅ Supprimer l'ancienne trumpCard (donnée au joueur)
      deck = deck.filter((card) => card !== oldTrumpCard);

      // ✅ Ajouter le 7 (nouvelle trumpCard) en fin de pile
      deck.push(newTrumpCard);

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
    battleHint,
    // getters
    canDraw,
    currentTurn,
    getExchange,
    // setters
    setTargetScore,
    // actions
    splitCode,
    playCardWithValidation,
    resolveTrickBattle,
    removeFromMeldAndReturnToHand,
    getPlayableCardsInBattle,
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
