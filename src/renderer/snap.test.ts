import { describe, expect, it } from 'vitest'
import { calculateObjectSnap } from './snap'

describe('calculateObjectSnap', () => {
  it('returns unchanged position when snapping is disabled', () => {
    const mockTarget = { left: 42, top: 99, getBoundingRect: () => ({ left: 42, top: 99, width: 100, height: 100 }) }
    const mockCanvas = { getWidth: () => 1000, getHeight: () => 1000, getObjects: () => [] }

    const result = calculateObjectSnap(mockTarget as never, mockCanvas as never, false, false, 20)
    expect(result.left).toBe(42)
    expect(result.top).toBe(99)
    expect(result.guides).toHaveLength(0)
  })

  it('snaps to canvas horizontal center when within tolerance', () => {
    // Canvas is 1000px wide, center is 500px.
    // Object is 100px wide, so its center is left + 50.
    // If left is 448, center is 498 (within 8px of 500).
    const mockTarget = { left: 448, top: 100, getBoundingRect: () => ({ left: 448, top: 100, width: 100, height: 100 }) }
    const mockCanvas = { getWidth: () => 1000, getHeight: () => 1000, getObjects: () => [] }

    const result = calculateObjectSnap(mockTarget as never, mockCanvas as never, false, true, 20, 8)
    expect(result.left).toBe(450) // 500 - 50 = 450
    expect(result.guides.some((g) => g.x === 500)).toBe(true)
  })

  it('snaps to canvas vertical center when within tolerance', () => {
    // Canvas is 1000px high, center is 500px.
    // Object is 60px high, so its center is top + 30.
    // If top is 472, center is 502 (within 8px of 500).
    const mockTarget = { left: 100, top: 472, getBoundingRect: () => ({ left: 100, top: 472, width: 100, height: 60 }) }
    const mockCanvas = { getWidth: () => 1000, getHeight: () => 1000, getObjects: () => [] }

    const result = calculateObjectSnap(mockTarget as never, mockCanvas as never, false, true, 20, 8)
    expect(result.top).toBe(470) // 500 - 30 = 470
    expect(result.guides.some((g) => g.y === 500)).toBe(true)
  })

  it('falls back to grid snap when enabled and not near reference lines', () => {
    const mockTarget = { left: 123, top: 217, getBoundingRect: () => ({ left: 123, top: 217, width: 50, height: 50 }) }
    const mockCanvas = { getWidth: () => 1000, getHeight: () => 1000, getObjects: () => [] }

    const result = calculateObjectSnap(mockTarget as never, mockCanvas as never, true, true, 25, 4)
    expect(result.left).toBe(125) // nearest multiple of 25
    expect(result.top).toBe(225) // nearest multiple of 25
  })
})
