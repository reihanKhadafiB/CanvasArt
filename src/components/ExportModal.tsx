interface ExportModalProps {
  show: boolean
  onClose: () => void
  projectName: string
  canvasWidth: number
  canvasHeight: number
  exportFormat: 'png' | 'jpeg'
  setExportFormat: (format: 'png' | 'jpeg') => void
  exportJpegQuality: number
  setExportJpegQuality: (quality: number) => void
  exportScale: number
  setExportScale: (scale: number) => void
  exportCustomDimensions: boolean
  setExportCustomDimensions: (custom: boolean) => void
  exportCustomWidth: number
  setExportCustomWidth: React.Dispatch<React.SetStateAction<number>>
  exportCustomHeight: number
  setExportCustomHeight: React.Dispatch<React.SetStateAction<number>>
  exportFit: 'contain' | 'stretch'
  setExportFit: (fit: 'contain' | 'stretch') => void
  exportPreviewUrl: string
  exportPreviewLoading: boolean
  exportPreviewError: string
  onExport: (share?: boolean) => void
}

export function ExportModal({
  show,
  onClose,
  projectName,
  canvasWidth,
  canvasHeight,
  exportFormat,
  setExportFormat,
  exportJpegQuality,
  setExportJpegQuality,
  exportScale,
  setExportScale,
  exportCustomDimensions,
  setExportCustomDimensions,
  exportCustomWidth,
  setExportCustomWidth,
  exportCustomHeight,
  setExportCustomHeight,
  exportFit,
  setExportFit,
  exportPreviewUrl,
  exportPreviewLoading,
  exportPreviewError,
  onExport,
}: ExportModalProps) {
  if (!show) return null

  const displayWidth = exportCustomDimensions
    ? Math.max(16, Math.min(8192, Math.round(exportCustomWidth)))
    : Math.round(canvasWidth * exportScale)

  const displayHeight = exportCustomDimensions
    ? Math.max(16, Math.min(8192, Math.round(exportCustomHeight)))
    : Math.round(canvasHeight * exportScale)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">SIMPAN HASIL</span>
            <h2>Ekspor desain</h2>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <label className="modal-label">
          Format
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as 'png' | 'jpeg')}>
            <option value="png">PNG · transparan</option>
            <option value="jpeg">JPEG · kualitas tinggi</option>
          </select>
        </label>
        {exportFormat === 'jpeg' && (
          <label className="modal-label">
            Kualitas JPEG · {Math.round(exportJpegQuality * 100)}%
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={exportJpegQuality}
              onChange={(e) => setExportJpegQuality(Number(e.target.value))}
            />
          </label>
        )}
        <label className="modal-label">
          Ukuran
          <select value={exportScale} onChange={(e) => setExportScale(Number(e.target.value))}>
            <option value="0.5">Low · {Math.round(canvasWidth * 0.5)} × {Math.round(canvasHeight * 0.5)} px</option>
            <option value="0.75">Medium · {Math.round(canvasWidth * 0.75)} × {Math.round(canvasHeight * 0.75)} px</option>
            <option value="1">High · {canvasWidth} × {canvasHeight} px</option>
            <option value="1.5">Very High · {Math.round(canvasWidth * 1.5)} × {Math.round(canvasHeight * 1.5)} px</option>
            <option value="2">Ultra · {canvasWidth * 2} × {canvasHeight * 2} px</option>
          </select>
        </label>
        <label className="modal-label export-custom-toggle">
          Dimensi kustom
          <input
            type="checkbox"
            checked={exportCustomDimensions}
            onChange={(e) => setExportCustomDimensions(e.target.checked)}
          />
        </label>
        {exportCustomDimensions && (
          <div className="size-fields">
            <label>
              Lebar keluaran
              <input
                type="number"
                min="16"
                max="8192"
                value={exportCustomWidth}
                onChange={(e) => setExportCustomWidth(Number(e.target.value) || 16)}
                onBlur={() => setExportCustomWidth((value) => Math.max(16, Math.min(8192, Math.round(value))))}
              />
            </label>
            <label>
              Tinggi keluaran
              <input
                type="number"
                min="16"
                max="8192"
                value={exportCustomHeight}
                onChange={(e) => setExportCustomHeight(Number(e.target.value) || 16)}
                onBlur={() => setExportCustomHeight((value) => Math.max(16, Math.min(8192, Math.round(value))))}
              />
            </label>
          </div>
        )}
        <label className="modal-label">
          Penyesuaian isi
          <select value={exportFit} onChange={(e) => setExportFit(e.target.value as 'contain' | 'stretch')}>
            <option value="contain">Pertahankan proporsi</option>
            <option value="stretch">Penuhi ukuran keluaran</option>
          </select>
        </label>
        <small className="size-hint">
          Mode pertahankan proporsi akan menyisakan ruang transparan di PNG atau putih di JPEG bila rasio ukuran berbeda.
        </small>
        <div className="export-preview">
          <div className="preview-image-wrap">
            {exportPreviewUrl ? (
              <img src={exportPreviewUrl} alt={`Preview ${projectName}`} />
            ) : (
              <span>{exportPreviewLoading ? 'Merender preview…' : exportPreviewError || 'Preview belum tersedia'}</span>
            )}
          </div>
          <div>
            <b>{projectName}</b>
            <small>
              {displayWidth} × {displayHeight} px · {exportFormat.toUpperCase()}
            </small>
          </div>
        </div>
        <div className="export-actions">
          <button className="quiet-btn" onClick={() => onExport(true)}>
            Bagikan
          </button>
          <button className="primary-btn export-confirm" onClick={() => onExport(false)}>
            Unduh gambar
          </button>
        </div>
      </div>
    </div>
  )
}
