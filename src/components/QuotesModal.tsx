import { useMemo, useState } from 'react'
import { QUOTES } from '../quotes'
import type { QuoteCategory, QuoteEntry, QuoteLanguage } from '../quotes'

interface QuotesModalProps {
  show: boolean
  onClose: () => void
  onAddQuote: (quote: QuoteEntry) => void
}

export function QuotesModal({ show, onClose, onAddQuote }: QuotesModalProps) {
  const [quoteSearch, setQuoteSearch] = useState('')
  const [quoteCategory, setQuoteCategory] = useState<'all' | QuoteCategory>('all')
  const [quoteLanguage, setQuoteLanguage] = useState<'all' | QuoteLanguage>('all')
  const [showFavoriteQuotesOnly, setShowFavoriteQuotesOnly] = useState(false)
  const [favoriteQuotes, setFavoriteQuotes] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('canvasart-favorite-quotes-v1')
      return stored ? (JSON.parse(stored) as string[]) : []
    } catch {
      return []
    }
  })

  const toggleQuoteFavorite = (id: string) => {
    setFavoriteQuotes((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
      try {
        localStorage.setItem('canvasart-favorite-quotes-v1', JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const visibleQuotes = useMemo(() => {
    const query = quoteSearch.trim().toLowerCase()
    return QUOTES.filter(
      (quote) =>
        (!query || quote.text.toLowerCase().includes(query)) &&
        (quoteCategory === 'all' || quote.category === quoteCategory) &&
        (quoteLanguage === 'all' || quote.language === quoteLanguage) &&
        (!showFavoriteQuotesOnly || favoriteQuotes.includes(quote.id)),
    )
  }, [quoteSearch, quoteCategory, quoteLanguage, showFavoriteQuotesOnly, favoriteQuotes])

  if (!show) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card quote-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">PUSTAKA LOKAL · {QUOTES.length}</span>
            <h2>Kutipan</h2>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <p className="modal-intro">Pilih kutipan orisinal CanvasArt untuk menambahkannya sebagai teks yang bisa diedit.</p>
        <input
          className="quote-search"
          type="search"
          value={quoteSearch}
          onChange={(e) => setQuoteSearch(e.target.value)}
          placeholder="Cari kutipan…"
          aria-label="Cari kutipan"
        />
        <div className="quote-filters">
          <select
            aria-label="Kategori kutipan"
            value={quoteCategory}
            onChange={(e) => setQuoteCategory(e.target.value as 'all' | QuoteCategory)}
          >
            <option value="all">Semua kategori</option>
            {['Motivation', 'Success', 'Friendship', 'Happiness', 'Inspiration', 'Positivity', 'Absurd'].map(
              (category) => (
                <option key={category}>{category}</option>
              ),
            )}
          </select>
          <select
            aria-label="Bahasa kutipan"
            value={quoteLanguage}
            onChange={(e) => setQuoteLanguage(e.target.value as 'all' | QuoteLanguage)}
          >
            <option value="all">Semua bahasa</option>
            <option value="id">Indonesia</option>
            <option value="en">English</option>
          </select>
          <button
            className={`control-chip ${showFavoriteQuotesOnly ? 'chip-active' : ''}`}
            onClick={() => setShowFavoriteQuotesOnly(!showFavoriteQuotesOnly)}
          >
            ★ Favorit
          </button>
        </div>
        <div className="quote-list">
          {visibleQuotes.map((quote) => (
            <div className="quote-row" key={quote.id}>
              <button
                className="quote-choice"
                onClick={() => {
                  onAddQuote(quote)
                  onClose()
                }}
              >
                <span>“{quote.text}”</span>
                <small>
                  {quote.category} · {quote.language === 'id' ? 'Indonesia' : 'English'}
                </small>
              </button>
              <button
                className={`quote-favorite ${favoriteQuotes.includes(quote.id) ? 'is-favorite' : ''}`}
                aria-label={favoriteQuotes.includes(quote.id) ? 'Hapus dari favorit' : 'Tambahkan ke favorit'}
                title={favoriteQuotes.includes(quote.id) ? 'Hapus favorit' : 'Jadikan favorit'}
                onClick={() => toggleQuoteFavorite(quote.id)}
              >
                {favoriteQuotes.includes(quote.id) ? '★' : '☆'}
              </button>
            </div>
          ))}
          {visibleQuotes.length === 0 && <div className="quote-empty">Tidak ada kutipan yang cocok.</div>}
        </div>
      </div>
    </div>
  )
}
