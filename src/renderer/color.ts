export function darkenHexColor(color: string, amount: number): string {
  const match = /^#([\da-f]{6})$/i.exec(color)
  if (!match) return color
  const factor = 1 - Math.max(0, Math.min(100, amount)) / 100
  const channels = [0, 2, 4].map((index) => Math.round(parseInt(match[1].slice(index, index + 2), 16) * factor))
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export function lightHexColor(color: string, amount: number): string {
  const match = /^#([\da-f]{6})$/i.exec(color)
  if (!match) return color
  const factor = Math.max(0, Math.min(1.5, amount))
  const channels = [0, 2, 4].map((index) => {
    const value = parseInt(match[1].slice(index, index + 2), 16)
    return Math.round(factor <= 1 ? value * factor : value + (255 - value) * (factor - 1) * 2)
  })
  return `#${channels.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0')).join('')}`
}
