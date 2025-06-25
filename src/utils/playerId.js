// src/utils/playerId.js
// src/utils/playerId.js

export function getOrCreatePlayerId() {
  let id = localStorage.getItem('playerId')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('playerId', id)
  }
  return id
}

export function getPlayerId() {
  return localStorage.getItem('playerId')
}

export function getPlayerName() {
  return localStorage.getItem('playerName') || ''
}

export function setPlayerName(name) {
  localStorage.setItem('playerName', name)
}
