import React from 'react'
import { Plus, Undo2, Redo2, FolderOpen, Save, Share2, Download, MoreHorizontal } from 'lucide-react'

interface TopBarProps {
  projectName: string
  setProjectName: (name: string) => void
  status: string
  onShowAddMenu: () => void
  onUndo: () => void
  onRedo: () => void
  onOpenProjectClick: () => void
  onOpenProjectFile: (file?: File) => void
  onSaveProject: () => void
  onShare: () => void
  onOpenExport: () => void
  onShowMenu: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName,
  setProjectName,
  status,
  onShowAddMenu,
  onUndo,
  onRedo,
  onOpenProjectClick,
  onOpenProjectFile,
  onSaveProject,
  onShare,
  onOpenExport,
  onShowMenu,
}) => {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">C</div>
        <span>
          Canvas<span className="brand-accent">Art</span>
        </span>
        <span className="beta-tag">LOCAL</span>
      </div>

      <div className="project-title">
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          aria-label="Nama proyek"
        />
        <span className="save-state">
          <i />
          {status}
        </span>
      </div>

      <div className="top-actions">
        <button className="quiet-btn" onClick={onShowAddMenu} title="Tambah elemen ke kanvas">
          <Plus size={15} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
          Tambah
        </button>
        <button className="icon-btn" title="Undo (Ctrl+Z)" onClick={onUndo} aria-label="Undo">
          <Undo2 size={16} />
        </button>
        <button className="icon-btn" title="Redo (Ctrl+Y)" onClick={onRedo} aria-label="Redo">
          <Redo2 size={16} />
        </button>
        <span className="toolbar-divider" />
        <button className="quiet-btn" onClick={onOpenProjectClick} title="Buka proyek .canvasart">
          <FolderOpen size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
          Buka
        </button>
        <input
          id="open-project"
          className="hidden-input"
          type="file"
          accept=".canvasart,.zip"
          onChange={(e) => {
            onOpenProjectFile(e.target.files?.[0])
            e.currentTarget.value = ''
          }}
        />
        <button className="quiet-btn" onClick={onSaveProject} title="Simpan proyek lokal">
          <Save size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
          Simpan
        </button>
        <button className="quiet-btn share-btn" title="Bagikan gambar" onClick={onShare}>
          <Share2 size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
          Bagikan
        </button>
        <button className="primary-btn" onClick={onOpenExport} title="Ekspor file gambar">
          <Download size={15} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
          Ekspor
        </button>
        <button className="more-btn" title="Menu proyek" onClick={onShowMenu} aria-label="Menu proyek">
          <MoreHorizontal size={18} />
        </button>
      </div>
    </header>
  )
}
