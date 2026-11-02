import { describe, expect, it } from 'vitest'
import { graphemeCount } from './text'

describe('text.ts - Grapheme segmentation', () => {
  it('counts standard ASCII strings correctly', () => {
    expect(graphemeCount('CanvasArt')).toBe(9)
    expect(graphemeCount('')).toBe(0)
  })

  it('correctly handles multi-byte and emoji graphemes', () => {
    expect(graphemeCount('😀')).toBe(1)
    expect(graphemeCount('✨🎨🚀')).toBe(3)
  })
})
