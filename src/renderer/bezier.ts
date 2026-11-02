import { Point } from 'fabric'
import type { Path as FabricPath } from 'fabric'
import type { BezierPoint } from '../types'

export function transformBezierPoints(path: FabricPath, points: BezierPoint[]): BezierPoint[] {
  const [a, b, c, d, e, f] = path.calcTransformMatrix()
  const offset = path.pathOffset || new Point(0, 0)
  return points.map((point) => ({
    x: a * (point.x - offset.x) + c * (point.y - offset.y) + e,
    y: b * (point.x - offset.x) + d * (point.y - offset.y) + f,
    ...(point.handleIn ? { handleIn: { x: a * point.handleIn.x + c * point.handleIn.y, y: b * point.handleIn.x + d * point.handleIn.y } } : {}),
    ...(point.handleOut ? { handleOut: { x: a * point.handleOut.x + c * point.handleOut.y, y: b * point.handleOut.x + d * point.handleOut.y } } : {}),
  }))
}

export function bezierPathData(points: BezierPoint[], closed = false): string {
  if (!points.length) return ''
  const commands = [`M ${points[0].x} ${points[0].y}`]
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    if (points.length === 2 && !p1.handleOut && !p2.handleIn) {
      commands.push(`L ${p2.x} ${p2.y}`)
      continue
    }
    const autoC1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const autoC2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    const c1 = p1.handleOut ? { x: p1.x + p1.handleOut.x, y: p1.y + p1.handleOut.y } : autoC1
    const c2 = p2.handleIn ? { x: p2.x + p2.handleIn.x, y: p2.y + p2.handleIn.y } : autoC2
    commands.push(`C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`)
  }
  if (closed && points.length > 2) {
    const last = points[points.length - 1]
    const first = points[0]
    if (last.handleOut || first.handleIn) {
      const c1 = last.handleOut ? { x: last.x + last.handleOut.x, y: last.y + last.handleOut.y } : last
      const c2 = first.handleIn ? { x: first.x + first.handleIn.x, y: first.y + first.handleIn.y } : first
      commands.push(`C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${first.x} ${first.y}`)
    }
    commands.push('Z')
  }
  return commands.join(' ')
}
