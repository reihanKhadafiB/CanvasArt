import { describe, expect, it } from 'vitest'
import { bezierPathData } from './bezier'
import type { BezierPoint } from '../types'

describe('bezier.ts - Bezier path generation', () => {
  it('returns empty string for empty points array', () => {
    expect(bezierPathData([])).toBe('')
  })

  it('generates line for 2 points without handles', () => {
    const points: BezierPoint[] = [
      { x: 10, y: 10 },
      { x: 50, y: 50 },
    ]
    expect(bezierPathData(points)).toBe('M 10 10 L 50 50')
  })

  it('generates smooth cubic bezier curve with handles', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0, handleOut: { x: 10, y: 20 } },
      { x: 100, y: 100, handleIn: { x: -10, y: -20 } },
    ]
    const path = bezierPathData(points)
    expect(path).toBe('M 0 0 C 10 20 90 80 100 100')
  })

  it('closes path with Z when closed is true', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 50 },
    ]
    const path = bezierPathData(points, true)
    expect(path.endsWith('Z')).toBe(true)
  })
})
