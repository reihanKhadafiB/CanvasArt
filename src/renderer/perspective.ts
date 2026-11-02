import type { PerspectiveCorner } from '../types'

export function drawPerspectiveTriangle(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  sourcePoints: PerspectiveCorner[],
  targetPoints: PerspectiveCorner[],
): void {
  const [p0, p1, p2] = sourcePoints
  const [q0, q1, q2] = targetPoints
  const denominator = p0.x * (p1.y - p2.y) + p1.x * (p2.y - p0.y) + p2.x * (p0.y - p1.y)
  if (Math.abs(denominator) < 0.0001) return
  const solve = (v0: number, v1: number, v2: number) => ({
    a: (v0 * (p1.y - p2.y) + v1 * (p2.y - p0.y) + v2 * (p0.y - p1.y)) / denominator,
    c: (v0 * (p2.x - p1.x) + v1 * (p0.x - p2.x) + v2 * (p1.x - p0.x)) / denominator,
    e: (v0 * (p1.x * p2.y - p2.x * p1.y) + v1 * (p2.x * p0.y - p0.x * p2.y) + v2 * (p0.x * p1.y - p1.x * p0.y)) / denominator,
  })
  const x = solve(q0.x, q1.x, q2.x)
  const y = solve(q0.y, q1.y, q2.y)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(q0.x, q0.y)
  ctx.lineTo(q1.x, q1.y)
  ctx.lineTo(q2.x, q2.y)
  ctx.closePath()
  ctx.clip()
  ctx.setTransform(x.a, y.a, x.c, y.c, x.e, y.e)
  ctx.drawImage(source, 0, 0)
  ctx.restore()
}

export interface WarpResult {
  element: HTMLCanvasElement
  offsetX: number
  offsetY: number
  sourceWidth: number
  sourceHeight: number
}

export function renderPerspectiveWarp(source: HTMLCanvasElement, corners: PerspectiveCorner[]): WarpResult {
  const width = source.width
  const height = source.height
  const quad = corners.map((point) => ({ x: point.x * width, y: point.y * height }))
  const minX = Math.floor(Math.min(...quad.map((point) => point.x)))
  const minY = Math.floor(Math.min(...quad.map((point) => point.y)))
  const maxX = Math.ceil(Math.max(...quad.map((point) => point.x)))
  const maxY = Math.ceil(Math.max(...quad.map((point) => point.y)))
  const output = document.createElement('canvas')
  output.width = Math.max(1, Math.min(8192, maxX - minX))
  output.height = Math.max(1, Math.min(8192, maxY - minY))
  const context = output.getContext('2d')
  if (!context) throw new Error('Canvas perspektif tidak tersedia')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  const divisions = 24
  const sourcePoint = (u: number, v: number): PerspectiveCorner => ({ x: u * width, y: v * height })
  const targetPoint = (u: number, v: number): PerspectiveCorner => ({
    x: (1 - u) * (1 - v) * quad[0].x + u * (1 - v) * quad[1].x + u * v * quad[2].x + (1 - u) * v * quad[3].x - minX,
    y: (1 - u) * (1 - v) * quad[0].y + u * (1 - v) * quad[1].y + u * v * quad[2].y + (1 - u) * v * quad[3].y - minY,
  })
  for (let row = 0; row < divisions; row += 1) {
    for (let column = 0; column < divisions; column += 1) {
      const u0 = column / divisions
      const u1 = (column + 1) / divisions
      const v0 = row / divisions
      const v1 = (row + 1) / divisions
      const s00 = sourcePoint(u0, v0)
      const s10 = sourcePoint(u1, v0)
      const s11 = sourcePoint(u1, v1)
      const s01 = sourcePoint(u0, v1)
      const t00 = targetPoint(u0, v0)
      const t10 = targetPoint(u1, v0)
      const t11 = targetPoint(u1, v1)
      const t01 = targetPoint(u0, v1)
      drawPerspectiveTriangle(context, source, [s00, s10, s11], [t00, t10, t11])
      drawPerspectiveTriangle(context, source, [s00, s11, s01], [t00, t11, t01])
    }
  }
  return { element: output, offsetX: minX, offsetY: minY, sourceWidth: width, sourceHeight: height }
}
