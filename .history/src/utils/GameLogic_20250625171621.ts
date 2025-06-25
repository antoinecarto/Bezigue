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
