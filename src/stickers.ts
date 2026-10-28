export type StickerCategory = 'Badge' | 'Dekorasi' | 'Ekspresi' | 'Simbol'
export type StickerAsset = { id: string; name: string; category: StickerCategory; svg: string }

const palette = [
  ['#ff6b6b', '#ffe08a'], ['#5268dc', '#a8c7ff'], ['#f59e0b', '#fff0a8'], ['#14b8a6', '#a7f3d0'],
  ['#a855f7', '#e9d5ff'], ['#ec4899', '#fbcfe8'], ['#22c55e', '#bbf7d0'], ['#0ea5e9', '#bae6fd'],
]
const starPoints = (points: number, outer: number, inner: number, center = 64) => Array.from({ length: points * 2 }, (_, index) => {
  const radius = index % 2 ? inner : outer
  const angle = -Math.PI / 2 + index * Math.PI / points
  return `${(center + Math.cos(angle) * radius).toFixed(1)},${(center + Math.sin(angle) * radius).toFixed(1)}`
}).join(' ')

const artwork: Record<string, (a: string, b: string) => string> = {
  star: (a, b) => `<polygon points="${starPoints(5,55,25)}" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M43 40l4 9 9 2-8 5-1 10-6-8-10 1 6-8-4-9z" fill="${b}"/>`,
  sparkle: (a, b) => `<path d="M48 12c4 29 12 37 40 42-28 5-36 13-40 42-5-29-13-37-41-42 28-5 36-13 41-42z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M98 69c3 17 8 22 24 25-16 3-21 8-24 25-3-17-8-22-24-25 16-3 21-8 24-25z" fill="${b}" stroke="#fff" stroke-width="6"/>`,
  heart: (a, b) => `<path d="M64 111 21 71C-4 45 17 12 43 22c10 4 17 13 21 20 8-17 23-26 39-20 26 10 27 40 5 61z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M33 43c4-8 12-11 19-8" fill="none" stroke="${b}" stroke-width="8" stroke-linecap="round"/>`,
  bolt: (a, b) => `<path d="M73 8 25 72h30l-7 48 55-72H72z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="m67 27-21 36h20l-4 25 24-35H65z" fill="${b}"/>`,
  flower: (a, b) => `${Array.from({ length: 8 }, (_, i) => `<ellipse cx="64" cy="31" rx="17" ry="25" fill="${a}" stroke="#fff" stroke-width="6" transform="rotate(${i * 45} 64 64)"/>`).join('')}<circle cx="64" cy="64" r="21" fill="${b}" stroke="#fff" stroke-width="7"/><circle cx="58" cy="58" r="4" fill="#fff"/>`,
  crown: (a, b) => `<path d="m18 42 27 21 19-40 20 40 27-21-11 61H29z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M31 88h66l-3 10H33z" fill="${b}"/><circle cx="18" cy="38" r="8" fill="${b}"/><circle cx="64" cy="20" r="8" fill="${b}"/><circle cx="110" cy="38" r="8" fill="${b}"/>`,
  sun: (a, b) => `<g stroke="#fff" stroke-width="8" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => `<path d="M64 7v14" transform="rotate(${i * 45} 64 64)"/>`).join('')}</g><circle cx="64" cy="64" r="35" fill="${a}" stroke="#fff" stroke-width="8"/><circle cx="52" cy="56" r="4" fill="${b}"/><circle cx="76" cy="56" r="4" fill="${b}"/><path d="M51 72q13 14 26 0" fill="none" stroke="${b}" stroke-width="6" stroke-linecap="round"/>`,
  burst: (a, b) => `<polygon points="${starPoints(12,59,39)}" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M47 48h34M47 63h34M47 78h25" stroke="${b}" stroke-width="7" stroke-linecap="round"/>`,
  check: (a, b) => `<path d="M64 9 78 18l17-1 8 15 15 8-1 18 9 15-10 14-2 17-17 6-12 12-17-7-17 3-10-14-15-8 2-18-8-15 11-13 3-17 17-5z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="m37 66 17 17 37-39" fill="none" stroke="${b}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
  chat: (a, b) => `<path d="M19 25q0-13 14-13h62q14 0 14 13v48q0 13-14 13H56l-25 19 4-19q-16-2-16-15z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M42 43h39M42 59h27" stroke="${b}" stroke-width="8" stroke-linecap="round"/>`,
  arrow: (a, b) => `<path d="M17 55h58V31l38 33-38 33V73H17z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M28 63h38" stroke="${b}" stroke-width="5" stroke-linecap="round"/>`,
  ribbon: (a, b) => `<path d="m43 66-13 48 34-20 34 20-13-48" fill="${b}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><circle cx="64" cy="48" r="39" fill="${a}" stroke="#fff" stroke-width="9"/><circle cx="64" cy="48" r="25" fill="none" stroke="${b}" stroke-width="5"/><path d="m64 28 6 13 14 1-11 9 4 14-13-8-12 8 4-14-11-9 14-1z" fill="${b}"/>`,
  medal: (a, b) => `<path d="m33 12 31 8 31-8-8 43H41z" fill="${b}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><circle cx="64" cy="75" r="34" fill="${a}" stroke="#fff" stroke-width="9"/><polygon points="${starPoints(5,22,10,64)}" fill="${b}"/>`,
  flame: (a, b) => `<path d="M70 8c8 29-9 32-1 49 8-6 15-16 15-27 25 22 36 47 22 69-15 23-53 24-70 4-20-24-3-49 11-64 0 17 9 23 15 26C60 47 57 27 70 8z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M65 67c13 13 16 22 8 33-7 9-22 5-23-7-1-8 7-17 15-26z" fill="${b}"/>`,
  leaf: (a, b) => `<path d="M108 18C49 14 15 44 23 88c5 26 38 29 57 9 23-23 28-57 28-79z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M31 98q31-39 66-64M48 77l-2-22m22 2 2 17m-2 24 19-2" fill="none" stroke="${b}" stroke-width="7" stroke-linecap="round"/>`,
  moon: (a, b) => `<path d="M91 15a51 51 0 1 0 22 81A45 45 0 0 1 91 15z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><circle cx="38" cy="38" r="5" fill="${b}"/><circle cx="47" cy="57" r="4" fill="${b}"/>`,
  cloud: (a, b) => `<path d="M29 91a22 22 0 0 1-2-44 38 38 0 0 1 72-4 25 25 0 0 1 2 49z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M46 73q17-15 34 0" fill="none" stroke="${b}" stroke-width="7" stroke-linecap="round"/>`,
  diamond: (a, b) => `<path d="m64 9 53 42-53 68L11 51z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="m64 20 0 88M20 51h88M20 51l44 57 44-57" fill="none" stroke="${b}" stroke-width="6" stroke-linejoin="round"/>`,
  gift: (a, b) => `<path d="M25 52h78v60H25z" fill="${a}" stroke="#fff" stroke-width="8"/><path d="M18 36h92v23H18z" fill="${b}" stroke="#fff" stroke-width="8"/><path d="M64 37v74M64 36c-25 0-39-4-31-19 8-14 24-4 31 19zm0 0c25 0 39-4 31-19-8-14-24-4-31 19z" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>`,
  music: (a, b) => `<path d="M79 22v67a19 15 0 1 1-9-14V39l40-10v49a19 15 0 1 1-9-14V17z" fill="${a}" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><circle cx="41" cy="98" r="4" fill="${b}"/>`,
  badge: (a, b) => `<polygon points="${starPoints(16,56,48)}" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><circle cx="64" cy="64" r="31" fill="none" stroke="${b}" stroke-width="6"/><circle cx="64" cy="64" r="6" fill="${b}"/>`,
  flowerpot: (a, b) => `<path d="M29 66h70l-9 47H38z" fill="${a}" stroke="#fff" stroke-width="8"/><path d="M64 65V27m0 21C37 49 35 27 41 20c14-4 22 11 23 28zm0 1c27-1 30-23 23-30-14-3-22 12-23 30z" fill="${b}" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>`,
  target: (a, b) => `<circle cx="64" cy="64" r="52" fill="${a}" stroke="#fff" stroke-width="9"/><circle cx="64" cy="64" r="32" fill="none" stroke="${b}" stroke-width="8"/><circle cx="64" cy="64" r="11" fill="${b}"/><path d="m67 61 35-35m-15 0h15v15" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  smile: (a, b) => `<circle cx="64" cy="64" r="52" fill="${a}" stroke="#fff" stroke-width="9"/><circle cx="47" cy="52" r="5" fill="${b}"/><circle cx="81" cy="52" r="5" fill="${b}"/><path d="M39 71q25 34 50 0" fill="none" stroke="${b}" stroke-width="8" stroke-linecap="round"/>`,
}

const definitions: { id: string; name: string; category: StickerCategory; kind: keyof typeof artwork }[] = [
  { id: 'star', name: 'Bintang pop', category: 'Dekorasi', kind: 'star' },
  { id: 'sparkle', name: 'Kilau ganda', category: 'Dekorasi', kind: 'sparkle' },
  { id: 'heart', name: 'Hati berkilau', category: 'Ekspresi', kind: 'heart' },
  { id: 'bolt', name: 'Petir', category: 'Simbol', kind: 'bolt' },
  { id: 'flower', name: 'Bunga ceria', category: 'Dekorasi', kind: 'flower' },
  { id: 'crown', name: 'Mahkota', category: 'Badge', kind: 'crown' },
  { id: 'sun', name: 'Matahari senyum', category: 'Ekspresi', kind: 'sun' },
  { id: 'burst', name: 'Ledakan komik', category: 'Dekorasi', kind: 'burst' },
  { id: 'check', name: 'Lencana centang', category: 'Badge', kind: 'check' },
  { id: 'chat', name: 'Balon bicara', category: 'Simbol', kind: 'chat' },
  { id: 'arrow', name: 'Panah tebal', category: 'Simbol', kind: 'arrow' },
  { id: 'ribbon', name: 'Pita bintang', category: 'Badge', kind: 'ribbon' },
  { id: 'medal', name: 'Medali juara', category: 'Badge', kind: 'medal' },
  { id: 'flame', name: 'Api', category: 'Simbol', kind: 'flame' },
  { id: 'leaf', name: 'Daun', category: 'Dekorasi', kind: 'leaf' },
  { id: 'moon', name: 'Bulan sabit', category: 'Dekorasi', kind: 'moon' },
  { id: 'cloud', name: 'Awan', category: 'Dekorasi', kind: 'cloud' },
  { id: 'diamond', name: 'Kristal', category: 'Badge', kind: 'diamond' },
  { id: 'gift', name: 'Kado', category: 'Simbol', kind: 'gift' },
  { id: 'music', name: 'Not musik', category: 'Simbol', kind: 'music' },
  { id: 'badge', name: 'Segel bintang', category: 'Badge', kind: 'badge' },
  { id: 'flowerpot', name: 'Tanaman pot', category: 'Dekorasi', kind: 'flowerpot' },
  { id: 'target', name: 'Target fokus', category: 'Simbol', kind: 'target' },
  { id: 'smile', name: 'Wajah senang', category: 'Ekspresi', kind: 'smile' },
]

export const STICKERS: StickerAsset[] = definitions.map((sticker, index) => {
  const [primary, secondary] = palette[index % palette.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${artwork[sticker.kind](primary, secondary)}</svg>`
  return { id: sticker.id, name: sticker.name, category: sticker.category, svg }
})
