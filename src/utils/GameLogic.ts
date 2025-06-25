export interface CardData {
  /** Chaîne brute “As♠”, “10♥”… */
  raw: string
  rank: number          // 7-14  (7,8,9,10,11=Valet,12=Dame,13=Roi,14=As)
  suit: string          // '♠','♣','♥','♦'
}

/**
 * Décode “10♥” → { raw:'10♥', rank:10, suit:'♥' }
 * (adapte si tu utilises une autre notation)
 */
export function parseCard(raw: string): CardData {
  const suit = raw.slice(-1)
  const rankStr = raw.slice(0, -1)
  const rankTable: Record<string, number> = { V: 10, D: 11, R: 12, 10: 13, A: 14 }
  const rank = Number(rankStr) || rankTable[rankStr] || 0
  return { raw, rank, suit }
}

/**
 * Renvoie l’uid du vainqueur (‘firstUid’ ou ‘secondUid’)
 * Règles : voir énoncé utilisateur.
 */
export function resolveTrick(
  firstCard: string,
  secondCard: string,
  firstUid: string,
  secondUid: string,
  trumpSuit: string
): string {
  const A = parseCard(firstCard)
  const B = parseCard(secondCard)

  const trumpA = A.suit === trumpSuit
  const trumpB = B.suit === trumpSuit

  if (A.suit === B.suit) {
    return A.rank >= B.rank ? firstUid : secondUid
  }
  if (trumpA && !trumpB) return firstUid
  if (!trumpA && trumpB) return secondUid
  if (trumpA && trumpB) return A.rank >= B.rank ? firstUid : secondUid
  // couleurs différentes, pas d’atout : premier joueur gagne
  return firstUid
}

// // GameLogic.ts
// import {
//   doc, runTransaction, arrayRemove, arrayUnion, increment
// } from 'firebase/firestore'
// import { db } from '@/firebase'
// import { resolveTrick } from './resolveTrick'      // ta fonction métier

// export async function playCard(
//   roomId: string,
//   meneIndex: number,
//   uid: string,
//   card: string
// ) {
//   const roomRef = doc(db, 'rooms', roomId)
//   const meneRef = doc(db, 'rooms', roomId, 'menes', String(meneIndex))

//   await runTransaction(db, async (txn) => {
//     const roomSnap = await txn.get(roomRef)
//     const meneSnap = await txn.get(meneRef)
//     if (!roomSnap.exists() || !meneSnap.exists()) return

//     const room  = roomSnap.data()
//     const mene  = meneSnap.data()
//     const players = room.players as string[]
//     const uidIndex = players.indexOf(uid)
//     if (uidIndex !== room.nextTurnIndex) return      // pas ton tour

//     /* ───── retire la carte de la main ───── */
//     txn.update(roomRef, {
//       [`hands.${uid}`]: arrayRemove(card)
//     })

//     /* ───── ajoute dans le pli courant ───── */
//     const newPli = [...mene.currentPliCards, { uid, card }]
//     txn.update(meneRef, { currentPliCards: newPli })

//     /* ───── si 2 cartes, on résout le pli ───── */
//     if (newPli.length === 2) {
//       const trump = room.trumpSuit as string
//       const winnerUid = resolveTrick(
//         newPli[0].card, newPli[1].card,
//         newPli[0].uid,  newPli[1].uid,
//         trump
//       )

//       txn.update(meneRef, {
//         currentPliCards: [],
//         plies          : arrayUnion({ cards: newPli, winnerUid }),
//         [`scores.${winnerUid}`]: increment(1),
//         firstPlayerUid : winnerUid
//       })

//       // le vainqueur entame le prochain pli
//       const nextTurnIdx = players.indexOf(winnerUid)
//       txn.update(roomRef, { nextTurnIndex: nextTurnIdx })
//     } else {
//       /* sinon on passe la main à l'autre joueur */
//       const nextTurnIdx = (room.nextTurnIndex + 1) % players.length
//       txn.update(roomRef, { nextTurnIndex: nextTurnIdx })
//     }
//   })
// }



