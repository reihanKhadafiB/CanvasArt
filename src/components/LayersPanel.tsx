import React from 'react'
import type { FabricObject } from 'fabric'
import {
  Layers,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  FolderPlus,
  Layers as MergeIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Type,
  Image as ImageIcon,
  Square,
} from 'lucide-react'
import { getObjectName } from '../utils/object'

interface LayersPanelProps {
  objects: FabricObject[]
  selected: FabricObject | null
  checkedLayers: FabricObject[]
  onSelectObject: (object: FabricObject) => void
  onAddText: () => void
  onToggleCheck: (object: FabricObject) => void
  onRenameLayer: (object: FabricObject, name: string) => void
  onToggleVisibility: (object: FabricObject) => void
  onToggleLock: (object: FabricObject) => void
  onDeleteChecked: () => void
  onGroupChecked: () => void
  onMergeChecked: () => void
  onAlignChecked: (
    mode: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'distributeX' | 'distributeY'
  ) => void
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  objects,
  selected,
  checkedLayers,
  onSelectObject,
  onAddText,
  onToggleCheck,
  onRenameLayer,
  onToggleVisibility,
  onToggleLock,
  onDeleteChecked,
  onGroupChecked,
  onMergeChecked,
  onAlignChecked,
}) => {
  return (
    <div className="layers-panel">
      <div className="layers-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={14} />
          <h3>Layers</h3>
        </div>
        <span>{objects.length}</span>
        <button title="Tambah teks" onClick={onAddText} aria-label="Tambah teks">
          <Plus size={14} />
        </button>
      </div>

      {checkedLayers.length > 0 && (
        <>
          <div className="layer-bulk-actions">
            <span>{checkedLayers.length} dipilih</span>
            <button onClick={onDeleteChecked} title="Hapus layer terpilih">
              <Trash2 size={13} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
              Hapus
            </button>
            <button disabled={checkedLayers.length < 2} onClick={onGroupChecked} title="Kelompokkan layer terpilih">
              <FolderPlus size={13} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
              Grup
            </button>
            <button disabled={checkedLayers.length < 2} onClick={onMergeChecked} title="Gabungkan layer menjadi raster">
              <MergeIcon size={13} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
              Gabungkan
            </button>
          </div>
          <div className="layer-align-actions">
            <button onClick={() => onAlignChecked('left')} title="Rata kiri">
              <AlignLeft size={13} />
            </button>
            <button onClick={() => onAlignChecked('centerX')} title="Rata tengah horizontal">
              <AlignCenter size={13} />
            </button>
            <button onClick={() => onAlignChecked('right')} title="Rata kanan">
              <AlignRight size={13} />
            </button>
            <button onClick={() => onAlignChecked('top')} title="Rata atas">
              <AlignStartVertical size={13} />
            </button>
            <button onClick={() => onAlignChecked('centerY')} title="Rata tengah vertikal">
              <AlignCenterVertical size={13} />
            </button>
            <button onClick={() => onAlignChecked('bottom')} title="Rata bawah">
              <AlignEndVertical size={13} />
            </button>
            <button
              disabled={checkedLayers.length < 3}
              onClick={() => onAlignChecked('distributeX')}
              title="Sebar horizontal (min 3 layer)"
            >
              <AlignHorizontalDistributeCenter size={13} />
            </button>
            <button
              disabled={checkedLayers.length < 3}
              onClick={() => onAlignChecked('distributeY')}
              title="Sebar vertikal (min 3 layer)"
            >
              <AlignVerticalDistributeCenter size={13} />
            </button>
          </div>
        </>
      )}

      <div className="layer-list">
        {[...objects].reverse().map((object, reverseIndex) => {
          const index = objects.length - reverseIndex - 1
          const attrs = object as FabricObject & { name?: string; visible?: boolean; selectable?: boolean; id?: string }
          const isSelected = selected === object
          const isText = ['i-text', 'text', 'textbox'].includes(object.type || '')
          const isImage = object.type === 'image'
          const isVisible = attrs.visible !== false
          const isLocked = attrs.selectable === false

          return (
            <div
              className={`layer-row ${isSelected ? 'layer-selected' : ''}`}
              key={String(attrs.id || index)}
              onClick={() => onSelectObject(object)}
            >
              <input
                className="layer-check"
                type="checkbox"
                aria-label={`Pilih layer ${getObjectName(object, index)}`}
                checked={checkedLayers.includes(object)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggleCheck(object)}
              />
              <span className="layer-type" title={isText ? 'Teks' : isImage ? 'Gambar' : 'Bentuk / Objek'}>
                {isText ? <Type size={12} /> : isImage ? <ImageIcon size={12} /> : <Square size={12} />}
              </span>
              <input
                aria-label="Nama layer"
                value={getObjectName(object, index)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onRenameLayer(object, e.target.value)}
              />
              <button
                type="button"
                title={isVisible ? 'Sembunyikan layer' : 'Tampilkan layer'}
                aria-label={isVisible ? 'Sembunyikan layer' : 'Tampilkan layer'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleVisibility(object)
                }}
              >
                {isVisible ? <Eye size={13} /> : <EyeOff size={13} style={{ opacity: 0.5 }} />}
              </button>
              <button
                type="button"
                title={isLocked ? 'Buka kunci layer' : 'Kunci layer'}
                aria-label={isLocked ? 'Buka kunci layer' : 'Kunci layer'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLock(object)
                }}
              >
                {isLocked ? <Lock size={13} /> : <Unlock size={13} style={{ opacity: 0.5 }} />}
              </button>
            </div>
          )
        })}
        {!objects.length && <div className="layers-empty">Objek akan muncul di sini</div>}
      </div>
    </div>
  )
}
