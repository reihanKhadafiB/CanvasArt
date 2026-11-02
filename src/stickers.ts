export type StickerCategory = 'Badge' | 'Dekorasi' | 'Ekspresi' | 'Simbol'
export type StickerAsset = { id: string; name: string; category: StickerCategory; svg: string }

const palette = [
  ['#ff6b6b', '#ffe08a'], ['#5268dc', '#a8c7ff'], ['#f59e0b', '#fff0a8'], ['#14b8a6', '#a7f3d0'],
  ['#a855f7', '#e9d5ff'], ['#ec4899', '#fbcfe8'], ['#22c55e', '#bbf7d0'], ['#0ea5e9', '#bae6fd'],
  ['#6366f1', '#e0e7ff'], ['#f43f5e', '#ffe4e6'], ['#8b5cf6', '#ede9fe'], ['#10b981', '#d1fae5'],
]

const starPoints = (points: number, outer: number, inner: number, center = 64) =>
  Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 ? inner : outer
    const angle = -Math.PI / 2 + (index * Math.PI) / points
    return `${(center + Math.cos(angle) * radius).toFixed(1)},${(center + Math.sin(angle) * radius).toFixed(1)}`
  }).join(' ')

const artwork: Record<string, (a: string, b: string) => string> = {
  star: (a, b) => `<polygon points="${starPoints(5, 55, 25)}" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M43 40l4 9 9 2-8 5-1 10-6-8-10 1 6-8-4-9z" fill="${b}"/>`,
  sparkle: (a, b) => `<path d="M48 12c4 29 12 37 40 42-28 5-36 13-40 42-5-29-13-37-41-42 28-5 36-13 41-42z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M98 69c3 17 8 22 24 25-16 3-21 8-24 25-3-17-8-22-24-25 16-3 21-8 24-25z" fill="${b}" stroke="#fff" stroke-width="6"/>`,
  heart: (a, b) => `<path d="M64 111 21 71C-4 45 17 12 43 22c10 4 17 13 21 20 8-17 23-26 39-20 26 10 27 40 5 61z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M33 43c4-8 12-11 19-8" fill="none" stroke="${b}" stroke-width="8" stroke-linecap="round"/>`,
  bolt: (a, b) => `<path d="M73 8 25 72h30l-7 48 55-72H72z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="m67 27-21 36h20l-4 25 24-35H65z" fill="${b}"/>`,
  flower: (a, b) => `${Array.from({ length: 8 }, (_, i) => `<ellipse cx="64" cy="31" rx="17" ry="25" fill="${a}" stroke="#fff" stroke-width="6" transform="rotate(${i * 45} 64 64)"/>`).join('')}<circle cx="64" cy="64" r="21" fill="${b}" stroke="#fff" stroke-width="7"/><circle cx="58" cy="58" r="4" fill="#fff"/>`,
  crown: (a, b) => `<path d="m18 42 27 21 19-40 20 40 27-21-11 61H29z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M31 88h66l-3 10H33z" fill="${b}"/><circle cx="18" cy="38" r="8" fill="${b}"/><circle cx="64" cy="20" r="8" fill="${b}"/><circle cx="110" cy="38" r="8" fill="${b}"/>`,
  sun: (a, b) => `<g stroke="#fff" stroke-width="8" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => `<path d="M64 7v14" transform="rotate(${i * 45} 64 64)"/>`).join('')}</g><circle cx="64" cy="64" r="35" fill="${a}" stroke="#fff" stroke-width="8"/><circle cx="52" cy="56" r="4" fill="${b}"/><circle cx="76" cy="56" r="4" fill="${b}"/><path d="M51 72q13 14 26 0" fill="none" stroke="${b}" stroke-width="6" stroke-linecap="round"/>`,
  burst: (a, b) => `<polygon points="${starPoints(12, 59, 39)}" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M47 48h34M47 63h34M47 78h25" stroke="${b}" stroke-width="7" stroke-linecap="round"/>`,
  check: (a, b) => `<path d="M64 9 78 18l17-1 8 15 15 8-1 18 9 15-10 14-2 17-17 6-12 12-17-7-17 3-10-14-15-8 2-18-8-15 11-13 3-17 17-5z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="m37 66 17 17 37-39" fill="none" stroke="${b}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
  chat: (a, b) => `<path d="M19 25q0-13 14-13h62q14 0 14 13v48q0 13-14 13H56l-25 19 4-19q-16-2-16-15z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M42 43h39M42 59h27" stroke="${b}" stroke-width="8" stroke-linecap="round"/>`,
  arrow: (a, b) => `<path d="M17 55h58V31l38 33-38 33V73H17z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M28 63h38" stroke="${b}" stroke-width="5" stroke-linecap="round"/>`,
  ribbon: (a, b) => `<path d="m43 66-13 48 34-20 34 20-13-48" fill="${b}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><circle cx="64" cy="48" r="39" fill="${a}" stroke="#fff" stroke-width="9"/><circle cx="64" cy="48" r="25" fill="none" stroke="${b}" stroke-width="5"/><path d="m64 28 6 13 14 1-11 9 4 14-13-8-12 8 4-14-11-9 14-1z" fill="${b}"/>`,
  medal: (a, b) => `<path d="m33 12 31 8 31-8-8 43H41z" fill="${b}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><circle cx="64" cy="75" r="34" fill="${a}" stroke="#fff" stroke-width="9"/><polygon points="${starPoints(5, 22, 10, 64)}" fill="${b}"/>`,
  flame: (a, b) => `<path d="M70 8c8 29-9 32-1 49 8-6 15-16 15-27 25 22 36 47 22 69-15 23-53 24-70 4-20-24-3-49 11-64 0 17 9 23 15 26C60 47 57 27 70 8z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M65 67c13 13 16 22 8 33-7 9-22 5-23-7-1-8 7-17 15-26z" fill="${b}"/>`,
  leaf: (a, b) => `<path d="M108 18C49 14 15 44 23 88c5 26 38 29 57 9 23-23 28-57 28-79z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M31 98q31-39 66-64M48 77l-2-22m22 2 2 17m-2 24 19-2" fill="none" stroke="${b}" stroke-width="7" stroke-linecap="round"/>`,
  moon: (a, b) => `<path d="M91 15a51 51 0 1 0 22 81A45 45 0 0 1 91 15z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><circle cx="38" cy="38" r="5" fill="${b}"/><circle cx="47" cy="57" r="4" fill="${b}"/>`,
  cloud: (a, b) => `<path d="M29 91a22 22 0 0 1-2-44 38 38 0 0 1 72-4 25 25 0 0 1 2 49z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M46 73q17-15 34 0" fill="none" stroke="${b}" stroke-width="7" stroke-linecap="round"/>`,
  diamond: (a, b) => `<path d="m64 9 53 42-53 68L11 51z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="m64 20 0 88M20 51h88M20 51l44 57 44-57" fill="none" stroke="${b}" stroke-width="6" stroke-linejoin="round"/>`,
  gift: (a, b) => `<path d="M25 52h78v60H25z" fill="${a}" stroke="#fff" stroke-width="8"/><path d="M18 36h92v23H18z" fill="${b}" stroke="#fff" stroke-width="8"/><path d="M64 37v74M64 36c-25 0-39-4-31-19 8-14 24-4 31 19zm0 0c25 0 39-4 31-19-8-14-24-4-31 19z" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>`,
  music: (a, b) => `<path d="M79 22v67a19 15 0 1 1-9-14V39l40-10v49a19 15 0 1 1-9-14V17z" fill="${a}" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><circle cx="41" cy="98" r="4" fill="${b}"/>`,
  badge: (a, b) => `<polygon points="${starPoints(16, 56, 48)}" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><circle cx="64" cy="64" r="31" fill="none" stroke="${b}" stroke-width="6"/><circle cx="64" cy="64" r="6" fill="${b}"/>`,
  flowerpot: (a, b) => `<path d="M29 66h70l-9 47H38z" fill="${a}" stroke="#fff" stroke-width="8"/><path d="M64 65V27m0 21C37 49 35 27 41 20c14-4 22 11 23 28zm0 1c27-1 30-23 23-30-14-3-22 12-23 30z" fill="${b}" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>`,
  target: (a, b) => `<circle cx="64" cy="64" r="52" fill="${a}" stroke="#fff" stroke-width="9"/><circle cx="64" cy="64" r="32" fill="none" stroke="${b}" stroke-width="8"/><circle cx="64" cy="64" r="11" fill="${b}"/><path d="m67 61 35-35m-15 0h15v15" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  smile: (a, b) => `<circle cx="64" cy="64" r="52" fill="${a}" stroke="#fff" stroke-width="9"/><circle cx="47" cy="52" r="5" fill="${b}"/><circle cx="81" cy="52" r="5" fill="${b}"/><path d="M39 71q25 34 50 0" fill="none" stroke="${b}" stroke-width="8" stroke-linecap="round"/>`,
  trophy: (a, b) => `<path d="M32 20h64v34c0 18-14 32-32 32s-32-14-32-32V20z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M32 30H16c0 16 10 24 18 26M96 30h16c0 16-10 24-18 26M64 86v18M42 104h44" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/><circle cx="64" cy="46" r="12" fill="${b}"/>`,
  shield: (a, b) => `<path d="M64 14 26 28v36c0 30 38 48 38 48s38-18 38-48V28L64 14z" fill="${a}" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M64 30v66c20-14 26-30 26-44V36L64 30z" fill="${b}"/>`,
  rocket: (a, b) => `<path d="M64 12c-20 20-22 56-22 56l44 0s-2-36-22-56z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M42 68 24 86v10l18-4M86 68l18 18v10l-18-4M52 94h24l-12 22z" fill="${b}" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><circle cx="64" cy="42" r="8" fill="${b}"/>`,
  lightbulb: (a, b) => `<path d="M64 16a36 36 0 0 0-24 62c6 6 8 12 8 18h32c0-6 2-12 8-18a36 36 0 0 0-24-62z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M48 102h32v8H48z" fill="${b}" stroke="#fff" stroke-width="6"/><path d="M54 44q10-10 20 0" fill="none" stroke="${b}" stroke-width="6" stroke-linecap="round"/>`,
  camera: (a, b) => `<rect x="18" y="36" width="92" height="66" rx="14" fill="${a}" stroke="#fff" stroke-width="8"/><path d="M42 36l6-14h32l6 14z" fill="${b}" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><circle cx="64" cy="69" r="20" fill="${b}" stroke="#fff" stroke-width="7"/><circle cx="92" cy="48" r="4" fill="#fff"/>`,
  coffee: (a, b) => `<path d="M24 38h64v42a22 22 0 0 1-22 22H46a22 22 0 0 1-22-22V38z" fill="${a}" stroke="#fff" stroke-width="8"/><path d="M88 48h14a14 14 0 0 1 0 28H88" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/><path d="M40 18q6 10 0 16M60 18q6 10 0 16" fill="none" stroke="${b}" stroke-width="6" stroke-linecap="round"/>`,
  gamepad: (a, b) => `<rect x="16" y="38" width="96" height="56" rx="26" fill="${a}" stroke="#fff" stroke-width="8"/><path d="M38 52v20M28 62h20" stroke="#fff" stroke-width="7" stroke-linecap="round"/><circle cx="82" cy="56" r="6" fill="${b}"/><circle cx="94" cy="68" r="6" fill="${b}"/>`,
  bell: (a, b) => `<path d="M64 18c-18 0-26 18-26 38 0 16-8 22-8 22h68s-8-6-8-22c0-20-8-38-26-38z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><circle cx="64" cy="88" r="9" fill="${b}" stroke="#fff" stroke-width="6"/><path d="M58 18a6 6 0 0 1 12 0" fill="none" stroke="#fff" stroke-width="6"/>`,
  palette_art: (a, b) => `<path d="M64 16C36 16 16 36 16 64c0 24 16 48 38 48 10 0 12-8 12-14 0-6-4-10 6-12 18-4 40-10 40-36 0-19-20-34-48-34z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><circle cx="38" cy="48" r="6" fill="${b}"/><circle cx="56" cy="34" r="6" fill="${b}"/><circle cx="78" cy="40" r="6" fill="${b}"/><circle cx="86" cy="60" r="6" fill="${b}"/>`,
  wink: (a, b) => `<circle cx="64" cy="64" r="52" fill="${a}" stroke="#fff" stroke-width="9"/><circle cx="46" cy="52" r="5" fill="${b}"/><path d="M72 52l18 0" stroke="${b}" stroke-width="7" stroke-linecap="round"/><path d="M42 74q22 26 44 0" fill="none" stroke="${b}" stroke-width="8" stroke-linecap="round"/>`,
  cool: (a, b) => `<circle cx="64" cy="64" r="52" fill="${a}" stroke="#fff" stroke-width="9"/><path d="M26 48h76v16c0 10-8 18-18 18H44c-10 0-18-8-18-18V48z" fill="#1e293b" stroke="#fff" stroke-width="7"/><path d="M44 86q20 18 40 0" fill="none" stroke="${b}" stroke-width="7" stroke-linecap="round"/>`,
  tag_price: (a, b) => `<path d="M20 64 64 20h44v44L64 108 20 64z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><circle cx="86" cy="42" r="7" fill="${b}" stroke="#fff" stroke-width="5"/>`,
  rainbow: (a, b) => `<path d="M20 96a44 44 0 0 1 88 0" fill="none" stroke="${a}" stroke-width="16" stroke-linecap="round"/><path d="M36 96a28 28 0 0 1 56 0" fill="none" stroke="${b}" stroke-width="14" stroke-linecap="round"/>`,
  umbrella: (a, b) => `<path d="M20 72c0-26 20-46 44-46s44 20 44 46H20z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><path d="M64 24v58a12 12 0 0 1-24 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M44 72a20 20 0 0 0 40 0" fill="${b}"/>`,
  pin: (a, b) => `<path d="M64 14c-18 0-32 14-32 32 0 24 32 68 32 68s32-44 32-68c0-18-14-32-32-32z" fill="${a}" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><circle cx="64" cy="46" r="12" fill="${b}"/>`,
  compass: (a, b) => `<circle cx="64" cy="64" r="50" fill="${a}" stroke="#fff" stroke-width="8"/><path d="M64 22 76 60 64 74 52 60z" fill="#ef4444" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="M64 106 52 68 64 54 76 68z" fill="${b}" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>`,
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
  { id: 'trophy', name: 'Piala juara', category: 'Badge', kind: 'trophy' },
  { id: 'shield', name: 'Perisai bintang', category: 'Badge', kind: 'shield' },
  { id: 'rocket', name: 'Roket peluncur', category: 'Simbol', kind: 'rocket' },
  { id: 'lightbulb', name: 'Bohlam ide', category: 'Simbol', kind: 'lightbulb' },
  { id: 'camera', name: 'Kamera foto', category: 'Simbol', kind: 'camera' },
  { id: 'coffee', name: 'Cangkir kopi', category: 'Dekorasi', kind: 'coffee' },
  { id: 'gamepad', name: 'Game arcade', category: 'Simbol', kind: 'gamepad' },
  { id: 'bell', name: 'Lonceng peringatan', category: 'Simbol', kind: 'bell' },
  { id: 'palette_art', name: 'Palet lukis', category: 'Dekorasi', kind: 'palette_art' },
  { id: 'wink', name: 'Wajah berkedip', category: 'Ekspresi', kind: 'wink' },
  { id: 'cool', name: 'Kacamata keren', category: 'Ekspresi', kind: 'cool' },
  { id: 'tag_price', name: 'Label diskon', category: 'Badge', kind: 'tag_price' },
  { id: 'rainbow', name: 'Pelangi ceria', category: 'Dekorasi', kind: 'rainbow' },
  { id: 'umbrella', name: 'Payung hujan', category: 'Dekorasi', kind: 'umbrella' },
  { id: 'pin', name: 'Jarum lokasi', category: 'Simbol', kind: 'pin' },
  { id: 'compass', name: 'Kompas petualang', category: 'Simbol', kind: 'compass' },
]

export const STICKERS: StickerAsset[] = definitions.map((sticker, index) => {
  const [primary, secondary] = palette[index % palette.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${artwork[sticker.kind](primary, secondary)}</svg>`
  return { id: sticker.id, name: sticker.name, category: sticker.category, svg }
})
