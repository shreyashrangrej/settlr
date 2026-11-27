/** `#RRGGBB` at an opacity, as `rgba()`: a ripple or a wash of a token colour. */
export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
