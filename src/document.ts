export const PROJECT_FORMAT = 'canvasart-project'
export const PROJECT_SCHEMA_VERSION = 1

export interface FontAsset {
  family: string
  dataUrl: string
  fileName: string
}

export interface TextStyleAsset {
  id: string
  name: string
  properties: Record<string, unknown>
}

export interface BrushSettings {
  color: string
  size: number
  smooth: number
  dashed: boolean
}

export interface CanvasArtProject {
  format: typeof PROJECT_FORMAT
  schemaVersion: number
  id: string
  name: string
  createdAt: string
  updatedAt: string
  effects?: Record<string, number>
  fonts?: FontAsset[]
  textStyles?: TextStyleAsset[]
  brush?: BrushSettings
  canvas: {
    width: number
    height: number
    rendererState: Record<string, unknown>
  }
}

export function createProject(
  name: string,
  rendererState: Record<string, unknown>,
  width: number,
  height: number,
  previous?: Partial<CanvasArtProject>
): CanvasArtProject {
  const now = new Date().toISOString()
  return {
    format: PROJECT_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: previous?.id || crypto.randomUUID(),
    name,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    effects: previous?.effects,
    fonts: previous?.fonts || [],
    textStyles: previous?.textStyles || [],
    brush: previous?.brush,
    canvas: { width, height, rendererState },
  }
}

/**
 * Migrates project schema across versions if necessary.
 */
export function migrateProject(project: Record<string, unknown>): CanvasArtProject {
  const version = Number(project.schemaVersion) || 1
  if (version > PROJECT_SCHEMA_VERSION) {
    throw new Error(`Versi proyek ${String(version)} belum didukung oleh versi CanvasArt ini`)
  }

  // Future schema migrations (e.g. version 1 -> 2) will transform structure here.
  const canvas = project.canvas as { width: number; height: number; rendererState: Record<string, unknown> }
  return {
    format: PROJECT_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: typeof project.id === 'string' ? project.id : crypto.randomUUID(),
    name: typeof project.name === 'string' ? project.name : 'Desain tanpa judul',
    createdAt: typeof project.createdAt === 'string' ? project.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    effects: typeof project.effects === 'object' && project.effects !== null ? (project.effects as Record<string, number>) : undefined,
    fonts: Array.isArray(project.fonts) ? (project.fonts as FontAsset[]) : [],
    textStyles: Array.isArray(project.textStyles) ? (project.textStyles as TextStyleAsset[]) : [],
    brush: typeof project.brush === 'object' && project.brush !== null ? (project.brush as BrushSettings) : undefined,
    canvas: {
      width: Number(canvas.width) || 1080,
      height: Number(canvas.height) || 1080,
      rendererState: canvas.rendererState,
    },
  }
}

export function parseProject(input: unknown): CanvasArtProject {
  if (!input || typeof input !== 'object') throw new Error('Isi file proyek tidak valid')
  const value = input as Record<string, unknown>

  if (value.format === PROJECT_FORMAT) {
    if (!value.canvas || typeof value.canvas !== 'object') throw new Error('Data kanvas tidak ditemukan')
    const canvas = value.canvas as Record<string, unknown>
    if (!canvas.rendererState || typeof canvas.rendererState !== 'object') throw new Error('Data layer proyek tidak valid')
    if (!Number.isFinite(canvas.width) || !Number.isFinite(canvas.height)) throw new Error('Ukuran kanvas proyek tidak valid')

    return migrateProject(value)
  }

  // Read the initial pre-schema autosave/project format so early work remains recoverable.
  if (value.canvas && typeof value.canvas === 'object') {
    const rendererState = value.canvas as Record<string, unknown>
    const dimensions = rendererState as { width?: number; height?: number }
    const savedAt = typeof value.savedAt === 'string' ? value.savedAt : undefined
    return createProject(
      typeof value.name === 'string' ? value.name : 'Desain tanpa judul',
      rendererState,
      Number(dimensions.width) || 1080,
      Number(dimensions.height) || 1080,
      savedAt ? { createdAt: savedAt } : undefined
    )
  }

  throw new Error('Format file bukan proyek CanvasArt yang dikenali')
}
