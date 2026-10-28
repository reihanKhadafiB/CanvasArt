export type QuoteCategory = 'Motivation' | 'Success' | 'Friendship' | 'Happiness' | 'Inspiration' | 'Positivity' | 'Absurd'
export type QuoteLanguage = 'id' | 'en'

export interface QuoteEntry {
  id: string
  text: string
  category: QuoteCategory
  language: QuoteLanguage
}

// Original short copy written for CanvasArt; no remote quote service or third-party text corpus.
export const QUOTES: QuoteEntry[] = [
  { id: 'm-id-1', text: 'Mulai dari yang bisa kamu lakukan hari ini.', category: 'Motivation', language: 'id' },
  { id: 'm-id-2', text: 'Langkah kecil tetap membawa kita ke depan.', category: 'Motivation', language: 'id' },
  { id: 'm-id-3', text: 'Berani mencoba adalah awal perubahan.', category: 'Motivation', language: 'id' },
  { id: 'm-en-1', text: 'Begin with what you can do today.', category: 'Motivation', language: 'en' },
  { id: 'm-en-2', text: 'Small steps still move you forward.', category: 'Motivation', language: 'en' },
  { id: 'm-en-3', text: 'Trying bravely is the start of change.', category: 'Motivation', language: 'en' },
  { id: 's-id-1', text: 'Ketekunan membuat kemajuan terasa nyata.', category: 'Success', language: 'id' },
  { id: 's-id-2', text: 'Rayakan proses, bukan hanya garis akhir.', category: 'Success', language: 'id' },
  { id: 's-id-3', text: 'Hasil baik tumbuh dari kebiasaan baik.', category: 'Success', language: 'id' },
  { id: 's-en-1', text: 'Consistency makes progress visible.', category: 'Success', language: 'en' },
  { id: 's-en-2', text: 'Celebrate the work, not only the finish.', category: 'Success', language: 'en' },
  { id: 's-en-3', text: 'Good outcomes grow from good habits.', category: 'Success', language: 'en' },
  { id: 'f-id-1', text: 'Teman baik membuat perjalanan terasa ringan.', category: 'Friendship', language: 'id' },
  { id: 'f-id-2', text: 'Tawa bersama adalah bahasa persahabatan.', category: 'Friendship', language: 'id' },
  { id: 'f-id-3', text: 'Kehadiranmu membuat hari biasa jadi cerita.', category: 'Friendship', language: 'id' },
  { id: 'f-en-1', text: 'Good friends make the road feel lighter.', category: 'Friendship', language: 'en' },
  { id: 'f-en-2', text: 'Shared laughter speaks every language.', category: 'Friendship', language: 'en' },
  { id: 'f-en-3', text: 'You make an ordinary day a story.', category: 'Friendship', language: 'en' },
  { id: 'h-id-1', text: 'Bahagia sering bersembunyi dalam hal sederhana.', category: 'Happiness', language: 'id' },
  { id: 'h-id-2', text: 'Nikmati jeda kecil di antara kesibukan.', category: 'Happiness', language: 'id' },
  { id: 'h-id-3', text: 'Syukur memberi ruang bagi rasa cukup.', category: 'Happiness', language: 'id' },
  { id: 'h-en-1', text: 'Happiness often hides in simple things.', category: 'Happiness', language: 'en' },
  { id: 'h-en-2', text: 'Enjoy the little pauses in a busy day.', category: 'Happiness', language: 'en' },
  { id: 'h-en-3', text: 'Gratitude makes room for enough.', category: 'Happiness', language: 'en' },
  { id: 'i-id-1', text: 'Ide baru tumbuh saat kita berani melihat ulang.', category: 'Inspiration', language: 'id' },
  { id: 'i-id-2', text: 'Buat sesuatu yang terasa seperti dirimu.', category: 'Inspiration', language: 'id' },
  { id: 'i-id-3', text: 'Imajinasi memberi warna pada kemungkinan.', category: 'Inspiration', language: 'id' },
  { id: 'i-en-1', text: 'New ideas grow when we look again.', category: 'Inspiration', language: 'en' },
  { id: 'i-en-2', text: 'Make something that feels like you.', category: 'Inspiration', language: 'en' },
  { id: 'i-en-3', text: 'Imagination colors what could be.', category: 'Inspiration', language: 'en' },
  { id: 'p-id-1', text: 'Satu kebaikan kecil bisa mengubah suasana.', category: 'Positivity', language: 'id' },
  { id: 'p-id-2', text: 'Hari ini masih punya kemungkinan baik.', category: 'Positivity', language: 'id' },
  { id: 'p-id-3', text: 'Pilih kata yang membuat ruang terasa hangat.', category: 'Positivity', language: 'id' },
  { id: 'p-en-1', text: 'One small kindness can shift the mood.', category: 'Positivity', language: 'en' },
  { id: 'p-en-2', text: 'Today still holds good possibilities.', category: 'Positivity', language: 'en' },
  { id: 'p-en-3', text: 'Choose words that warm the room.', category: 'Positivity', language: 'en' },
  { id: 'a-id-1', text: 'Kalau ragu, tanya dulu pada tanaman.', category: 'Absurd', language: 'id' },
  { id: 'a-id-2', text: 'Rapat ini disponsori oleh biskuit terakhir.', category: 'Absurd', language: 'id' },
  { id: 'a-id-3', text: 'Aku bukan terlambat, aku versi director’s cut.', category: 'Absurd', language: 'id' },
  { id: 'a-en-1', text: 'When in doubt, ask a houseplant.', category: 'Absurd', language: 'en' },
  { id: 'a-en-2', text: 'This meeting is sponsored by the last cookie.', category: 'Absurd', language: 'en' },
  { id: 'a-en-3', text: 'I am not late; I am the director’s cut.', category: 'Absurd', language: 'en' },
]
