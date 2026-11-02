import { describe, expect, it } from 'vitest'
import { createProject, parseProject, PROJECT_FORMAT, PROJECT_SCHEMA_VERSION } from './document'

describe('document.ts - CanvasArt project core', () => {
  it('creates a project with standard schema version and format', () => {
    const project = createProject('Proyek Uji', { objects: [] }, 1280, 720)
    expect(project.name).toBe('Proyek Uji')
    expect(project.format).toBe(PROJECT_FORMAT)
    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION)
    expect(project.canvas.width).toBe(1280)
    expect(project.canvas.height).toBe(720)
    expect(project.canvas.rendererState).toEqual({ objects: [] })
    expect(project.id).toBeDefined()
    expect(project.createdAt).toBeDefined()
  })

  it('parses valid project correctly', () => {
    const sample = createProject('Desain Banner', { version: '5.3.0' }, 1080, 1080)
    const parsed = parseProject(sample)
    expect(parsed.name).toBe('Desain Banner')
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.canvas.width).toBe(1080)
  })

  it('migrates legacy autosave format without project format envelope', () => {
    const legacy = {
      name: 'Legacy Project',
      savedAt: '2026-10-25T10:00:00.000Z',
      canvas: {
        width: 800,
        height: 600,
        objects: [{ type: 'rect' }],
      },
    }
    const parsed = parseProject(legacy)
    expect(parsed.format).toBe(PROJECT_FORMAT)
    expect(parsed.schemaVersion).toBe(PROJECT_SCHEMA_VERSION)
    expect(parsed.name).toBe('Legacy Project')
    expect(parsed.canvas.width).toBe(800)
    expect(parsed.canvas.height).toBe(600)
  })

  it('throws descriptive error on invalid project payload', () => {
    expect(() => parseProject(null)).toThrow('Isi file proyek tidak valid')
    expect(() => parseProject('string data')).toThrow('Isi file proyek tidak valid')
    expect(() => parseProject({})).toThrow('Format file bukan proyek CanvasArt yang dikenali')
    expect(() =>
      parseProject({
        format: PROJECT_FORMAT,
        schemaVersion: 99,
        canvas: { width: 100, height: 100, rendererState: {} },
      }),
    ).toThrow('Versi proyek 99 belum didukung')
  })
})
