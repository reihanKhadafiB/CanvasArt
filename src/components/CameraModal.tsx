interface CameraModalProps {
  show: boolean
  cameraTarget: 'background' | 'object'
  cameraActive: boolean
  cameraError: string
  cameraVideoRef: React.RefObject<HTMLVideoElement | null>
  onClose: () => void
  onStartCamera: () => void
  onCapture: () => void
  onFileSelect: (file: File) => void
}

export function CameraModal({
  show,
  cameraTarget,
  cameraActive,
  cameraError,
  cameraVideoRef,
  onClose,
  onStartCamera,
  onCapture,
  onFileSelect,
}: CameraModalProps) {
  if (!show) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card camera-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">KAMERA LOKAL</span>
            <h2>{cameraTarget === 'background' ? 'Ambil foto untuk latar' : 'Ambil foto sebagai objek'}</h2>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <div className="camera-preview">
          {cameraActive ? (
            <video ref={cameraVideoRef} autoPlay playsInline muted />
          ) : (
            <div>
              <span>Pratinjau kamera akan muncul di sini.</span>
              <button className="control-chip" onClick={onStartCamera}>
                Aktifkan kamera
              </button>
            </div>
          )}
        </div>
        {cameraError && (
          <p className="camera-error" role="alert">
            {cameraError}
          </p>
        )}
        <input
          id="camera-file"
          className="hidden-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              onFileSelect(file)
              onClose()
            }
            e.currentTarget.value = ''
          }}
        />
        <div className="camera-actions">
          <button className="quiet-btn" onClick={() => document.getElementById('camera-file')?.click()}>
            Pilih file
          </button>
          {cameraActive && (
            <button className="primary-btn" onClick={onCapture}>
              Ambil foto
            </button>
          )}
        </div>
        <small className="size-hint">
          Browser akan meminta izin kamera. Video hanya digunakan untuk mengambil foto di perangkat ini.
        </small>
      </div>
    </div>
  )
}
