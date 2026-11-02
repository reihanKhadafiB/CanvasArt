import React from 'react'
import {
  MousePointer,
  Type,
  Square,
  Pencil,
  Image as ImageIcon,
  Grid,
  Magnet,
  Quote,
  Layers,
} from 'lucide-react'

interface ToolRailProps {
  tool: string
  grid: boolean
  snap: boolean
  onSetTool: (tool: 'select' | 'draw' | 'bezier' | 'bezier-edit' | 'erase') => void
  onAddText: () => void
  onAddShape: (shape: 'rect' | 'circle' | 'triangle' | 'star' | 'pentagon' | 'hexagon' | 'diamond' | 'line') => void
  onImportImageClick: () => void
  onToggleGrid: () => void
  onToggleSnap: () => void
  onOpenQuotes: () => void
  onScrollToLayers: () => void
}

export const ToolRail: React.FC<ToolRailProps> = ({
  tool,
  grid,
  snap,
  onSetTool,
  onAddText,
  onAddShape,
  onImportImageClick,
  onToggleGrid,
  onToggleSnap,
  onOpenQuotes,
  onScrollToLayers,
}) => {
  return (
    <aside className="tool-rail" aria-label="Toolbar alat">
      <button
        className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
        title="Alat Seleksi & Transformasi (V)"
        onClick={() => onSetTool('select')}
      >
        <MousePointer size={18} />
        <small>Pilih</small>
      </button>

      <button className="tool-btn" title="Tambah teks baru" onClick={onAddText}>
        <Type size={18} />
        <small>Teks</small>
      </button>

      <button className="tool-btn" title="Tambah bentuk persegi" onClick={() => onAddShape('rect')}>
        <Square size={18} />
        <small>Bentuk</small>
      </button>

      <button
        className={`tool-btn ${tool === 'draw' ? 'active' : ''}`}
        title="Gambar bebas dengan kuas"
        onClick={() => onSetTool('draw')}
      >
        <Pencil size={18} />
        <small>Gambar</small>
      </button>

      <button className="tool-btn" title="Impor gambar dari komputer" onClick={onImportImageClick}>
        <ImageIcon size={18} />
        <small>Impor</small>
      </button>

      <div className="rail-separator" />

      <button
        className={`tool-btn ${grid ? 'active' : ''}`}
        title={grid ? 'Sembunyikan grid' : 'Tampilkan grid kanvas'}
        onClick={onToggleGrid}
      >
        <Grid size={18} />
        <small>Grid</small>
      </button>

      <button
        className={`tool-btn ${snap ? 'active' : ''}`}
        title={snap ? 'Matikan snap to grid' : 'Aktifkan snap to grid'}
        onClick={onToggleSnap}
      >
        <Magnet size={18} />
        <small>Snap</small>
      </button>

      <div className="rail-spacer" />

      <button className="tool-btn" title="Pustaka kutipan inspiratif" onClick={onOpenQuotes}>
        <Quote size={18} />
        <small>Kutipan</small>
      </button>

      <button className="tool-btn" title="Buka panel layer" onClick={onScrollToLayers}>
        <Layers size={18} />
        <small>Layer</small>
      </button>
    </aside>
  )
}
