interface AboutModalProps {
  show: boolean
  onClose: () => void
}

export function AboutModal({ show, onClose }: AboutModalProps) {
  if (!show) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">TENTANG APLIKASI</span>
            <h2>CanvasArt</h2>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: '#4a5568', lineHeight: '1.6' }}>
          <p>
            <strong>CanvasArt</strong> adalah editor desain grafis berbasis web yang berjalan sepenuhnya di komputer pengguna (<em>local-first & zero-backend</em>).
          </p>
          <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div><strong>Versi:</strong> 0.1.0 (Beta)</div>
            <div><strong>Arsitektur:</strong> React 19, TypeScript, Fabric.js, Vite</div>
            <div><strong>Privasi:</strong> 100% Pemrosesan lokal tanpa transmisi cloud</div>
          </div>
          <p>
            Didesain untuk mengedit tipografi teks 2D/3D, komposisi multi-layer, vektor Bezier, masking, filter gambar, serta ekspor resolusi tinggi (PNG/JPEG) secara cepat dan bebas.
          </p>
          <div style={{ fontSize: '11px', color: '#718096' }}>
            Lisensi sumber terbuka (Open Source). Seluruh aset bawaan, stiker, dan kutipan dibuat khusus untuk CanvasArt.
          </div>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="primary-btn" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
