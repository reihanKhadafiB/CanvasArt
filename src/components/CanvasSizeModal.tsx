import { useState } from 'react'

interface CanvasSizeModalProps {
  show: boolean
  canvasWidth: number
  canvasHeight: number
  scaleContentsOnResize: boolean
  setScaleContentsOnResize: (scale: boolean) => void
  onClose: () => void
  onResize: (width: number, height: number) => void
}

const PRESETS: [string, number, number][] = [
  ['Square', 1080, 1080],
  ['Profile Picture', 800, 800],
  ['YouTube Thumbnail', 1280, 720],
  ['YouTube Channel Banner', 2560, 1440],
  ['Facebook Cover Art', 1640, 624],
  ['Google Header Image', 2120, 1192],
  ['Twitter Header Size', 1500, 500],
]

export function CanvasSizeModal({
  show,
  canvasWidth,
  canvasHeight,
  scaleContentsOnResize,
  setScaleContentsOnResize,
  onClose,
  onResize,
}: CanvasSizeModalProps) {
  const [width, setWidth] = useState(canvasWidth)
  const [height, setHeight] = useState(canvasHeight)

  if (!show) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card size-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">DOKUMEN</span>
            <h2>Ukuran kanvas</h2>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <div className="size-presets">
          {PRESETS.map(([name, w, h]) => (
            <button
              key={name}
              className="control-chip"
              onClick={() => {
                onResize(w, h)
                onClose()
              }}
            >
              {name} · {w}×{h}
            </button>
          ))}
        </div>
        <div className="size-fields">
          <label>
            Lebar
            <input
              type="number"
              min="16"
              max="8192"
              value={width}
              onChange={(e) => setWidth(Math.max(16, Math.min(8192, Number(e.target.value) || 16)))}
            />
          </label>
          <label>
            Tinggi
            <input
              type="number"
              min="16"
              max="8192"
              value={height}
              onChange={(e) => setHeight(Math.max(16, Math.min(8192, Number(e.target.value) || 16)))}
            />
          </label>
        </div>
        <label className="size-scale-option">
          <input
            type="checkbox"
            checked={scaleContentsOnResize}
            onChange={(e) => setScaleContentsOnResize(e.target.checked)}
          />{' '}
          Skalakan posisi dan objek mengikuti ukuran baru
        </label>
        <button
          className="primary-btn export-confirm"
          onClick={() => {
            onResize(width, height)
            onClose()
          }}
        >
          Terapkan ukuran
        </button>
        <small className="size-hint">Maks. 8192 px per sisi. Pilih opsi di atas untuk ikut menskalakan isi desain.</small>
      </div>
    </div>
  )
}
