// Unguessable tokens for invite and share links and inbox addresses.
export function newToken(bytes = 16) {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)
  return Array.from(values, (b) => b.toString(16).padStart(2, '0')).join('')
}
