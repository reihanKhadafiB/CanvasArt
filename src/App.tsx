import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Canvas, Circle, Ellipse, FabricImage, FabricObject, FabricText, Gradient, Group, Path as FabricPath, Pattern, PencilBrush, Point, Polygon, Rect, Triangle, filters } from 'fabric'
import JSZip from 'jszip'
import { createProject, parseProject } from './document'
import type { BrushSettings, CanvasArtProject, FontAsset, TextStyleAsset } from './document'
import { QUOTES } from './quotes'
import type { QuoteCategory, QuoteEntry, QuoteLanguage } from './quotes'
import { STICKERS } from './stickers'
import type { StickerCategory, StickerAsset } from './stickers'
import './App.css'

type Tab = 'Presets' | 'Text' | 'Object' | 'Background' | 'Effects'
type BezierPoint = { x: number; y: number; handleIn?: { x: number; y: number }; handleOut?: { x: number; y: number } }
type PerspectiveCorner = { x: number; y: number }
type BezierEditDrag = { index: number; handle: 'anchor' | 'in' | 'out' }
type SavedTextStyle = TextStyleAsset
function transformBezierPoints(path: FabricPath, points: BezierPoint[]): BezierPoint[] {
  const [a, b, c, d, e, f] = path.calcTransformMatrix()
  const offset = path.pathOffset || new Point(0, 0)
  return points.map((point) => ({
    x: a * (point.x - offset.x) + c * (point.y - offset.y) + e,
    y: b * (point.x - offset.x) + d * (point.y - offset.y) + f,
    ...(point.handleIn ? { handleIn: { x: a * point.handleIn.x + c * point.handleIn.y, y: b * point.handleIn.x + d * point.handleIn.y } } : {}),
    ...(point.handleOut ? { handleOut: { x: a * point.handleOut.x + c * point.handleOut.y, y: b * point.handleOut.x + d * point.handleOut.y } } : {}),
  }))
}
function bezierPathData(points: BezierPoint[], closed = false) {
  if (!points.length) return ''
  const commands = [`M ${points[0].x} ${points[0].y}`]
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    if (points.length === 2 && !p1.handleOut && !p2.handleIn) { commands.push(`L ${p2.x} ${p2.y}`); continue }
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
function getBrushSettings(settings?: Partial<BrushSettings>): BrushSettings {
  return {
    color: /^#[\da-f]{6}$/i.test(settings?.color || '') ? settings!.color! : '#202b47',
    size: Math.max(1, Math.min(60, Number.isFinite(settings?.size) ? settings!.size! : 8)),
    smooth: Math.max(0, Math.min(8, Number.isFinite(settings?.smooth) ? settings!.smooth! : 0.4)),
    dashed: Boolean(settings?.dashed),
  }
}
async function syncPathMaskDependents(canvas: Canvas, source: FabricPath & { canvasArtId?: string }) {
  if (!source.canvasArtId) return
  const dependents = canvas.getObjects().filter((object) => (object as FabricObject & { canvasArtMaskSourceId?: string }).canvasArtMaskSourceId === source.canvasArtId)
  for (const target of dependents) {
    const mode = (target as FabricObject & { canvasArtMaskMode?: 'in' | 'out' }).canvasArtMaskMode || 'in'
    const clipPath = await source.clone()
    clipPath.set({ absolutePositioned: true, inverted: mode === 'out', visible: true, selectable: false, evented: false } as never)
    target.set({ clipPath, dirty: true } as never)
    target.setCoords()
  }
  if (dependents.length) canvas.requestRenderAll()
}
function drawPerspectiveTriangle(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, sourcePoints: PerspectiveCorner[], targetPoints: PerspectiveCorner[]) {
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
  ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.closePath(); ctx.clip()
  ctx.setTransform(x.a, y.a, x.c, y.c, x.e, y.e)
  ctx.drawImage(source, 0, 0)
  ctx.restore()
}
function renderPerspectiveWarp(source: HTMLCanvasElement, corners: PerspectiveCorner[]) {
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
      const u0 = column / divisions; const u1 = (column + 1) / divisions
      const v0 = row / divisions; const v1 = (row + 1) / divisions
      const s00 = sourcePoint(u0, v0); const s10 = sourcePoint(u1, v0); const s11 = sourcePoint(u1, v1); const s01 = sourcePoint(u0, v1)
      const t00 = targetPoint(u0, v0); const t10 = targetPoint(u1, v0); const t11 = targetPoint(u1, v1); const t01 = targetPoint(u0, v1)
      drawPerspectiveTriangle(context, source, [s00, s10, s11], [t00, t10, t11])
      drawPerspectiveTriangle(context, source, [s00, s11, s01], [t00, t11, t01])
    }
  }
  return { element: output, offsetX: minX, offsetY: minY, sourceWidth: width, sourceHeight: height }
}
function graphemeCount(text: string) {
  return typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)).length
    : Array.from(text).length
}
const EMOJI_STICKERS = ['😀','😃','😄','😁','😆','😂','🤣','😊','😎','😍','🥰','😘','😜','🤔','😴','😭','😡','🤯','🥳','🤩','😇','🤗','🤫','🤭','😱','😈','💀','👻','🤖','👽','💩','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','✨','⭐','🌟','🔥','💥','⚡','☀️','🌈','☁️','❄️','🌸','🌺','🌻','🍀','🌴','🍉','🍓','🍕','🎂','🎉','🎊','🎁','🏆','👑','💎','🚀','✈️','🚗','⚽','🏀','🎨','🎵','💯','✅','❌','❗','❓','💡','📌','🔔','👍','👎','👏','🙌','🙏','💪','👋','✌️','🤟','🫶','🎯','🚩']

const DB_NAME = 'canvasart-local'
const DB_STORE = 'projects'
const AUTOSAVE_ID = 'autosave'
FabricObject.customProperties = ['canvasArtBezierPoints', 'canvasArtBezierClosed', 'name', 'canvasArtCurve', 'canvasArtWordSpacing', 'canvasArtBackgroundPaddingLeft', 'canvasArtBackgroundPaddingRight', 'canvasArtBackgroundPaddingTop', 'canvasArtBackgroundPaddingBottom', 'canvasArtBackgroundRadius', 'canvasArt3DDepth', 'canvasArt3DAngle', 'canvasArt3DColor', 'canvasArt3DMode', 'canvasArt3DDarken', 'canvasArt3DLightEnabled', 'canvasArt3DLightAngle', 'canvasArt3DLightIntensity', 'canvasArt3DAmbientLight', 'canvasArt3DRotateX', 'canvasArt3DRotateY', 'canvasArt3DBaseScaleX', 'canvasArt3DBaseScaleY', 'canvasArtMaskEnabled', 'canvasArtMaskShape', 'canvasArtMaskMode', 'canvasArtMaskScaleX', 'canvasArtMaskScaleY', 'canvasArtMaskSourceId', 'canvasArtMaskSourceVisible', 'canvasArtId', 'canvasArtWarpSourceId', 'canvasArtWarpSourceVisible', 'canvasArtWarpSourceSelectable', 'canvasArtWarpCorners', 'canvasArtArrowLength', 'canvasArtArrowThickness', 'canvasArtArrowHead', 'canvasArtArrowTail', 'canvasArtInnerShadowEnabled', 'canvasArtInnerShadowColor', 'canvasArtInnerShadowBlur', 'canvasArtInnerShadowOffsetX', 'canvasArtInnerShadowOffsetY', 'canvasArtInnerShadowOpacity', 'canvasArtReflectionEnabled', 'canvasArtReflectionGap', 'canvasArtReflectionLength', 'canvasArtReflectionOpacity', 'canvasArt3DShadowEnabled', 'canvasArt3DShadowColor', 'canvasArt3DShadowAngle', 'canvasArt3DShadowLength', 'canvasArt3DShadowGap', 'canvasArt3DShadowBlur', 'canvasArt3DShadowOpacity', 'canvasArtEmbossEnabled', 'canvasArtEmbossAngle', 'canvasArtEmbossIntensity', 'canvasArtEmbossAmbient', 'canvasArtEmbossHardness', 'canvasArtEmbossBevel']

type BackgroundStyledText = {
  textBackgroundColor?: string
  path?: unknown
  width: number
  direction: string
  canvasArtBackgroundPaddingLeft?: number
  canvasArtBackgroundPaddingRight?: number
  canvasArtBackgroundPaddingTop?: number
  canvasArtBackgroundPaddingBottom?: number
  canvasArtBackgroundRadius?: number
  _getLeftOffset(): number
  _getTopOffset(): number
  _getLineLeftOffset(lineIndex: number): number
  _textLines: string[][]
  getHeightOfLine(lineIndex: number): number
  getLineWidth(lineIndex: number): number
}
const textPrototype = FabricText.prototype as unknown as Record<string, unknown>
type WordSpacedText = FabricText & { canvasArtWordSpacing?: number }
type GraphemeBoxLike = { width: number; kernedWidth: number; [key: string]: unknown }
const nativeGetGraphemeBox = textPrototype._getGraphemeBox as (this: FabricText, grapheme: string, lineIndex: number, charIndex: number, previous?: string, skipLeft?: boolean) => GraphemeBoxLike
textPrototype._getGraphemeBox = function (this: FabricText, grapheme: string, lineIndex: number, charIndex: number, previous?: string, skipLeft?: boolean) {
  const box = nativeGetGraphemeBox.call(this, grapheme, lineIndex, charIndex, previous, skipLeft)
  const spacing = grapheme === ' ' ? Math.max(-100, Math.min(500, (this as WordSpacedText).canvasArtWordSpacing || 0)) : 0
  return spacing ? { ...box, width: box.width + spacing, kernedWidth: box.kernedWidth + spacing } : box
}
const renderNativeTextBackground = textPrototype._renderTextLinesBackground as (this: FabricText, ctx: CanvasRenderingContext2D) => void
textPrototype._renderTextLinesBackground = function (this: FabricText, ctx: CanvasRenderingContext2D) {
  const text = this as unknown as BackgroundStyledText
  const padLeft = Math.max(0, text.canvasArtBackgroundPaddingLeft || 0)
  const padRight = Math.max(0, text.canvasArtBackgroundPaddingRight || 0)
  const padTop = Math.max(0, text.canvasArtBackgroundPaddingTop || 0)
  const padBottom = Math.max(0, text.canvasArtBackgroundPaddingBottom || 0)
  const radius = Math.max(0, text.canvasArtBackgroundRadius || 0)
  if (!renderNativeTextBackground || !text.textBackgroundColor || text.path || !(padLeft || padRight || padTop || padBottom || radius)) {
    renderNativeTextBackground?.call(this, ctx)
    return
  }
  const originalFill = ctx.fillStyle
  ctx.fillStyle = text.textBackgroundColor
  let lineTop = text._getTopOffset()
  for (let index = 0; index < text._textLines.length; index += 1) {
    const lineHeight = text.getHeightOfLine(index)
    const lineWidth = text.getLineWidth(index)
    let left = text._getLeftOffset() + text._getLineLeftOffset(index)
    if (text.direction === 'rtl') left = text.width - left - lineWidth
    const x = left - padLeft
    const y = lineTop - padTop
    const width = lineWidth + padLeft + padRight
    const height = lineHeight + padTop + padBottom
    const corner = Math.min(radius, width / 2, height / 2)
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, corner)
    else {
      ctx.moveTo(x + corner, y)
      ctx.lineTo(x + width - corner, y)
      ctx.quadraticCurveTo(x + width, y, x + width, y + corner)
      ctx.lineTo(x + width, y + height - corner)
      ctx.quadraticCurveTo(x + width, y + height, x + width - corner, y + height)
      ctx.lineTo(x + corner, y + height)
      ctx.quadraticCurveTo(x, y + height, x, y + height - corner)
      ctx.lineTo(x, y + corner)
      ctx.quadraticCurveTo(x, y, x + corner, y)
    }
    ctx.closePath()
    ctx.fill()
    lineTop += text.getHeightOfLine(index)
  }
  const fill = text.textBackgroundColor
  text.textBackgroundColor = ''
  try { renderNativeTextBackground.call(this, ctx) } finally { text.textBackgroundColor = fill }
  ctx.fillStyle = originalFill
}
type ExtrudedText = FabricText & { canvasArt3DDepth?: number; canvasArt3DAngle?: number; canvasArt3DColor?: string; canvasArt3DMode?: 'oblique' | 'perspective'; canvasArt3DDarken?: number; canvasArt3DLightEnabled?: boolean; canvasArt3DLightAngle?: number; canvasArt3DLightIntensity?: number; canvasArt3DAmbientLight?: number; canvasArt3DRotateX?: number; canvasArt3DRotateY?: number; canvasArt3DBaseScaleX?: number; canvasArt3DBaseScaleY?: number; canvasArtInnerShadowEnabled?: boolean; canvasArtInnerShadowColor?: string; canvasArtInnerShadowBlur?: number; canvasArtInnerShadowOffsetX?: number; canvasArtInnerShadowOffsetY?: number; canvasArtInnerShadowOpacity?: number; canvasArtReflectionEnabled?: boolean; canvasArtReflectionGap?: number; canvasArtReflectionLength?: number; canvasArtReflectionOpacity?: number; canvasArt3DShadowEnabled?: boolean; canvasArt3DShadowColor?: string; canvasArt3DShadowAngle?: number; canvasArt3DShadowLength?: number; canvasArt3DShadowGap?: number; canvasArt3DShadowBlur?: number; canvasArt3DShadowOpacity?: number; canvasArtEmbossEnabled?: boolean; canvasArtEmbossAngle?: number; canvasArtEmbossIntensity?: number; canvasArtEmbossAmbient?: number; canvasArtEmbossHardness?: number; canvasArtEmbossBevel?: number; textBackgroundColor?: string }
function darkenHexColor(color: string, amount: number) {
  const match = /^#([\da-f]{6})$/i.exec(color)
  if (!match) return color
  const factor = 1 - Math.max(0, Math.min(100, amount)) / 100
  const channels = [0, 2, 4].map((index) => Math.round(parseInt(match[1].slice(index, index + 2), 16) * factor))
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}
function lightHexColor(color: string, amount: number) {
  const match = /^#([\da-f]{6})$/i.exec(color)
  if (!match) return color
  const factor = Math.max(0, Math.min(1.5, amount))
  const channels = [0, 2, 4].map((index) => {
    const value = parseInt(match[1].slice(index, index + 2), 16)
    return Math.round(factor <= 1 ? value * factor : value + (255 - value) * (factor - 1) * 2)
  })
  return `#${channels.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0')).join('')}`
}
const renderNativeText = textPrototype._render as (this: FabricText, ctx: CanvasRenderingContext2D) => void
function renderInnerTextShadow(text: FabricText, ctx: CanvasRenderingContext2D) {
  const styled = text as ExtrudedText
  if (!styled.canvasArtInnerShadowEnabled) return
  const blur = Math.max(0, Math.min(48, styled.canvasArtInnerShadowBlur || 0))
  const offsetX = Math.max(-80, Math.min(80, styled.canvasArtInnerShadowOffsetX || 0))
  const offsetY = Math.max(-80, Math.min(80, styled.canvasArtInnerShadowOffsetY || 0))
  const margin = Math.ceil(blur * 2 + Math.max(Math.abs(offsetX), Math.abs(offsetY)) + 4)
  const width = Math.max(1, Math.ceil(text.width || text.getScaledWidth()))
  const height = Math.max(1, Math.ceil(text.height || text.getScaledHeight()))
  const mask = document.createElement('canvas')
  mask.width = width + margin * 2; mask.height = height + margin * 2
  const maskContext = mask.getContext('2d')
  if (!maskContext) return
  const original = { fill: text.fill, stroke: text.stroke, strokeWidth: text.strokeWidth, shadow: text.shadow, opacity: text.opacity, background: styled.textBackgroundColor }
  try {
    text.set({ fill: '#fff', stroke: null, strokeWidth: 0, shadow: null, opacity: 1 } as never)
    styled.textBackgroundColor = ''
    maskContext.translate(margin + width / 2, margin + height / 2)
    renderNativeText.call(text, maskContext)
  } finally {
    text.set({ fill: original.fill, stroke: original.stroke, strokeWidth: original.strokeWidth, shadow: original.shadow, opacity: original.opacity } as never)
    styled.textBackgroundColor = original.background
  }
  const shifted = document.createElement('canvas')
  shifted.width = mask.width; shifted.height = mask.height
  const shiftedContext = shifted.getContext('2d')
  if (!shiftedContext) return
  shiftedContext.filter = blur ? `blur(${blur}px)` : 'none'
  shiftedContext.drawImage(mask, offsetX, offsetY)
  shiftedContext.filter = 'none'
  const inner = document.createElement('canvas')
  inner.width = mask.width; inner.height = mask.height
  const innerContext = inner.getContext('2d')
  if (!innerContext) return
  innerContext.fillStyle = styled.canvasArtInnerShadowColor || '#202b47'
  innerContext.fillRect(0, 0, inner.width, inner.height)
  innerContext.globalCompositeOperation = 'destination-out'
  innerContext.drawImage(shifted, 0, 0)
  innerContext.globalCompositeOperation = 'destination-in'
  innerContext.drawImage(mask, 0, 0)
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, styled.canvasArtInnerShadowOpacity ?? 0.7))
  ctx.drawImage(inner, -width / 2 - margin, -height / 2 - margin)
  ctx.restore()
}
function renderTextEmboss(text: FabricText, ctx: CanvasRenderingContext2D) {
  const styled = text as ExtrudedText
  if (!styled.canvasArtEmbossEnabled) return
  const angle = (styled.canvasArtEmbossAngle || 45) * Math.PI / 180
  const bevel = Math.max(0.5, Math.min(24, styled.canvasArtEmbossBevel ?? 3))
  const intensity = Math.max(0, Math.min(1, styled.canvasArtEmbossIntensity ?? 0.65))
  const ambient = Math.max(0, Math.min(1, styled.canvasArtEmbossAmbient ?? 0.2))
  const hardness = Math.max(0, Math.min(1, styled.canvasArtEmbossHardness ?? 0.7))
  const distance = bevel * 0.55
  const original = { fill: text.fill, stroke: text.stroke, strokeWidth: text.strokeWidth, shadow: text.shadow }
  ctx.save()
  try {
    ctx.filter = hardness >= 0.99 ? 'none' : `blur(${((1 - hardness) * bevel) / 5}px)`
    ctx.globalAlpha *= Math.min(1, intensity + ambient * 0.25)
    text.set({ fill: 'rgba(0,0,0,0)', stroke: '#ffffff', strokeWidth: bevel, shadow: null } as never)
    ctx.save(); ctx.translate(-Math.cos(angle) * distance, -Math.sin(angle) * distance); renderNativeText.call(text, ctx); ctx.restore()
    ctx.globalAlpha *= Math.max(0.25, intensity)
    text.set({ stroke: '#111827' } as never)
    ctx.save(); ctx.translate(Math.cos(angle) * distance, Math.sin(angle) * distance); renderNativeText.call(text, ctx); ctx.restore()
  } finally {
    text.set({ fill: original.fill, stroke: original.stroke, strokeWidth: original.strokeWidth, shadow: original.shadow } as never)
    ctx.restore()
  }
}
function renderText3DShadow(text: FabricText, ctx: CanvasRenderingContext2D) {
  const styled = text as ExtrudedText
  if (!styled.canvasArt3DShadowEnabled) return
  const gap = Math.max(0, Math.min(160, styled.canvasArt3DShadowGap || 0))
  const length = Math.max(0.05, Math.min(0.8, styled.canvasArt3DShadowLength ?? 0.2))
  const angle = (styled.canvasArt3DShadowAngle || 0) * Math.PI / 180
  const blur = Math.max(0, Math.min(60, styled.canvasArt3DShadowBlur || 0))
  const opacity = Math.max(0, Math.min(1, styled.canvasArt3DShadowOpacity ?? 0.45))
  const height = Math.max(1, text.height || text.getScaledHeight())
  const original = { fill: text.fill, stroke: text.stroke, strokeWidth: text.strokeWidth, shadow: text.shadow, background: styled.textBackgroundColor }
  ctx.save()
  try {
    ctx.globalAlpha *= opacity
    ctx.filter = blur ? `blur(${blur}px)` : 'none'
    ctx.translate(0, height / 2 + gap + height * length / 2)
    ctx.transform(1, 0, Math.tan(angle) * length, length, 0, 0)
    text.set({ fill: styled.canvasArt3DShadowColor || '#161a24', stroke: null, strokeWidth: 0, shadow: null } as never)
    styled.textBackgroundColor = ''
    renderNativeText.call(text, ctx)
  } finally {
    text.set({ fill: original.fill, stroke: original.stroke, strokeWidth: original.strokeWidth, shadow: original.shadow } as never)
    styled.textBackgroundColor = original.background
    ctx.restore()
  }
}
function renderTextReflection(text: FabricText, ctx: CanvasRenderingContext2D) {
  const styled = text as ExtrudedText
  if (!styled.canvasArtReflectionEnabled) return
  const gap = Math.max(0, Math.min(120, styled.canvasArtReflectionGap || 0))
  const length = Math.max(0.1, Math.min(1.5, styled.canvasArtReflectionLength ?? 0.65))
  const opacity = Math.max(0, Math.min(1, styled.canvasArtReflectionOpacity ?? 0.35))
  const height = Math.max(1, text.height || text.getScaledHeight())
  const shadow = text.shadow
  ctx.save()
  try {
    ctx.globalAlpha *= opacity
    ctx.translate(0, height / 2 + gap)
    ctx.scale(1, -length)
    text.set({ shadow: null } as never)
    renderNativeText.call(text, ctx)
  } finally {
    text.set({ shadow } as never)
    ctx.restore()
  }
}
textPrototype._render = function (this: FabricText, ctx: CanvasRenderingContext2D) {
  if (!renderNativeText) return
  const text = this as ExtrudedText
  const depth = Math.max(0, Math.min(32, Math.round(text.canvasArt3DDepth || 0)))
  if (!depth) { renderText3DShadow(this, ctx); renderTextReflection(this, ctx); renderNativeText.call(this, ctx); renderTextEmboss(this, ctx); renderInnerTextShadow(this, ctx); return }
  renderText3DShadow(this, ctx)
  renderTextReflection(this, ctx)
  const original = { fill: this.fill, stroke: this.stroke, strokeWidth: this.strokeWidth, shadow: this.shadow, background: text.textBackgroundColor }
  const angle = ((text.canvasArt3DAngle || 45) * Math.PI) / 180
  const stepX = Math.cos(angle)
  const stepY = Math.sin(angle)
  try {
    this.set({ shadow: null } as never)
    text.textBackgroundColor = ''
    for (let step = depth; step >= 1; step -= 1) {
      const perspective = text.canvasArt3DMode === 'perspective' ? 0.45 + 0.55 * (step / depth) : 1
      ctx.save()
      ctx.translate(stepX * step * perspective, stepY * step * perspective)
      let depthColor = darkenHexColor(text.canvasArt3DColor || '#344987', text.canvasArt3DDarken || 0)
      if (text.canvasArt3DLightEnabled) {
        const lightAngle = (text.canvasArt3DLightAngle ?? 315) * Math.PI / 180
        const facing = Math.max(0, Math.cos(lightAngle - (angle + Math.PI / 2)))
        const intensity = Math.max(0, Math.min(1, text.canvasArt3DLightIntensity ?? 0.75))
        const ambient = Math.max(0, Math.min(1, text.canvasArt3DAmbientLight ?? 0.22))
        const illumination = (ambient + intensity * (0.18 + facing * 0.95)) * (0.62 + 0.38 * (step / depth))
        depthColor = lightHexColor(depthColor, illumination)
      }
      this.set({ fill: depthColor, stroke: depthColor, strokeWidth: Math.max(0.5, Number(original.strokeWidth) || 0) } as never)
      renderNativeText.call(this, ctx)
      ctx.restore()
    }
  } finally {
    this.set({ fill: original.fill, stroke: original.stroke, strokeWidth: original.strokeWidth, shadow: original.shadow } as never)
    text.textBackgroundColor = original.background
  }
  renderNativeText.call(this, ctx)
  renderTextEmboss(this, ctx)
  renderInnerTextShadow(this, ctx)
}

type StyledCanvasObject = FabricObject & {
  canvasArtInnerShadowEnabled?: boolean; canvasArtInnerShadowColor?: string; canvasArtInnerShadowBlur?: number
  canvasArtInnerShadowOffsetX?: number; canvasArtInnerShadowOffsetY?: number; canvasArtInnerShadowOpacity?: number
  canvasArtEmbossEnabled?: boolean; canvasArtEmbossAngle?: number; canvasArtEmbossIntensity?: number
  canvasArtEmbossAmbient?: number; canvasArtEmbossHardness?: number; canvasArtEmbossBevel?: number
}
type LocalMask = { canvas: HTMLCanvasElement; width: number; height: number; margin: number }
function createObjectAlphaMask(object: FabricObject, nativeRender: (this: FabricObject, ctx: CanvasRenderingContext2D) => void, blur: number, offsetX: number, offsetY: number, bevel = 0): LocalMask | null {
  const scaleX = Math.max(0.01, object.scaleX || 1)
  const scaleY = Math.max(0.01, object.scaleY || 1)
  const width = Math.max(1, Math.ceil(object.width || object.getScaledWidth() / scaleX))
  const height = Math.max(1, Math.ceil(object.height || object.getScaledHeight() / scaleY))
  const margin = Math.ceil(blur * 2 + Math.max(Math.abs(offsetX), Math.abs(offsetY)) + bevel + 4)
  const mask = document.createElement('canvas')
  mask.width = width + margin * 2; mask.height = height + margin * 2
  const maskContext = mask.getContext('2d')
  if (!maskContext) return null
  const original = { opacity: object.opacity, shadow: object.shadow }
  try {
    object.set({ opacity: 1, shadow: null } as never)
    maskContext.translate(margin + width / 2, margin + height / 2)
    nativeRender.call(object, maskContext)
  } finally { object.set({ opacity: original.opacity, shadow: original.shadow } as never) }
  maskContext.globalCompositeOperation = 'source-in'
  maskContext.fillStyle = '#fff'; maskContext.fillRect(0, 0, mask.width, mask.height)
  return { canvas: mask, width, height, margin }
}
function drawObjectInnerEdge(ctx: CanvasRenderingContext2D, mask: LocalMask, color: string, blur: number, offsetX: number, offsetY: number, opacity: number) {
  const shifted = document.createElement('canvas')
  shifted.width = mask.canvas.width; shifted.height = mask.canvas.height
  const shiftedContext = shifted.getContext('2d')
  if (!shiftedContext) return
  shiftedContext.filter = blur ? `blur(${blur}px)` : 'none'
  shiftedContext.drawImage(mask.canvas, offsetX, offsetY)
  shiftedContext.filter = 'none'
  const inner = document.createElement('canvas')
  inner.width = mask.canvas.width; inner.height = mask.canvas.height
  const innerContext = inner.getContext('2d')
  if (!innerContext) return
  innerContext.fillStyle = color; innerContext.fillRect(0, 0, inner.width, inner.height)
  innerContext.globalCompositeOperation = 'destination-out'; innerContext.drawImage(shifted, 0, 0)
  innerContext.globalCompositeOperation = 'destination-in'; innerContext.drawImage(mask.canvas, 0, 0)
  ctx.save(); ctx.globalAlpha *= Math.max(0, Math.min(1, opacity))
  ctx.drawImage(inner, -mask.width / 2 - mask.margin, -mask.height / 2 - mask.margin)
  ctx.restore()
}
function renderStyledObject(object: FabricObject, ctx: CanvasRenderingContext2D, nativeRender: (this: FabricObject, ctx: CanvasRenderingContext2D) => void) {
  const styled = object as StyledCanvasObject
  if (!styled.canvasArtInnerShadowEnabled && !styled.canvasArtEmbossEnabled) { nativeRender.call(object, ctx); return }
  const innerBlur = Math.max(0, Math.min(48, styled.canvasArtInnerShadowBlur || 0))
  const innerX = Math.max(-80, Math.min(80, styled.canvasArtInnerShadowOffsetX || 0))
  const innerY = Math.max(-80, Math.min(80, styled.canvasArtInnerShadowOffsetY || 0))
  const bevel = Math.max(1, Math.min(24, styled.canvasArtEmbossBevel || 3))
  const embossBlur = ((1 - Math.max(0, Math.min(1, styled.canvasArtEmbossHardness ?? 0.7))) * bevel) / 5
  const mask = createObjectAlphaMask(object, nativeRender, Math.max(innerBlur, embossBlur), Math.max(Math.abs(innerX), bevel), Math.max(Math.abs(innerY), bevel), bevel)
  nativeRender.call(object, ctx)
  if (!mask) return
  if (styled.canvasArtInnerShadowEnabled) drawObjectInnerEdge(ctx, mask, styled.canvasArtInnerShadowColor || '#202b47', innerBlur, innerX, innerY, styled.canvasArtInnerShadowOpacity ?? 0.7)
  if (styled.canvasArtEmbossEnabled) {
    const angle = (styled.canvasArtEmbossAngle ?? 45) * Math.PI / 180
    const intensity = Math.max(0, Math.min(1, styled.canvasArtEmbossIntensity ?? 0.65))
    const ambient = Math.max(0, Math.min(1, styled.canvasArtEmbossAmbient ?? 0.2))
    const distance = bevel * 0.55
    const dx = Math.cos(angle) * distance; const dy = Math.sin(angle) * distance
    drawObjectInnerEdge(ctx, mask, '#ffffff', embossBlur, -dx, -dy, intensity * (1 - ambient * 0.35))
    drawObjectInnerEdge(ctx, mask, '#111827', embossBlur, dx, dy, intensity * (0.45 + ambient * 0.35))
  }
}
function installStyledObjectRenderers() {
  const prototypes = [FabricImage.prototype, Rect.prototype, Circle.prototype, Ellipse.prototype, Triangle.prototype, Polygon.prototype, FabricPath.prototype]
  for (const prototype of prototypes) {
    const record = prototype as unknown as Record<string, unknown>
    if (!Object.prototype.hasOwnProperty.call(record, '_render')) continue
    const nativeRender = record._render as (this: FabricObject, ctx: CanvasRenderingContext2D) => void
    record._render = function (this: FabricObject, ctx: CanvasRenderingContext2D) { renderStyledObject(this, ctx, nativeRender) }
  }
}
installStyledObjectRenderers()

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveLocal(value: CanvasArtProject) {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(value, AUTOSAVE_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function readLocal(): Promise<CanvasArtProject | undefined> {
  const db = await openDatabase()
  const value = await new Promise<CanvasArtProject | undefined>((resolve, reject) => {
    const request = db.transaction(DB_STORE).objectStore(DB_STORE).get(AUTOSAVE_ID)
    request.onsuccess = () => {
      try { resolve(request.result ? parseProject(request.result) : undefined) }
      catch (error) { reject(error) }
    }
    request.onerror = () => reject(request.error)
  })
  db.close()
  return value
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('Gagal membaca file'))
    reader.readAsDataURL(file)
  })
}

async function installFontAssets(fonts: FontAsset[]): Promise<FontAsset[]> {
  const installed: FontAsset[] = []
  for (const font of fonts) {
    try {
      const face = new FontFace(font.family, `url("${font.dataUrl}")`)
      await face.load()
      document.fonts.add(face)
      installed.push(font)
    } catch (error) {
      console.warn(`Font ${font.fileName} tidak dapat dimuat`, error)
    }
  }
  return installed
}

function getObjectName(object: FabricObject, index: number) {
  const candidate = object as FabricObject & { name?: string; id?: string }
  return candidate.name || (object.type === 'i-text' || object.type === 'text' ? (object as FabricText).text.slice(0, 22) || 'Text' : `${object.type || 'Object'} ${index + 1}`)
}

function App() {
  const canvasElement = useRef<HTMLCanvasElement>(null)
  const canvasFrame = useRef<HTMLDivElement>(null)
  const editor = useRef<Canvas | null>(null)
  const objectClipboard = useRef<FabricObject | null>(null)
  const pasteCount = useRef(0)
  const history = useRef<string[]>([])
  const future = useRef<string[]>([])
  const restoring = useRef(false)
  const snapEnabled = useRef(false)
  const snapSpacing = useRef(54)
  const spacePanRef = useRef(false)
  const selectedObjectRef = useRef<FabricObject | null>(null)
  const toolRef = useRef<'select' | 'draw' | 'bezier' | 'bezier-edit' | 'erase'>('select')
  const bezierPointsRef = useRef<BezierPoint[]>([])
  const bezierDragIndexRef = useRef<number | null>(null)
  const bezierEditObjectRef = useRef<FabricPath | null>(null)
  const bezierEditDragIndexRef = useRef<BezierEditDrag | null>(null)
  const bezierEditDirtyRef = useRef(false)
  const skipBackgroundSync = useRef(false)
  const projectMetadata = useRef<Partial<CanvasArtProject>>({})
  const fontAssetsRef = useRef<FontAsset[]>([])
  const [selected, setSelected] = useState<FabricObject | null>(null)
  const [clipboardHasObject, setClipboardHasObject] = useState(false)
  const [partialTextStart, setPartialTextStart] = useState(0)
  const [partialTextEnd, setPartialTextEnd] = useState(1)
  const [partialTextColor, setPartialTextColor] = useState('#f472b6')
  const [checkedLayers, setCheckedLayers] = useState<FabricObject[]>([])
  const [objects, setObjects] = useState<FabricObject[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('Presets')
  const [zoom, setZoom] = useState(100)
  const zoomAnchorRef = useRef<Point | null>(null)
  const zoomCurrentRef = useRef(1)
  const [grid, setGrid] = useState(false)
  const [snap, setSnap] = useState(false)
  const [gridSpacing, setGridSpacing] = useState(() => {
    try {
      const value = Number(localStorage.getItem('canvasart-grid-spacing-v1'))
      return Number.isFinite(value) && value >= 16 && value <= 200 ? value : 54
    } catch { return 54 }
  })
  const [tool, setTool] = useState<'select' | 'draw' | 'bezier' | 'bezier-edit' | 'erase'>('select')
  const [eraserWidth, setEraserWidth] = useState(32)
  const eraserWidthRef = useRef(32)
  const eraseSession = useRef<{ image: FabricImage; work: HTMLCanvasElement; last: { x: number; y: number } | null; changed: boolean } | null>(null)
  const [bezierPoints, setBezierPoints] = useState<BezierPoint[]>([])
  const [bezierColor, setBezierColor] = useState('#5268dc')
  const [bezierClosed, setBezierClosed] = useState(false)
  const [brushColor, setBrushColor] = useState('#202b47')
  const [brushSize, setBrushSize] = useState(8)
  const [brushSmooth, setBrushSmooth] = useState(0.4)
  const [brushDashed, setBrushDashed] = useState(false)
  const [arrowLength, setArrowLength] = useState(320)
  const [arrowThickness, setArrowThickness] = useState(32)
  const [arrowColor, setArrowColor] = useState('#5268dc')
  const [arrowHead, setArrowHead] = useState<'wide' | 'narrow' | 'none'>('wide')
  const [arrowTail, setArrowTail] = useState<'flat' | 'notched'>('flat')
  const [background, setBackground] = useState('#ffffff')
  const [backgroundGradientStart, setBackgroundGradientStart] = useState('#ffffff')
  const [backgroundGradientEnd, setBackgroundGradientEnd] = useState('#dbeafe')
  const [backgroundGradientType, setBackgroundGradientType] = useState<'linear' | 'radial'>('linear')
  const [transparent, setTransparent] = useState(false)
  const [status, setStatus] = useState('Siap')
  const hasUnsavedChanges = useRef(false)
  const editRevision = useRef(0)
  const [fontAssets, setFontAssets] = useState<FontAsset[]>([])
  const [savedTextStyles, setSavedTextStyles] = useState<SavedTextStyle[]>(() => {
    try {
      const value = localStorage.getItem('canvasart-text-styles-v1')
      const parsed: unknown = value ? JSON.parse(value) : []
      return Array.isArray(parsed) ? parsed.filter((item): item is SavedTextStyle => Boolean(item && typeof item.id === 'string' && typeof item.name === 'string' && item.properties && typeof item.properties === 'object')) : []
    } catch { return [] }
  })
  const [newTextStyleName, setNewTextStyleName] = useState('Gaya teks baru')
  fontAssetsRef.current = fontAssets
  const [projectName, setProjectName] = useState('Desain tanpa judul')
  const [canvasWidth, setCanvasWidth] = useState(1080)
  const [canvasHeight, setCanvasHeight] = useState(1080)
  const [canvasFrameWidth, setCanvasFrameWidth] = useState(710)
  const [scaleContentsOnResize, setScaleContentsOnResize] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraTarget, setCameraTarget] = useState<'background' | 'object'>('background')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const cameraVideo = useRef<HTMLVideoElement>(null)
  const cameraStream = useRef<MediaStream | null>(null)
  const cameraRequestId = useRef(0)
  const [showSize, setShowSize] = useState(false)
  const [showQuotes, setShowQuotes] = useState(false)
  const [quoteSearch, setQuoteSearch] = useState('')
  const [quoteCategory, setQuoteCategory] = useState<'all' | QuoteCategory>('all')
  const [quoteLanguage, setQuoteLanguage] = useState<'all' | QuoteLanguage>('all')
  const [favoriteQuotes, setFavoriteQuotes] = useState<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem('canvasart-favorite-quotes-v1') || '[]')
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch { return [] }
  })
  const [showFavoriteQuotesOnly, setShowFavoriteQuotesOnly] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showEmojiLibrary, setShowEmojiLibrary] = useState(false)
  const [emojiSearch, setEmojiSearch] = useState('')
  const [stickerCategory, setStickerCategory] = useState<'all' | StickerCategory>('all')
  const [favoriteStickers, setFavoriteStickers] = useState<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem('canvasart-sticker-favorites-v1') || '[]')
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch { return [] }
  })
  const [showFavoriteStickersOnly, setShowFavoriteStickersOnly] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png')
  const [exportScale, setExportScale] = useState(1)
  const [exportCustomDimensions, setExportCustomDimensions] = useState(false)
  const [exportCustomWidth, setExportCustomWidth] = useState(1080)
  const [exportCustomHeight, setExportCustomHeight] = useState(1080)
  const [exportFit, setExportFit] = useState<'contain' | 'stretch'>('contain')
  const [exportJpegQuality, setExportJpegQuality] = useState(0.92)
  const [exportPreviewUrl, setExportPreviewUrl] = useState('')
  const [exportPreviewError, setExportPreviewError] = useState('')
  const [exportPreviewLoading, setExportPreviewLoading] = useState(false)
  const [effects, setEffects] = useState({ brightness: 0, contrast: 0, saturation: 0, hue: 0, vignette: 0, noise: 0, stripes: 0 })
  const effectsRef = useRef(effects)
  effectsRef.current = effects
  const [noiseTile, setNoiseTile] = useState('')
  const [chromaColor, setChromaColor] = useState('#00ff00')
  const [chromaTolerance, setChromaTolerance] = useState(36)
  const [chromaSoftness, setChromaSoftness] = useState(20)

  const syncBackgroundControls = (canvas: Canvas) => {
    const value = canvas.backgroundColor
    if (typeof value === 'string') {
      const isTransparent = value === 'rgba(0,0,0,0)' || value === 'transparent'
      skipBackgroundSync.current = background !== value || transparent !== isTransparent
      setTransparent(isTransparent)
      if (!isTransparent) setBackground(value)
    } else {
      const firstStop = (value as { colorStops?: Array<{ color?: string }> } | undefined)?.colorStops?.[0]?.color
      skipBackgroundSync.current = transparent || Boolean(firstStop && firstStop !== background)
      setTransparent(false)
      if (firstStop) setBackground(firstStop)
    }
  }

  const serializeHistoryEntry = (canvas: Canvas) => JSON.stringify({
    canvas: canvas.toJSON(), width: canvas.getWidth(), height: canvas.getHeight(), effects: effectsRef.current,
  })

  const snapshot = useCallback(() => {
    const canvas = editor.current
    if (!canvas || restoring.current) return
    const value = serializeHistoryEntry(canvas)
    if (history.current.at(-1) !== value) history.current.push(value)
    if (history.current.length > 80) history.current.shift()
    future.current = []
    setObjects([...canvas.getObjects()])
    editRevision.current += 1
    hasUnsavedChanges.current = true
    setStatus('Belum disimpan')
  }, [])

  const syncObjects = useCallback(() => {
    const canvas = editor.current
    if (!canvas) return
    setObjects([...canvas.getObjects()])
    const active = canvas.getActiveObject()
    setSelected(active && !('type' in active && active.type === 'activeSelection') ? active : active || null)
  }, [])

  useEffect(() => {
    if (!canvasElement.current) return
    const canvas = new Canvas(canvasElement.current, {
      width: 1080,
      height: 1080,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
      stopContextMenu: true,
      fireRightClick: false,
    })
    editor.current = canvas
    const initialBrush = new PencilBrush(canvas)
    initialBrush.width = brushSize
    initialBrush.color = brushColor
    initialBrush.decimate = brushSmooth
    initialBrush.strokeDashArray = brushDashed ? [brushSize * 1.5, brushSize] : null
    canvas.freeDrawingBrush = initialBrush
    const zoomByRatio = (ratio: number, point: Point) => {
      const nextZoom = Math.max(0.25, Math.min(5, zoomCurrentRef.current * ratio))
      if (Math.abs(nextZoom - zoomCurrentRef.current) < 0.0001) return
      const percent = Math.round(nextZoom * 100)
      zoomCurrentRef.current = percent / 100
      zoomAnchorRef.current = point
      setZoom(percent)
    }
    canvas.on('mouse:wheel', (options) => {
      const event = options.e as WheelEvent
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault(); event.stopPropagation()
      zoomByRatio(Math.exp(-event.deltaY * 0.0015), canvas.getViewportPoint(event))
    })
    let pinchDistance = 0
    const touchPoint = (event: TouchEvent) => {
      const rect = canvas.upperCanvasEl.getBoundingClientRect()
      const x = (event.touches[0].clientX + event.touches[1].clientX) / 2
      const y = (event.touches[0].clientY + event.touches[1].clientY) / 2
      return new Point((x - rect.left) * canvas.getWidth() / rect.width, (y - rect.top) * canvas.getHeight() / rect.height)
    }
    const readPinchDistance = (event: TouchEvent) => Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY)
    const onTouchStart = (event: TouchEvent) => { if (event.touches.length === 2) pinchDistance = readPinchDistance(event) }
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchDistance) return
      event.preventDefault()
      const distance = readPinchDistance(event)
      zoomByRatio(distance / pinchDistance, touchPoint(event))
      pinchDistance = distance
    }
    const onTouchEnd = (event: TouchEvent) => { if (event.touches.length < 2) pinchDistance = 0 }
    canvas.upperCanvasEl.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.upperCanvasEl.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.upperCanvasEl.addEventListener('touchend', onTouchEnd, { passive: true })
    canvas.upperCanvasEl.addEventListener('touchcancel', onTouchEnd, { passive: true })
    let panState: { point: Point; selection: boolean; skipTargetFind: boolean; cursor: string } | null = null
    canvas.on('mouse:down:before', (options) => {
      const event = options.e as MouseEvent
      if (event.button !== 1 && !spacePanRef.current) return
      panState = { point: canvas.getViewportPoint(event), selection: canvas.selection, skipTargetFind: canvas.skipTargetFind, cursor: canvas.defaultCursor }
      canvas.selection = false; canvas.skipTargetFind = true; canvas.defaultCursor = 'grabbing'; canvas.setCursor('grabbing')
      event.preventDefault()
    })
    canvas.on('selection:created', syncObjects)
    canvas.on('selection:updated', syncObjects)
    canvas.on('selection:cleared', syncObjects)
    canvas.on('object:added', () => { if (!restoring.current) { syncObjects(); snapshot() } })
    canvas.on('object:removed', (event) => {
      const removed = event.target as (FabricObject & { canvasArtId?: string; canvasArtWarpSourceId?: string }) | undefined
      if (!restoring.current && removed) {
        if (removed.canvasArtWarpSourceId) {
          const source = canvas.getObjects().find((object) => (object as FabricObject & { canvasArtId?: string }).canvasArtId === removed.canvasArtWarpSourceId)
          const state = removed as FabricObject & { canvasArtWarpSourceVisible?: boolean; canvasArtWarpSourceSelectable?: boolean }
          source?.set({ visible: state.canvasArtWarpSourceVisible ?? true, selectable: state.canvasArtWarpSourceSelectable ?? true } as never)
        }
        if (removed.canvasArtId) {
          canvas.getObjects().filter((object) => (object as FabricObject & { canvasArtWarpSourceId?: string }).canvasArtWarpSourceId === removed.canvasArtId).forEach((object) => object.set({ canvasArtWarpSourceId: undefined } as never))
        }
      }
      if (!restoring.current) { syncObjects(); snapshot() }
    })
    canvas.on('object:modified', async (event) => {
      const target = event.target as (FabricObject & { canvasArt3DRotateX?: number; canvasArt3DRotateY?: number; canvasArt3DBaseScaleX?: number; canvasArt3DBaseScaleY?: number }) | undefined
      if (target && ['text', 'i-text', 'textbox'].includes(target.type || '') && (target.canvasArt3DRotateX || target.canvasArt3DRotateY)) {
        const rotateX = (target.canvasArt3DRotateX || 0) * Math.PI / 180
        const rotateY = (target.canvasArt3DRotateY || 0) * Math.PI / 180
        target.set({ canvasArt3DBaseScaleX: (target.scaleX || 1) / Math.max(0.17, Math.cos(rotateY)), canvasArt3DBaseScaleY: (target.scaleY || 1) / Math.max(0.17, Math.cos(rotateX)) } as never)
      }
      if (target?.type === 'path' && 'canvasArtId' in target) await syncPathMaskDependents(canvas, target as FabricPath & { canvasArtId?: string })
      syncObjects(); snapshot()
    })
    canvas.on('object:moving', (event) => {
      if (!snapEnabled.current || !event.target) return
      const spacing = snapSpacing.current
      event.target.set({ left: Math.round((event.target.left || 0) / spacing) * spacing, top: Math.round((event.target.top || 0) / spacing) * spacing })
    })
    const pointOnImage = (image: FabricImage, scene: { x: number; y: number }) => {
      const [a, b, c, d, e, f] = image.calcTransformMatrix()
      const determinant = a * d - b * c
      if (!determinant) return null
      const dx = scene.x - e
      const dy = scene.y - f
      const localX = (d * dx - c * dy) / determinant
      const localY = (-b * dx + a * dy) / determinant
      const cropX = image.cropX || 0
      const cropY = image.cropY || 0
      const x = cropX + localX + (image.width || 0) / 2
      const y = cropY + localY + (image.height || 0) / 2
      if (x < cropX || y < cropY || x > cropX + (image.width || 0) || y > cropY + (image.height || 0)) return null
      return { x, y }
    }
    const paintErasePoint = (session: NonNullable<typeof eraseSession.current>, point: { x: number; y: number }) => {
      const context = session.work.getContext('2d')
      if (!context) return
      const image = session.image
      context.save()
      context.beginPath()
      context.rect(image.cropX || 0, image.cropY || 0, image.width || session.work.width, image.height || session.work.height)
      context.clip()
      context.globalCompositeOperation = 'destination-out'
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.lineWidth = eraserWidthRef.current
      context.beginPath()
      if (session.last) {
        context.moveTo(session.last.x, session.last.y)
        context.lineTo(point.x, point.y)
        context.stroke()
      } else {
        context.arc(point.x, point.y, eraserWidthRef.current / 2, 0, Math.PI * 2)
        context.fill()
      }
      context.restore()
      session.last = point
      session.changed = true
    }
    const finishEraseStroke = () => {
      const session = eraseSession.current
      eraseSession.current = null
      if (!session || !session.changed) return
      const image = session.image
      const width = image.width || session.work.width
      const height = image.height || session.work.height
      const cropX = image.cropX || 0
      const cropY = image.cropY || 0
      const oldFilters = [...image.filters]
      image.filters = []
      void image.setSrc(session.work.toDataURL('image/png')).then(() => {
        image.set({ width, height, cropX, cropY })
        image.setCoords()
        canvas.requestRenderAll()
        syncObjects()
        snapshot()
        setStatus('Sapuan penghapus diterapkan · Undo untuk memulihkan')
      }).catch((error) => {
        image.filters = oldFilters
        image.applyFilters()
        canvas.requestRenderAll()
        window.alert(`Sapuan penghapus gagal diterapkan: ${error instanceof Error ? error.message : 'gambar tidak valid'}`)
      })
    }
    canvas.on('mouse:down', (event) => {
      if (toolRef.current === 'erase' && event.e) {
        const target = canvas.getActiveObject()
        if (!target || target.type !== 'image') {
          setStatus('Pilih layer gambar sebelum memakai penghapus')
          return
        }
        const image = target as FabricImage
        const element = image.getElement() as HTMLImageElement
        const width = element.naturalWidth || element.width || 0
        const height = element.naturalHeight || element.height || 0
        if (!width || !height) { setStatus('Ukuran gambar tidak valid'); return }
        const work = document.createElement('canvas')
        work.width = width
        work.height = height
        const context = work.getContext('2d')
        if (!context) { setStatus('Canvas penghapus tidak tersedia'); return }
        context.drawImage(element, 0, 0, width, height)
        const point = pointOnImage(image, canvas.getScenePoint(event.e))
        if (point) {
          eraseSession.current = { image, work, last: null, changed: false }
          paintErasePoint(eraseSession.current, point)
        }
        return
      }
      if (toolRef.current === 'bezier-edit' && event.e) {
        const path = bezierEditObjectRef.current as (FabricPath & { canvasArtBezierPoints?: BezierPoint[] }) | null
        const points = path?.canvasArtBezierPoints || []
        if (!path || !points.length) return
        const pointer = canvas.getScenePoint(event.e)
        const visible = transformBezierPoints(path, points)
        const radius = 18 / Math.max(0.1, canvas.getZoom())
        let nearest: BezierEditDrag | null = null; let nearestDistance = radius
        visible.forEach((point, index) => {
          const candidates: { handle: BezierEditDrag['handle']; x: number; y: number }[] = [{ handle: 'anchor', x: point.x, y: point.y }]
          if (point.handleIn) candidates.push({ handle: 'in', x: point.x + point.handleIn.x, y: point.y + point.handleIn.y })
          if (point.handleOut) candidates.push({ handle: 'out', x: point.x + point.handleOut.x, y: point.y + point.handleOut.y })
          candidates.forEach((candidate) => { const distance = Math.hypot(candidate.x - pointer.x, candidate.y - pointer.y); if (distance < nearestDistance) { nearest = { index, handle: candidate.handle }; nearestDistance = distance } })
        })
        bezierEditDragIndexRef.current = nearest
        return
      }
      if (toolRef.current !== 'bezier' || !event.e) return
      const pointer = canvas.getScenePoint(event.e)
      const point = { x: Math.round(pointer.x), y: Math.round(pointer.y) }
      bezierDragIndexRef.current = bezierPointsRef.current.length
      bezierPointsRef.current = [...bezierPointsRef.current, point]
      setBezierPoints(bezierPointsRef.current)
    })
    canvas.on('mouse:move', (event) => {
      if (panState && event.e) {
        const point = canvas.getViewportPoint(event.e)
        const viewport = canvas.viewportTransform
        viewport[4] += point.x - panState.point.x
        viewport[5] += point.y - panState.point.y
        panState.point = point
        canvas.setViewportTransform(viewport); canvas.requestRenderAll()
        return
      }
      const session = eraseSession.current
      if (session && event.e) {
        const point = pointOnImage(session.image, canvas.getScenePoint(event.e))
        if (point) paintErasePoint(session, point)
        else session.last = null
        return
      }
      if (toolRef.current === 'bezier-edit' && bezierEditDragIndexRef.current !== null && event.e) {
        const path = bezierEditObjectRef.current as (FabricPath & { canvasArtBezierPoints?: BezierPoint[]; _setPath(pathData: string, adjustPosition?: boolean): void }) | null
        const points = path?.canvasArtBezierPoints
        const drag = bezierEditDragIndexRef.current
        if (!path || !points || !drag) return
        const index = drag.index
        if (!points[index]) return
        const pointer = canvas.getScenePoint(event.e)
        const [a, b, c, d, e, f] = path.calcTransformMatrix()
        const determinant = a * d - b * c
        if (!determinant) return
        const oldOffset = path.pathOffset || new Point(0, 0)
        const localX = (d * (pointer.x - e) - c * (pointer.y - f)) / determinant + oldOffset.x
        const localY = (-b * (pointer.x - e) + a * (pointer.y - f)) / determinant + oldOffset.y
        const next = points.map((point, pointIndex) => {
          if (pointIndex !== index) return { ...point }
          if (drag.handle === 'anchor') return { ...point, x: localX, y: localY }
          const handle = { x: localX - point.x, y: localY - point.y }
          return drag.handle === 'in'
            ? { ...point, handleIn: handle, handleOut: { x: -handle.x, y: -handle.y } }
            : { ...point, handleOut: handle, handleIn: { x: -handle.x, y: -handle.y } }
        })
        const center = path.getCenterPoint()
        path._setPath(bezierPathData(next, Boolean((path as FabricPath & { canvasArtBezierClosed?: boolean }).canvasArtBezierClosed)), false)
        const newOffset = path.pathOffset || new Point(0, 0)
        const offsetX = newOffset.x - oldOffset.x
        const offsetY = newOffset.y - oldOffset.y
        path.setPositionByOrigin(new Point(center.x + a * offsetX + c * offsetY, center.y + b * offsetX + d * offsetY), 'center', 'center')
        path.set({ canvasArtBezierPoints: next, dirty: true } as never)
        path.setCoords(); canvas.requestRenderAll()
        bezierPointsRef.current = next; setBezierPoints(next); bezierEditDirtyRef.current = true
        return
      }
      const index = bezierDragIndexRef.current
      if (toolRef.current !== 'bezier' || index === null || !event.e) return
      const pointer = canvas.getScenePoint(event.e)
      const anchor = bezierPointsRef.current[index]
      if (!anchor) return
      const dx = pointer.x - anchor.x
      const dy = pointer.y - anchor.y
      if (Math.hypot(dx, dy) < 6) return
      const next = [...bezierPointsRef.current]
      next[index] = { ...anchor, handleOut: { x: dx, y: dy }, handleIn: { x: -dx, y: -dy } }
      bezierPointsRef.current = next
      setBezierPoints(next)
    })
    canvas.on('mouse:up', async () => {
      if (panState) {
        canvas.selection = panState.selection; canvas.skipTargetFind = panState.skipTargetFind
        canvas.defaultCursor = spacePanRef.current ? 'grab' : panState.cursor === 'grab' ? 'default' : panState.cursor
        canvas.setCursor(canvas.defaultCursor); panState = null
        return
      }
      bezierDragIndexRef.current = null
      if (bezierEditDragIndexRef.current !== null && bezierEditDirtyRef.current) {
        const path = bezierEditObjectRef.current as (FabricPath & { canvasArtId?: string }) | null
        bezierEditDragIndexRef.current = null; bezierEditDirtyRef.current = false
        if (path) await syncPathMaskDependents(canvas, path)
        syncObjects(); snapshot()
      } else bezierEditDragIndexRef.current = null
      finishEraseStroke()
    })
    canvas.on('path:created', () => { syncObjects(); snapshot() })
    history.current = [serializeHistoryEntry(canvas)]
    void readLocal().then(async (saved) => {
      if (!saved || !editor.current || editor.current.getObjects().length) return
      projectMetadata.current = saved
      setSavedTextStyles(saved.textStyles || [])
      const restoredBrush = getBrushSettings(saved.brush)
      setBrushColor(restoredBrush.color); setBrushSize(restoredBrush.size); setBrushSmooth(restoredBrush.smooth); setBrushDashed(restoredBrush.dashed)
      const restoredFonts = await installFontAssets(saved.fonts || [])
      fontAssetsRef.current = restoredFonts
      setFontAssets(restoredFonts)
      restoring.current = true
      editor.current.loadFromJSON(saved.canvas.rendererState).then(() => {
        editor.current!.setDimensions({ width: saved.canvas.width, height: saved.canvas.height })
        setProjectName(saved.name || 'Desain tanpa judul')
        setCanvasWidth(saved.canvas.width); setCanvasHeight(saved.canvas.height)
        const restoredEffects = { brightness: 0, contrast: 0, saturation: 0, hue: 0, vignette: 0, noise: 0, stripes: 0, ...saved.effects }
        effectsRef.current = restoredEffects
        setEffects(restoredEffects)
        syncBackgroundControls(editor.current!)
        setObjects([...editor.current!.getObjects()])
        history.current = [serializeHistoryEntry(editor.current!)]
        setStatus('Autosave dipulihkan')
        restoring.current = false
      }).catch(() => { restoring.current = false })
    }).catch(() => setStatus('Autosave belum tersedia'))
    return () => {
      canvas.upperCanvasEl.removeEventListener('touchstart', onTouchStart)
      canvas.upperCanvasEl.removeEventListener('touchmove', onTouchMove)
      canvas.upperCanvasEl.removeEventListener('touchend', onTouchEnd)
      canvas.upperCanvasEl.removeEventListener('touchcancel', onTouchEnd)
      void canvas.dispose(); editor.current = null
    }
    // The editor is initialized once; brush is updated in its own effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canvas = editor.current
    if (!canvas) return
    toolRef.current = tool
    canvas.isDrawingMode = tool === 'draw'
    canvas.skipTargetFind = tool === 'bezier' || tool === 'erase'
    canvas.selection = tool !== 'bezier' && tool !== 'erase'
    eraserWidthRef.current = eraserWidth
    if (canvas.freeDrawingBrush) {
      const brush = canvas.freeDrawingBrush as PencilBrush
      brush.color = brushColor
      brush.width = brushSize
      brush.decimate = brushSmooth
      brush.strokeDashArray = brushDashed ? [brushSize * 1.5, brushSize] : null
    }
  }, [tool, brushColor, brushSize, brushSmooth, brushDashed, eraserWidth])

  useEffect(() => {
    const canvas = editor.current
    if (!canvas) return
    if (skipBackgroundSync.current) { skipBackgroundSync.current = false; return }
    const nextBackground = transparent ? 'rgba(0,0,0,0)' : background
    if (canvas.backgroundColor === nextBackground) return
    canvas.backgroundColor = nextBackground
    canvas.requestRenderAll()
    setStatus('Belum disimpan')
    snapshot()
  }, [background, transparent, snapshot])

  useEffect(() => {
    projectMetadata.current = { ...projectMetadata.current, textStyles: savedTextStyles }
    try { localStorage.setItem('canvasart-text-styles-v1', JSON.stringify(savedTextStyles)) }
    catch { setStatus('Gaya teks tidak dapat disimpan di penyimpanan browser') }
  }, [savedTextStyles])

  useEffect(() => {
    try { localStorage.setItem('canvasart-favorite-quotes-v1', JSON.stringify(favoriteQuotes)) }
    catch { setStatus('Favorit kutipan tidak dapat disimpan di browser') }
  }, [favoriteQuotes])

  useEffect(() => {
    try { localStorage.setItem('canvasart-sticker-favorites-v1', JSON.stringify(favoriteStickers)) }
    catch { setStatus('Favorit stiker tidak dapat disimpan di browser') }
  }, [favoriteStickers])

  useEffect(() => {
    const canvas = editor.current
    if (!canvas) return
    const anchor = zoomAnchorRef.current || new Point(canvas.getWidth() / 2, canvas.getHeight() / 2)
    canvas.zoomToPoint(anchor, zoom / 100)
    zoomCurrentRef.current = zoom / 100
    zoomAnchorRef.current = null
    canvas.requestRenderAll()
  }, [zoom])

  useEffect(() => {
    const canvas = editor.current
    if (!canvas) return
    if (previewMode) canvas.discardActiveObject()
    canvas.selection = !previewMode
    canvas.skipTargetFind = previewMode
    canvas.requestRenderAll()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && previewMode) setPreviewMode(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewMode])

  useEffect(() => {
    const canvas = canvasElement.current
    if (canvas) canvas.style.filter = `brightness(${100 + effects.brightness}%) contrast(${100 + effects.contrast}%) saturate(${100 + effects.saturation}%) hue-rotate(${effects.hue}deg)`
  }, [effects.brightness, effects.contrast, effects.saturation, effects.hue])

  useEffect(() => {
    if (cameraActive && cameraVideo.current && cameraStream.current) cameraVideo.current.srcObject = cameraStream.current
  }, [cameraActive])

  useEffect(() => {
    if (!showCamera) {
      cameraStream.current?.getTracks().forEach((track) => track.stop())
      cameraStream.current = null
      setCameraActive(false)
    }
    return () => {
      cameraRequestId.current += 1
      cameraStream.current?.getTracks().forEach((track) => track.stop())
      cameraStream.current = null
    }
  }, [showCamera])

  useEffect(() => {
    if (!effects.noise) { setNoiseTile(''); return }
    const tile = document.createElement('canvas')
    tile.width = 72; tile.height = 72
    const context = tile.getContext('2d')
    if (!context) return
    const imageData = context.createImageData(tile.width, tile.height)
    let seed = 3791
    for (let i = 0; i < imageData.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const value = seed & 255
      imageData.data[i] = value; imageData.data[i + 1] = value; imageData.data[i + 2] = value; imageData.data[i + 3] = Math.round(effects.noise * 1.5)
    }
    context.putImageData(imageData, 0, 0)
    setNoiseTile(tile.toDataURL('image/png'))
  }, [effects.noise])

  useEffect(() => { snapEnabled.current = snap }, [snap])
  useEffect(() => {
    snapSpacing.current = gridSpacing
    try { localStorage.setItem('canvasart-grid-spacing-v1', String(gridSpacing)) } catch { /* workspace preference is optional */ }
  }, [gridSpacing])
  useEffect(() => {
    const frame = canvasFrame.current
    if (!frame) return
    const measure = () => setCanvasFrameWidth(frame.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const persist = () => {
      const canvas = editor.current
      if (!canvas) return
      const revision = editRevision.current
      projectMetadata.current = { ...projectMetadata.current, effects, fonts: fontAssets, textStyles: savedTextStyles, brush: getBrushSettings({ color: brushColor, size: brushSize, smooth: brushSmooth, dashed: brushDashed }) }
      const value = createProject(projectName, canvas.toJSON(), canvas.getWidth(), canvas.getHeight(), projectMetadata.current)
      projectMetadata.current = value
      void saveLocal(value).then(() => {
        if (revision !== editRevision.current) return
        hasUnsavedChanges.current = false
        setStatus('Autosave tersimpan')
      }).catch(() => setStatus('Gagal autosave'))
    }
    const timer = window.setInterval(persist, 4000)
    const flush = () => {
      const canvas = editor.current
      if (!canvas) return
      projectMetadata.current = { ...projectMetadata.current, effects, fonts: fontAssets, textStyles: savedTextStyles, brush: getBrushSettings({ color: brushColor, size: brushSize, smooth: brushSmooth, dashed: brushDashed }) }
      const value = createProject(projectName, canvas.toJSON(), canvas.getWidth(), canvas.getHeight(), projectMetadata.current)
      const request = indexedDB.open(DB_NAME, 1)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(DB_STORE, 'readwrite')
        tx.objectStore(DB_STORE).put(value, AUTOSAVE_ID)
        tx.oncomplete = () => db.close()
        tx.onerror = () => db.close()
      }
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush()
      if (!hasUnsavedChanges.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.clearInterval(timer); window.removeEventListener('pagehide', flush); window.removeEventListener('beforeunload', beforeUnload) }
  }, [projectName, effects, fontAssets, savedTextStyles, brushColor, brushSize, brushSmooth, brushDashed])

  const selectedText = selected && (selected.type === 'i-text' || selected.type === 'text' || selected.type === 'textbox') ? selected as FabricText : null
  selectedObjectRef.current = selected
  const objectCountLabel = useMemo(() => `${objects.length} layer`, [objects.length])

  const commit = () => snapshot()
  const renderWarpedObject = (source: FabricObject, corners: PerspectiveCorner[]) => {
    const sourceState = source as FabricObject & { canvasArtId?: string; canvasArtWarpSourceVisible?: boolean; canvasArtWarpSourceSelectable?: boolean }
    const sourceVisible = source.visible ?? true
    source.set({ visible: true })
    let raster: HTMLCanvasElement
    try { raster = source.toCanvasElement({ withoutTransform: true, enableRetinaScaling: false, multiplier: 1 }) } finally { source.set({ visible: sourceVisible }) }
    const warped = renderPerspectiveWarp(raster, corners)
    const center = source.getCenterPoint()
    const localX = warped.offsetX + warped.element.width / 2 - warped.sourceWidth / 2
    const localY = warped.offsetY + warped.element.height / 2 - warped.sourceHeight / 2
    const angle = (source.angle || 0) * Math.PI / 180
    const localScaledX = localX * (source.scaleX || 1) * (source.flipX ? -1 : 1)
    const localScaledY = localY * (source.scaleY || 1) * (source.flipY ? -1 : 1)
    const outputCenter = new Point(center.x + Math.cos(angle) * localScaledX - Math.sin(angle) * localScaledY, center.y + Math.sin(angle) * localScaledX + Math.cos(angle) * localScaledY)
    const output = new FabricImage(warped.element, {
      left: outputCenter.x, top: outputCenter.y, originX: 'center', originY: 'center',
      angle: source.angle || 0, scaleX: source.scaleX || 1, scaleY: source.scaleY || 1,
      flipX: source.flipX, flipY: source.flipY, name: `${getObjectName(source, 0)} · Perspektif`,
      canvasArtWarpSourceId: sourceState.canvasArtId,
      canvasArtWarpSourceVisible: sourceState.canvasArtWarpSourceVisible,
      canvasArtWarpSourceSelectable: sourceState.canvasArtWarpSourceSelectable,
      canvasArtWarpCorners: corners.map((point) => ({ ...point })),
    } as never)
    return output
  }
  const applyPerspectiveWarp = () => {
    const canvas = editor.current
    if (!canvas || !selected || selected.type === 'activeSelection') return
    if ((selected as FabricObject & { canvasArtWarpSourceId?: string }).canvasArtWarpSourceId) { setStatus('Objek ini sudah memiliki warp perspektif'); return }
    try {
      const source = selected as FabricObject & { canvasArtId?: string }
      source.canvasArtId ||= crypto.randomUUID()
      source.set({ canvasArtWarpSourceVisible: source.visible ?? true, canvasArtWarpSourceSelectable: source.selectable ?? true } as never)
      const corners: PerspectiveCorner[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
      const output = renderWarpedObject(source, corners)
      const index = canvas.getObjects().indexOf(source)
      source.set({ visible: false, selectable: false } as never)
      canvas.insertAt(Math.max(0, index + 1), output)
      canvas.setActiveObject(output); canvas.requestRenderAll(); syncObjects(); snapshot()
      setStatus('Warp perspektif aktif. Atur empat sudut pada panel objek.')
    } catch (error) { setStatus(`Warp perspektif gagal: ${error instanceof Error ? error.message : 'render gagal'}`) }
  }
  const updatePerspectiveCorner = (index: number, axis: 'x' | 'y', value: number) => {
    const canvas = editor.current
    const target = selected as (FabricImage & { canvasArtWarpSourceId?: string; canvasArtWarpCorners?: PerspectiveCorner[] }) | null
    if (!canvas || target?.type !== 'image' || !target.canvasArtWarpSourceId) return
    const source = canvas.getObjects().find((object) => (object as FabricObject & { canvasArtId?: string }).canvasArtId === target.canvasArtWarpSourceId)
    if (!source) { setStatus('Sumber objek warp tidak ditemukan'); return }
    const corners = target.canvasArtWarpCorners?.map((point) => ({ ...point })) || [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
    corners[index] = { ...corners[index], [axis]: Math.max(-0.5, Math.min(1.5, value)) }
    const oldCenter = target.getCenterPoint()
    const sourceCenter = source.getCenterPoint()
    const output = renderWarpedObject(source, corners)
    const newCenter = output.getCenterPoint()
    const deltaX = oldCenter.x - sourceCenter.x
    const deltaY = oldCenter.y - sourceCenter.y
    output.set({ left: newCenter.x + deltaX, top: newCenter.y + deltaY } as never)
    const at = canvas.getObjects().indexOf(target)
    restoring.current = true
    canvas.remove(target); canvas.insertAt(Math.max(0, at), output); restoring.current = false; canvas.setActiveObject(output)
    canvas.requestRenderAll(); syncObjects(); snapshot()
  }
  const removePerspectiveWarp = () => {
    const canvas = editor.current
    const target = selected as (FabricImage & { canvasArtWarpSourceId?: string; canvasArtWarpSourceVisible?: boolean; canvasArtWarpSourceSelectable?: boolean }) | null
    if (!canvas || !target?.canvasArtWarpSourceId) return
    const source = canvas.getObjects().find((object) => (object as FabricObject & { canvasArtId?: string }).canvasArtId === target.canvasArtWarpSourceId)
    if (!source) return
    const center = target.getCenterPoint()
    source.set({ angle: target.angle, scaleX: target.scaleX, scaleY: target.scaleY, flipX: target.flipX, flipY: target.flipY } as never)
    source.setPositionByOrigin(center, 'center', 'center')
    source.set({ visible: target.canvasArtWarpSourceVisible ?? true, selectable: target.canvasArtWarpSourceSelectable ?? true } as never)
    canvas.remove(target); canvas.setActiveObject(source); canvas.requestRenderAll(); syncObjects(); snapshot()
    setStatus('Warp dilepas; layer sumber dipulihkan')
  }
  const updateEffects = (patch: Partial<typeof effects>) => {
    const next = { ...effectsRef.current, ...patch }
    effectsRef.current = next
    setEffects(next)
    snapshot()
  }
  const addText = () => {
    const canvas = editor.current
    if (!canvas) return
    const text = new FabricText('Teks Anda', { left: 240, top: 390, fontFamily: 'Arial', fontSize: 82, fill: '#202b47', name: 'Teks' } as never)
    canvas.add(text)
    canvas.setActiveObject(text)
    setActiveTab('Text')
    syncObjects()
  }
  const addDate = () => {
    const canvas = editor.current
    if (!canvas) return
    const text = new FabricText(new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date()), { left: 240, top: 500, fontFamily: 'Arial', fontSize: 42, fill: '#64708a', name: 'Tanggal' } as never)
    canvas.add(text); canvas.setActiveObject(text); setActiveTab('Text'); syncObjects()
  }
  const applyTextPreset = (name: string) => {
    const canvas = editor.current
    if (!canvas) return
    if (name === 'Meme') {
      const width = canvas.getWidth()
      const height = canvas.getHeight()
      const size = Math.max(28, Math.min(86, Math.round(width * 0.055)))
      const textOptions = { left: width / 2, fontSize: size, fontFamily: 'Impact', fontWeight: 'bold', fill: '#ffffff', stroke: '#171717', strokeWidth: Math.max(2, size * 0.055), originX: 'center', textAlign: 'center', shadow: { color: 'rgba(0,0,0,0.42)', blur: 2, offsetX: 1, offsetY: 2 } }
      const top = new FabricText('TEKS MEME ATAS', { ...textOptions, top: height * 0.045, name: 'Teks meme atas' } as never)
      const bottom = new FabricText('TEKS MEME BAWAH', { ...textOptions, top: height * 0.88, name: 'Teks meme bawah' } as never)
      canvas.add(top, bottom)
      canvas.setActiveObject(top)
      setActiveTab('Text')
      syncObjects()
      commit()
      return
    }
    const text = selectedText || new FabricText('Teks Anda', {
      left: Math.max(0, canvas.getWidth() * 0.22), top: Math.max(0, canvas.getHeight() * 0.4),
      fontFamily: 'Arial', fontSize: 82, fill: '#202b47', name: 'Teks',
    } as never)
    const styles: Record<string, Record<string, unknown>> = {
      Default: { fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal', fontSize: 82, fill: '#202b47', stroke: null, strokeWidth: 0, shadow: null, charSpacing: 0, textBackgroundColor: '' },
      Thin: { fontFamily: 'Arial', fontWeight: '300', fontStyle: 'normal', fontSize: 72, fill: '#64748b', stroke: null, strokeWidth: 0, shadow: null, charSpacing: 80 },
      'Keep Calm': { fontFamily: 'Arial', fontWeight: 'bold', fontStyle: 'normal', fontSize: 64, fill: '#675f4e', stroke: null, strokeWidth: 0, shadow: null, charSpacing: 105 },
      '3D': { fontFamily: 'Arial', fontWeight: 'bold', fontSize: 82, fill: '#f6c84c', stroke: '#6845b5', strokeWidth: 1, shadow: { color: '#34236e', blur: 0, offsetX: 8, offsetY: 8 } },
      '3D Text': { fontFamily: 'Impact', fontWeight: 'bold', fontSize: 86, fill: '#7de3ff', stroke: '#184d98', strokeWidth: 2, shadow: { color: '#112c63', blur: 0, offsetX: 12, offsetY: 12 } },
      'Old Text': { fontFamily: 'Georgia', fontWeight: 'normal', fontStyle: 'italic', fontSize: 76, fill: '#765136', stroke: '#e7d2ad', strokeWidth: 1, shadow: { color: 'rgba(76,45,24,0.3)', blur: 3, offsetX: 2, offsetY: 3 } },
      'New Text': { fontFamily: 'Arial', fontWeight: 'bold', fontStyle: 'normal', fontSize: 82, fill: '#5268dc', stroke: '#ffffff', strokeWidth: 1, shadow: { color: 'rgba(47,67,150,0.22)', blur: 8, offsetX: 0, offsetY: 4 } },
    }
    text.set(styles[name] as never)
    text.setCoords()
    if (!selectedText) canvas.add(text)
    canvas.setActiveObject(text)
    canvas.requestRenderAll()
    setActiveTab('Text')
    syncObjects()
    commit()
  }
  const addEmojiSticker = (emoji: string) => {
    const canvas = editor.current
    if (!canvas) return
    const sticker = new FabricText(emoji, {
      left: Math.max(0, (canvas.getWidth() - 180) / 2),
      top: Math.max(0, (canvas.getHeight() - 180) / 2),
      fontFamily: 'Apple Color Emoji, Noto Color Emoji, Segoe UI Emoji, sans-serif',
      fontSize: 180,
      name: `Stiker ${emoji}`,
    } as never)
    canvas.add(sticker)
    canvas.setActiveObject(sticker)
    setShowEmojiLibrary(false)
    setEmojiSearch('')
    setActiveTab('Object')
    syncObjects()
  }
  const addVectorSticker = async (sticker: StickerAsset) => {
    const canvas = editor.current
    if (!canvas) return
    try {
      const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sticker.svg)}`
      const image = await FabricImage.fromURL(src)
      const size = Math.min(240, Math.max(100, canvas.getWidth() * 0.18))
      image.set({ left: (canvas.getWidth() - size) / 2, top: (canvas.getHeight() - size) / 2, scaleX: size / (image.width || size), scaleY: size / (image.height || size), name: `Stiker · ${sticker.name}` } as never)
      canvas.add(image); canvas.setActiveObject(image); canvas.requestRenderAll()
      setShowEmojiLibrary(false); setEmojiSearch(''); setStickerCategory('all'); setShowFavoriteStickersOnly(false); setActiveTab('Object'); syncObjects(); commit()
    } catch (error) { setStatus(`Stiker tidak dapat dimuat: ${error instanceof Error ? error.message : 'SVG gagal dibaca'}`) }
  }
  const toggleStickerFavorite = (id: string) => setFavoriteStickers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const visibleStickers = STICKERS.filter((sticker) => {
    const query = emojiSearch.trim().toLocaleLowerCase('id')
    return (stickerCategory === 'all' || sticker.category === stickerCategory)
      && (!showFavoriteStickersOnly || favoriteStickers.includes(sticker.id))
      && (!query || sticker.name.toLocaleLowerCase('id').includes(query) || sticker.category.toLocaleLowerCase('id').includes(query))
  })
  const addShape = (type: 'rect' | 'circle' | 'triangle' | 'star' | 'pentagon' | 'hexagon' | 'diamond' | 'line') => {
    const canvas = editor.current
    if (!canvas) return
    let object: FabricObject
    if (type === 'rect') object = new Rect({ left: 340, top: 340, width: 320, height: 220, rx: 18, ry: 18, fill: '#8eafff', name: 'Persegi panjang' } as never)
    else if (type === 'circle') object = new Circle({ left: 380, top: 330, radius: 130, fill: '#ffd166', name: 'Lingkaran' } as never)
    else if (type === 'triangle') object = new Triangle({ left: 380, top: 330, width: 260, height: 250, fill: '#ff7c6e', name: 'Segitiga' } as never)
    else if (type === 'line') object = new FabricPath('M 0 0 L 320 0', { left: 340, top: 440, fill: 'rgba(0,0,0,0)', stroke: '#5268dc', strokeWidth: 10, name: 'Garis' } as never)
    else if (type === 'diamond') object = new Polygon([{ x: 140, y: 0 }, { x: 280, y: 140 }, { x: 140, y: 280 }, { x: 0, y: 140 }], { left: 380, top: 330, fill: '#ff7c6e', name: 'Belah ketupat' } as never)
    else if (type === 'pentagon' || type === 'hexagon') {
      const sides = type === 'pentagon' ? 5 : 6
      const points = Array.from({ length: sides }, (_, i) => {
        const angle = (Math.PI * 2 * i) / sides - Math.PI / 2
        return { x: 140 + Math.cos(angle) * 130, y: 140 + Math.sin(angle) * 130 }
      })
      object = new Polygon(points, { left: 380, top: 330, fill: '#8eafff', name: type === 'pentagon' ? 'Segi lima' : 'Segi enam' } as never)
    } else {
      const points = Array.from({ length: 10 }, (_, i) => {
        const radius = i % 2 ? 54 : 120
        const angle = (Math.PI * i) / 5 - Math.PI / 2
        return { x: 140 + Math.cos(angle) * radius, y: 140 + Math.sin(angle) * radius }
      })
      object = new Polygon(points, { left: 380, top: 330, fill: '#ff7c6e', name: 'Bintang' } as never)
    }
    canvas.add(object); canvas.setActiveObject(object); setActiveTab('Object'); syncObjects()
  }
  const addArrow = () => {
    const canvas = editor.current
    if (!canvas) return
    const shaft = arrowThickness
    const headWidth = arrowHead === 'wide' ? shaft * 2.8 : shaft * 1.8
    const headLength = arrowHead === 'none' ? 0 : Math.min(arrowLength * 0.38, headWidth * 1.2)
    const height = Math.max(shaft, headWidth)
    const center = height / 2
    const top = (height - shaft) / 2
    const bottom = (height + shaft) / 2
    const points = arrowHead === 'none'
      ? [{ x: 0, y: top }, { x: arrowLength, y: top }, { x: arrowLength, y: bottom }, { x: 0, y: bottom }]
      : [
          { x: 0, y: top },
          { x: arrowLength - headLength, y: top },
          { x: arrowLength - headLength, y: (height - headWidth) / 2 },
          { x: arrowLength, y: center },
          { x: arrowLength - headLength, y: (height + headWidth) / 2 },
          { x: arrowLength - headLength, y: bottom },
          { x: 0, y: bottom },
          ...(arrowTail === 'notched' ? [{ x: Math.min(shaft, arrowLength * 0.12), y: center }] : []),
        ]
    const arrow = new Polygon(points, {
      left: Math.max(0, (canvas.getWidth() - arrowLength) / 2),
      top: Math.max(0, (canvas.getHeight() - height) / 2),
      fill: arrowColor, stroke: arrowColor, strokeWidth: 2, name: 'Panah',
      canvasArtArrowLength: arrowLength, canvasArtArrowThickness: arrowThickness, canvasArtArrowHead: arrowHead, canvasArtArrowTail: arrowTail,
    } as never)
    canvas.add(arrow)
    canvas.setActiveObject(arrow)
    setActiveTab('Object')
    syncObjects()
  }
  const updateSelectedArrow = (patch: Partial<{ length: number; thickness: number; head: 'wide' | 'narrow' | 'none'; tail: 'flat' | 'notched' }>) => {
    const arrow = selected as (Polygon & { canvasArtArrowLength?: number; canvasArtArrowThickness?: number; canvasArtArrowHead?: 'wide' | 'narrow' | 'none'; canvasArtArrowTail?: 'flat' | 'notched' }) | null
    if (!arrow || !editor.current || !arrow.canvasArtArrowLength) return
    const length = Math.max(40, Math.min(1200, patch.length ?? arrow.canvasArtArrowLength))
    const thickness = Math.max(4, Math.min(240, patch.thickness ?? arrow.canvasArtArrowThickness ?? 32))
    const head = patch.head ?? arrow.canvasArtArrowHead ?? 'wide'
    const tail = patch.tail ?? arrow.canvasArtArrowTail ?? 'flat'
    const headWidth = head === 'wide' ? thickness * 2.8 : thickness * 1.8
    const headLength = head === 'none' ? 0 : Math.min(length * 0.38, headWidth * 1.2)
    const height = Math.max(thickness, headWidth)
    const center = height / 2
    const top = (height - thickness) / 2
    const bottom = (height + thickness) / 2
    const points = head === 'none'
      ? [{ x: 0, y: top }, { x: length, y: top }, { x: length, y: bottom }, { x: 0, y: bottom }]
      : [{ x: 0, y: top }, { x: length - headLength, y: top }, { x: length - headLength, y: (height - headWidth) / 2 }, { x: length, y: center }, { x: length - headLength, y: (height + headWidth) / 2 }, { x: length - headLength, y: bottom }, { x: 0, y: bottom }, ...(tail === 'notched' ? [{ x: Math.min(thickness, length * 0.12), y: center }] : [])]
    arrow.set({ points, canvasArtArrowLength: length, canvasArtArrowThickness: thickness, canvasArtArrowHead: head, canvasArtArrowTail: tail, objectCaching: false, dirty: true } as never)
    arrow.setDimensions()
    arrow.setCoords()
    editor.current.requestRenderAll()
    syncObjects()
    commit()
  }
  const applyBackgroundGradient = () => {
    const canvas = editor.current
    if (!canvas) return
    const width = canvas.getWidth()
    const height = canvas.getHeight()
    const gradient = backgroundGradientType === 'linear'
      ? new Gradient({ type: 'linear', coords: { x1: 0, y1: 0, x2: width, y2: height }, colorStops: [{ offset: 0, color: backgroundGradientStart }, { offset: 1, color: backgroundGradientEnd }] })
      : new Gradient({ type: 'radial', coords: { x1: width / 2, y1: height / 2, r1: 0, x2: width / 2, y2: height / 2, r2: Math.max(width, height) / 2 }, colorStops: [{ offset: 0, color: backgroundGradientStart }, { offset: 1, color: backgroundGradientEnd }] })
    canvas.backgroundColor = gradient
    canvas.requestRenderAll()
    if (transparent) {
      skipBackgroundSync.current = true
      setTransparent(false)
    }
    commit()
    setStatus(`Gradien ${backgroundGradientType === 'radial' ? 'radial' : 'linear'} diterapkan`)
  }
  const finishBezier = () => {
    const canvas = editor.current
    const points = bezierPointsRef.current
    if (!canvas || points.length < 2) { window.alert('Tambahkan sedikitnya dua titik untuk membuat path.'); return }
    const minX = Math.min(...points.map((point) => point.x))
    const minY = Math.min(...points.map((point) => point.y))
    const local = points.map((point) => ({ ...point, x: point.x - minX, y: point.y - minY }))
    const commands = bezierPathData(local, bezierClosed)
    const path = new FabricPath(commands, {
      left: minX, top: minY, fill: bezierClosed ? bezierColor : 'rgba(0,0,0,0)',
      stroke: bezierColor, strokeWidth: 5, strokeLineCap: 'round', strokeLineJoin: 'round',
      name: 'Kurva Bezier', objectCaching: false, canvasArtBezierPoints: local, canvasArtBezierClosed: bezierClosed,
    } as never)
    canvas.add(path); canvas.setActiveObject(path)
    bezierPointsRef.current = []; bezierDragIndexRef.current = null; setBezierPoints([]); setTool('select'); setActiveTab('Object'); syncObjects()
  }
  const cancelBezier = () => { bezierPointsRef.current = []; bezierDragIndexRef.current = null; setBezierPoints([]); setTool('select') }
  const startBezierEdit = () => {
    const path = selected as (FabricPath & { canvasArtBezierPoints?: BezierPoint[]; canvasArtBezierClosed?: boolean }) | null
    if (!path || path.type !== 'path' || !path.canvasArtBezierPoints?.length) return
    bezierEditObjectRef.current = path
    bezierPointsRef.current = path.canvasArtBezierPoints.map((point) => ({ ...point }))
    setBezierPoints(bezierPointsRef.current)
    setBezierClosed(Boolean(path.canvasArtBezierClosed))
    bezierEditDirtyRef.current = false
    setTool('bezier-edit'); setActiveTab('Object')
  }
  const finishBezierEdit = () => {
    bezierEditDragIndexRef.current = null
    if (bezierEditDirtyRef.current) { bezierEditDirtyRef.current = false; syncObjects(); snapshot() }
    bezierEditObjectRef.current = null
    bezierPointsRef.current = []; setBezierPoints([]); setTool('select')
  }
  const addImage = async (file?: File) => {
    if (!file || !editor.current) return
    const src = await readFileAsDataUrl(file)
    const image = await FabricImage.fromURL(src)
    const max = 620
    const factor = Math.min(max / (image.width || max), max / (image.height || max), 1)
    image.set({ left: 230, top: 230, scaleX: factor, scaleY: factor, name: file.name } as never)
    editor.current.add(image); editor.current.setActiveObject(image); setActiveTab('Object'); syncObjects()
  }
  const setImageFilter = (type: 'Brightness' | 'Contrast' | 'Saturation' | 'HueRotation', property: string, value: number) => {
    const image = selected?.type === 'image' ? selected as FabricImage : null
    if (!image || !editor.current) return
    const existing = image.filters.find((filter) => filter.type === type)
    if (value === 0) {
      image.filters = image.filters.filter((filter) => filter.type !== type)
    } else if (existing) {
      Object.assign(existing, { [property]: value })
    } else {
      const filter = type === 'Brightness' ? new filters.Brightness({ brightness: value })
        : type === 'Contrast' ? new filters.Contrast({ contrast: value })
          : type === 'Saturation' ? new filters.Saturation({ saturation: value })
            : new filters.HueRotation({ rotation: value })
      image.filters.push(filter)
    }
    image.applyFilters()
    image.setCoords()
    editor.current.requestRenderAll()
    syncObjects()
    commit()
  }
  const getImageFilter = (type: string, property: string) => {
    if (selected?.type !== 'image') return 0
    const filter = (selected as FabricImage).filters.find((item) => item.type === type) as unknown as Record<string, number> | undefined
    return filter?.[property] || 0
  }
  const updateImageCrop = (property: 'cropX' | 'cropY' | 'width' | 'height', value: number) => {
    const image = selected?.type === 'image' ? selected as FabricImage : null
    if (!image || !editor.current) return
    const element = image.getElement() as HTMLImageElement
    const sourceWidth = element.naturalWidth || element.width || image.width || 1
    const sourceHeight = element.naturalHeight || element.height || image.height || 1
    let cropX = image.cropX || 0
    let cropY = image.cropY || 0
    let width = image.width || sourceWidth
    let height = image.height || sourceHeight
    if (property === 'cropX') cropX = Math.max(0, Math.min(sourceWidth - width, Math.round(value)))
    if (property === 'cropY') cropY = Math.max(0, Math.min(sourceHeight - height, Math.round(value)))
    if (property === 'width') width = Math.max(1, Math.min(sourceWidth - cropX, Math.round(value)))
    if (property === 'height') height = Math.max(1, Math.min(sourceHeight - cropY, Math.round(value)))
    image.set({ cropX, cropY, width, height })
    image.setCoords()
    editor.current.requestRenderAll()
    syncObjects()
    commit()
  }
  const resetImageCrop = () => {
    const image = selected?.type === 'image' ? selected as FabricImage : null
    if (!image || !editor.current) return
    const element = image.getElement() as HTMLImageElement
    image.set({ cropX: 0, cropY: 0, width: element.naturalWidth || element.width, height: element.naturalHeight || element.height })
    image.setCoords()
    editor.current.requestRenderAll()
    syncObjects()
    commit()
  }
  const updateBackgroundCrop = (property: 'cropX' | 'cropY' | 'width' | 'height', value: number) => {
    const canvas = editor.current
    const image = canvas?.backgroundImage instanceof FabricImage ? canvas.backgroundImage : null
    if (!canvas || !image) return
    const element = image.getElement() as HTMLImageElement
    const sourceWidth = element.naturalWidth || element.width || image.width || 1
    const sourceHeight = element.naturalHeight || element.height || image.height || 1
    let cropX = image.cropX || 0
    let cropY = image.cropY || 0
    let width = image.width || sourceWidth
    let height = image.height || sourceHeight
    if (property === 'cropX') cropX = Math.max(0, Math.min(sourceWidth - width, Math.round(value)))
    if (property === 'cropY') cropY = Math.max(0, Math.min(sourceHeight - height, Math.round(value)))
    if (property === 'width') { width = Math.max(1, Math.min(sourceWidth - cropX, Math.round(value))); cropX = Math.min(cropX, sourceWidth - width) }
    if (property === 'height') { height = Math.max(1, Math.min(sourceHeight - cropY, Math.round(value))); cropY = Math.min(cropY, sourceHeight - height) }
    image.set({ cropX, cropY, width, height, left: 0, top: 0, scaleX: canvas.getWidth() / width, scaleY: canvas.getHeight() / height })
    image.setCoords()
    canvas.requestRenderAll()
    syncObjects()
    commit()
  }
  const resetBackgroundCrop = () => {
    const canvas = editor.current
    const image = canvas?.backgroundImage instanceof FabricImage ? canvas.backgroundImage : null
    if (!canvas || !image) return
    const element = image.getElement() as HTMLImageElement
    const width = element.naturalWidth || element.width || image.width || 1
    const height = element.naturalHeight || element.height || image.height || 1
    image.set({ cropX: 0, cropY: 0, width, height, left: 0, top: 0, scaleX: canvas.getWidth() / width, scaleY: canvas.getHeight() / height })
    image.setCoords()
    canvas.requestRenderAll()
    syncObjects()
    commit()
  }
  const reselectImage = async (file?: File) => {
    const image = selected?.type === 'image' ? selected as FabricImage : null
    if (!file || !image || !editor.current) return
    try {
      const oldWidth = image.width || 1
      const oldHeight = image.height || 1
      const oldCropX = image.cropX || 0
      const oldCropY = image.cropY || 0
      await image.setSrc(await readFileAsDataUrl(file))
      const element = image.getElement() as HTMLImageElement
      const sourceWidth = element.naturalWidth || element.width || oldWidth
      const sourceHeight = element.naturalHeight || element.height || oldHeight
      const width = Math.max(1, Math.min(oldWidth, sourceWidth))
      const height = Math.max(1, Math.min(oldHeight, sourceHeight))
      image.set({
        width, height,
        cropX: Math.max(0, Math.min(sourceWidth - width, oldCropX)),
        cropY: Math.max(0, Math.min(sourceHeight - height, oldCropY)),
        name: file.name,
      } as never)
      image.setCoords()
      editor.current.requestRenderAll()
      syncObjects()
      commit()
      setStatus('Gambar layer diganti')
    } catch (error) {
      window.alert(`Gambar tidak dapat diganti: ${error instanceof Error ? error.message : 'file tidak valid'}`)
    }
  }
  const eraseImageColor = async () => {
    const canvas = editor.current
    const image = selected?.type === 'image' ? selected as FabricImage : null
    if (!canvas || !image) return
    try {
      const element = image.getElement() as HTMLImageElement
      const width = element.naturalWidth || image.width || 0
      const height = element.naturalHeight || image.height || 0
      if (!width || !height) throw new Error('Ukuran gambar tidak valid')
      const work = document.createElement('canvas')
      work.width = width; work.height = height
      const context = work.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Canvas pemrosesan gambar tidak tersedia')
      context.drawImage(element, 0, 0, width, height)
      const pixels = context.getImageData(0, 0, width, height)
      const keyR = parseInt(chromaColor.slice(1, 3), 16)
      const keyG = parseInt(chromaColor.slice(3, 5), 16)
      const keyB = parseInt(chromaColor.slice(5, 7), 16)
      for (let i = 0; i < pixels.data.length; i += 4) {
        const distance = Math.max(Math.abs(pixels.data[i] - keyR), Math.abs(pixels.data[i + 1] - keyG), Math.abs(pixels.data[i + 2] - keyB))
        if (distance <= chromaTolerance) pixels.data[i + 3] = 0
        else if (chromaSoftness > 0 && distance < chromaTolerance + chromaSoftness) pixels.data[i + 3] = Math.round(pixels.data[i + 3] * (distance - chromaTolerance) / chromaSoftness)
      }
      context.putImageData(pixels, 0, 0)
      const replacement = await FabricImage.fromURL(work.toDataURL('image/png'))
      replacement.set({
        left: image.left, top: image.top, scaleX: image.scaleX, scaleY: image.scaleY,
        angle: image.angle, skewX: image.skewX, skewY: image.skewY, flipX: image.flipX, flipY: image.flipY,
        opacity: image.opacity, visible: image.visible, selectable: image.selectable, evented: image.evented,
        originX: image.originX, originY: image.originY, name: (image as FabricImage & { name?: string }).name || 'Gambar',
        stroke: image.stroke, strokeWidth: image.strokeWidth, shadow: image.shadow,
      } as never)
      const index = canvas.getObjects().indexOf(image)
      restoring.current = true
      canvas.remove(image)
      canvas.insertAt(index, replacement)
      canvas.setActiveObject(replacement)
      canvas.requestRenderAll()
      restoring.current = false
      syncObjects(); snapshot(); setStatus('Warna latar dihapus')
    } catch (error) {
      restoring.current = false
      window.alert(`Tidak dapat menghapus warna: ${error instanceof Error ? error.message : 'gambar tidak valid'}`)
    }
  }
  const applyTextGradient = (type: 'linear' | 'radial', start: string, end: string) => {
    const text = selectedText
    if (!text || !editor.current) return
    const width = Math.max(1, text.width || text.getScaledWidth())
    const height = Math.max(1, text.height || text.getScaledHeight())
    const gradient = type === 'linear'
      ? new Gradient({ type, coords: { x1: 0, y1: 0, x2: width, y2: height }, colorStops: [{ offset: 0, color: start }, { offset: 1, color: end }] })
      : new Gradient({ type, coords: { x1: width / 2, y1: height / 2, r1: 0, x2: width / 2, y2: height / 2, r2: Math.max(width, height) / 2 }, colorStops: [{ offset: 0, color: start }, { offset: 1, color: end }] })
    text.set('fill', gradient)
    text.setCoords()
    editor.current.requestRenderAll()
    syncObjects()
    commit()
  }
  const applyTextTexture = async (file?: File) => {
    const text = selectedText
    if (!file || !text || !editor.current) return
    try {
      const image = new Image()
      image.src = await readFileAsDataUrl(file)
      await image.decode()
      text.set('fill', new Pattern({ source: image, repeat: 'repeat' }))
      text.setCoords()
      editor.current.requestRenderAll()
      syncObjects()
      commit()
      setStatus('Tekstur teks diterapkan')
    } catch (error) {
      window.alert(`Tekstur tidak dapat dimuat: ${error instanceof Error ? error.message : 'berkas gambar tidak valid'}`)
    }
  }
  const applyObjectGradient = (type: 'linear' | 'radial', start: string, end: string) => {
    const object = selected
    if (!object || !editor.current || ['image', 'text', 'i-text', 'textbox'].includes(object.type || '')) return
    const width = Math.max(1, object.width || object.getScaledWidth())
    const height = Math.max(1, object.height || object.getScaledHeight())
    const fill = type === 'linear'
      ? new Gradient({ type, coords: { x1: 0, y1: 0, x2: width, y2: height }, colorStops: [{ offset: 0, color: start }, { offset: 1, color: end }] })
      : new Gradient({ type, coords: { x1: width / 2, y1: height / 2, r1: 0, x2: width / 2, y2: height / 2, r2: Math.max(width, height) / 2 }, colorStops: [{ offset: 0, color: start }, { offset: 1, color: end }] })
    object.set({ fill } as never)
    object.setCoords(); editor.current.requestRenderAll(); syncObjects(); commit()
  }
  const applyObjectTexture = async (file?: File) => {
    const object = selected
    if (!file || !object || !editor.current || ['image', 'text', 'i-text', 'textbox'].includes(object.type || '')) return
    try {
      const image = new Image()
      image.src = await readFileAsDataUrl(file)
      await image.decode()
      object.set({ fill: new Pattern({ source: image, repeat: 'repeat' }) } as never)
      object.setCoords(); editor.current.requestRenderAll(); syncObjects(); commit()
      setStatus('Tekstur objek diterapkan')
    } catch (error) {
      window.alert(`Tekstur tidak dapat dimuat: ${error instanceof Error ? error.message : 'berkas gambar tidak valid'}`)
    }
  }
  const applyTextCurve = (amount: number) => {
    const text = selectedText as (FabricText & { canvasArtCurve?: number }) | null
    if (!text || !editor.current) return
    if (!amount) {
      text.set({ path: undefined, canvasArtCurve: 0 } as never)
    } else {
      const width = Math.max(80, text.width || text.getScaledWidth())
      const baseline = Math.max(40, text.fontSize || 48)
      const lift = Math.abs(amount) * 1.8
      const middleY = amount > 0 ? baseline - lift : baseline + lift
      const path = new FabricPath(`M 0 ${baseline} Q ${width / 2} ${middleY} ${width} ${baseline}`, {
        fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', objectCaching: false,
      })
      text.set({ path, canvasArtCurve: amount } as never)
    }
    text.setCoords()
    editor.current.requestRenderAll()
    syncObjects()
    commit()
  }
  const applyToSelected = (props: Record<string, unknown>) => {
    if (!editor.current || !selected) return
    const text3D = selected as ExtrudedText
    const nextProps = { ...props }
    const rotateX = (text3D.canvasArt3DRotateX || 0) * Math.PI / 180
    const rotateY = (text3D.canvasArt3DRotateY || 0) * Math.PI / 180
    if (['text', 'i-text', 'textbox'].includes(selected.type || '') && (rotateX || rotateY) && ('scaleX' in props || 'scaleY' in props)) {
      if ('scaleX' in props) nextProps.canvasArt3DBaseScaleX = Number(props.scaleX) / Math.max(0.17, Math.cos(rotateY))
      if ('scaleY' in props) nextProps.canvasArt3DBaseScaleY = Number(props.scaleY) / Math.max(0.17, Math.cos(rotateX))
    }
    selected.set(nextProps as never)
    if (['text', 'i-text', 'textbox'].includes(selected.type || '') && 'canvasArtWordSpacing' in props) (selected as FabricText).initDimensions()
    if (selected.type === 'i-text' || selected.type === 'text' || selected.type === 'textbox') {
      const text = selected as unknown as BackgroundStyledText
      const hasCustomBackground = Boolean(text.textBackgroundColor && (text.canvasArtBackgroundPaddingLeft || text.canvasArtBackgroundPaddingRight || text.canvasArtBackgroundPaddingTop || text.canvasArtBackgroundPaddingBottom || text.canvasArtBackgroundRadius))
      const has3DExtrusion = Number((selected as ExtrudedText).canvasArt3DDepth || 0) > 0
      const hasReflection = Boolean((selected as ExtrudedText).canvasArtReflectionEnabled)
      const has3DShadow = Boolean((selected as ExtrudedText).canvasArt3DShadowEnabled)
      const hasEmboss = Boolean((selected as ExtrudedText).canvasArtEmbossEnabled)
      selected.set({ objectCaching: !(hasCustomBackground || has3DExtrusion || hasReflection || has3DShadow || hasEmboss), dirty: true } as never)
    }
    selected.setCoords()
    editor.current.requestRenderAll()
    syncObjects()
    commit()
  }
  const restoreMaskSource = (target: FabricObject & { canvasArtMaskSourceId?: string; canvasArtMaskSourceVisible?: boolean }) => {
    if (!target.canvasArtMaskSourceId || !editor.current) return
    const source = editor.current.getObjects().find((object) => (object as FabricObject & { canvasArtId?: string }).canvasArtId === target.canvasArtMaskSourceId)
    if (source) source.set('visible', target.canvasArtMaskSourceVisible ?? true)
  }
  const updateSelectedMask = (patch: Partial<{ enabled: boolean; shape: 'ellipse' | 'rect' | 'path'; mode: 'in' | 'out'; scaleX: number; scaleY: number }>) => {
    const target = selected as (FabricObject & { canvasArtMaskEnabled?: boolean; canvasArtMaskShape?: 'ellipse' | 'rect' | 'path'; canvasArtMaskMode?: 'in' | 'out'; canvasArtMaskScaleX?: number; canvasArtMaskScaleY?: number; canvasArtMaskSourceId?: string; canvasArtMaskSourceVisible?: boolean }) | null
    if (!target || !editor.current) return
    const settings = {
      enabled: patch.enabled ?? target.canvasArtMaskEnabled ?? true,
      shape: patch.shape ?? target.canvasArtMaskShape ?? 'ellipse',
      mode: patch.mode ?? target.canvasArtMaskMode ?? 'in',
      scaleX: Math.max(0.1, Math.min(1.5, patch.scaleX ?? target.canvasArtMaskScaleX ?? 0.85)),
      scaleY: Math.max(0.1, Math.min(1.5, patch.scaleY ?? target.canvasArtMaskScaleY ?? 0.85)),
    }
    const releasingPathMask = Boolean(target.canvasArtMaskSourceId && (!settings.enabled || settings.shape !== 'path'))
    if (releasingPathMask) restoreMaskSource(target)
    let clipPath: FabricObject | undefined
    if (settings.enabled) {
      const width = Math.max(1, target.width || target.getScaledWidth())
      const height = Math.max(1, target.height || target.getScaledHeight())
      if (settings.shape === 'path' && target.clipPath) {
        clipPath = target.clipPath as unknown as FabricObject
        clipPath.set('inverted', settings.mode === 'out')
      } else if (settings.shape === 'ellipse') {
        clipPath = new Ellipse({ left: 0, top: 0, originX: 'center', originY: 'center', rx: width * settings.scaleX / 2, ry: height * settings.scaleY / 2, fill: '#000', inverted: settings.mode === 'out' } as never)
      } else {
        clipPath = new Rect({ left: 0, top: 0, originX: 'center', originY: 'center', width: width * settings.scaleX, height: height * settings.scaleY, rx: Math.min(24, width * settings.scaleX * 0.08), ry: Math.min(24, height * settings.scaleY * 0.08), fill: '#000', inverted: settings.mode === 'out' } as never)
      }
    }
    const source = settings.enabled && settings.shape === 'path' && target.canvasArtMaskSourceId
      ? editor.current.getObjects().find((object) => (object as FabricObject & { canvasArtId?: string }).canvasArtId === target.canvasArtMaskSourceId)
      : undefined
    if (source) source.set('visible', false)
    target.set({ canvasArtMaskEnabled: settings.enabled, canvasArtMaskShape: settings.shape, canvasArtMaskMode: settings.mode, canvasArtMaskScaleX: settings.scaleX, canvasArtMaskScaleY: settings.scaleY, canvasArtMaskSourceId: releasingPathMask ? undefined : target.canvasArtMaskSourceId, canvasArtMaskSourceVisible: releasingPathMask ? undefined : target.canvasArtMaskSourceVisible, clipPath, objectCaching: false, dirty: true } as never)
    target.setCoords()
    editor.current.requestRenderAll()
    syncObjects()
    commit()
  }
  const applyBezierPathMask = async () => {
    const target = selected
    const canvas = editor.current
    if (!target || !canvas) return
    const source = checkedLayers.find((layer) => layer !== target && layer.type === 'path' && Boolean((layer as FabricPath & { canvasArtBezierPoints?: BezierPoint[] }).canvasArtBezierPoints?.length)) as (FabricPath & { canvasArtBezierPoints?: BezierPoint[] }) | undefined
    if (!source) { setStatus('Pilih layer target dan layer path Bezier pada daftar layer'); return }
    try {
      const targetMask = target as FabricObject & { canvasArtMaskSourceId?: string; canvasArtMaskSourceVisible?: boolean }
      restoreMaskSource(targetMask)
      const sourceMetadata = source as FabricPath & { canvasArtId?: string }
      sourceMetadata.canvasArtId ||= `mask-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const sourceWasVisible = source.visible ?? true
      const clipPath = await source.clone()
      const mode = (target as FabricObject & { canvasArtMaskMode?: 'in' | 'out' }).canvasArtMaskMode || 'in'
      clipPath.set({ absolutePositioned: true, inverted: mode === 'out', visible: true, selectable: false, evented: false } as never)
      source.set({ visible: false })
      target.set({ clipPath, canvasArtMaskEnabled: true, canvasArtMaskShape: 'path', canvasArtMaskMode: mode, canvasArtMaskSourceId: sourceMetadata.canvasArtId, canvasArtMaskSourceVisible: sourceWasVisible, objectCaching: false, dirty: true } as never)
      target.setCoords(); canvas.requestRenderAll(); syncObjects(); snapshot()
      setStatus(`Path “${getObjectName(source, 0)}” diterapkan sebagai mask`)
    } catch (error) {
      setStatus(`Mask path tidak dapat diterapkan: ${error instanceof Error ? error.message : 'gagal menyalin path'}`)
    }
  }
  const renderMaskControls = () => {
    if (!selected) return null
    const mask = selected as FabricObject & { canvasArtMaskEnabled?: boolean; canvasArtMaskShape?: 'ellipse' | 'rect' | 'path'; canvasArtMaskMode?: 'in' | 'out'; canvasArtMaskScaleX?: number; canvasArtMaskScaleY?: number }
    return <details><summary>Mask {mask.canvasArtMaskEnabled ? '· aktif' : ''}</summary>
      <div className="numeric-grid"><label>Bentuk<select value={mask.canvasArtMaskShape || 'ellipse'} onChange={(e) => updateSelectedMask({ shape: e.target.value as 'ellipse' | 'rect' })}><option value="ellipse">Elips</option><option value="rect">Persegi panjang</option>{mask.canvasArtMaskShape === 'path' && <option value="path" disabled>Path Bezier terpasang</option>}</select></label><label>Mode<select value={mask.canvasArtMaskMode || 'in'} onChange={(e) => updateSelectedMask({ mode: e.target.value as 'in' | 'out' })}><option value="in">In · tampilkan bagian dalam</option><option value="out">Out · potong bagian dalam</option></select></label></div>
      {mask.canvasArtMaskShape !== 'path' && <><label className="property-label">Lebar mask <span>{Math.round((mask.canvasArtMaskScaleX || 0.85) * 100)}%</span><input type="range" min="10" max="150" value={Math.round((mask.canvasArtMaskScaleX || 0.85) * 100)} onChange={(e) => updateSelectedMask({ scaleX: Number(e.target.value) / 100 })} /></label>
      <label className="property-label">Tinggi mask <span>{Math.round((mask.canvasArtMaskScaleY || 0.85) * 100)}%</span><input type="range" min="10" max="150" value={Math.round((mask.canvasArtMaskScaleY || 0.85) * 100)} onChange={(e) => updateSelectedMask({ scaleY: Number(e.target.value) / 100 })} /></label>
      </>}<button className="control-chip" onClick={() => updateSelectedMask({ enabled: !mask.canvasArtMaskEnabled })}>{mask.canvasArtMaskEnabled ? 'Hapus mask' : 'Terapkan mask'}</button><button className="control-chip" disabled={!checkedLayers.some((layer) => layer !== selected && layer.type === 'path' && Boolean((layer as FabricPath & { canvasArtBezierPoints?: BezierPoint[] }).canvasArtBezierPoints?.length))} onClick={() => void applyBezierPathMask()}>Gunakan path Bezier terpilih</button>
    </details>
  }
  const applyPartialTextColor = () => {
    if (!selectedText || !editor.current) return
    const segments = graphemeCount(selectedText.text)
    const start = Math.max(0, Math.min(segments, Math.trunc(partialTextStart)))
    const end = Math.max(start, Math.min(segments, Math.trunc(partialTextEnd)))
    if (end <= start) { setStatus('Pilih rentang karakter dengan akhir lebih besar dari awal'); return }
    selectedText.setSelectionStyles({ fill: partialTextColor }, start, end)
    selectedText.set({ dirty: true } as never)
    selectedText.setCoords()
    editor.current.requestRenderAll()
    syncObjects()
    commit()
  }
  const positionSelectedRelative = (horizontal: 'left' | 'center' | 'right', vertical: 'top' | 'center' | 'bottom') => {
    if (!editor.current || !selected) return
    const bounds = selected.getBoundingRect()
    const left = horizontal === 'left' ? 0 : horizontal === 'center' ? (canvasWidth - bounds.width) / 2 : canvasWidth - bounds.width
    const top = vertical === 'top' ? 0 : vertical === 'center' ? (canvasHeight - bounds.height) / 2 : canvasHeight - bounds.height
    selected.set({ left: (selected.left || 0) + left - bounds.left, top: (selected.top || 0) + top - bounds.top })
    selected.setCoords()
    editor.current.requestRenderAll()
    syncObjects()
    commit()
  }
  const saveSelectedTextStyle = () => {
    if (!selectedText) return
    const shadow = selectedText.shadow as { color?: string; blur?: number; offsetX?: number; offsetY?: number } | null
    const properties: Record<string, unknown> = {
      fontFamily: selectedText.fontFamily,
      fontSize: selectedText.fontSize,
      fontWeight: selectedText.fontWeight,
      fontStyle: selectedText.fontStyle,
      charSpacing: selectedText.charSpacing,
      canvasArtWordSpacing: (selectedText as WordSpacedText).canvasArtWordSpacing || 0,
      lineHeight: selectedText.lineHeight,
      textAlign: selectedText.textAlign,
      underline: selectedText.underline,
      linethrough: selectedText.linethrough,
      opacity: selectedText.opacity,
      stroke: typeof selectedText.stroke === 'string' ? selectedText.stroke : null,
      strokeWidth: selectedText.strokeWidth,
      textBackgroundColor: selectedText.textBackgroundColor,
      canvasArtBackgroundPaddingLeft: (selectedText as BackgroundStyledText).canvasArtBackgroundPaddingLeft || 0,
      canvasArtBackgroundPaddingRight: (selectedText as BackgroundStyledText).canvasArtBackgroundPaddingRight || 0,
      canvasArtBackgroundPaddingTop: (selectedText as BackgroundStyledText).canvasArtBackgroundPaddingTop || 0,
      canvasArtBackgroundPaddingBottom: (selectedText as BackgroundStyledText).canvasArtBackgroundPaddingBottom || 0,
      canvasArtBackgroundRadius: (selectedText as BackgroundStyledText).canvasArtBackgroundRadius || 0,
      shadow: shadow ? { color: shadow.color || '#202b47', blur: shadow.blur || 0, offsetX: shadow.offsetX || 0, offsetY: shadow.offsetY || 0 } : null,
    }
    if (typeof selectedText.fill === 'string') properties.fill = selectedText.fill
    const name = newTextStyleName.trim() || `Gaya ${savedTextStyles.length + 1}`
    setSavedTextStyles((styles) => [{ id: crypto.randomUUID(), name, properties }, ...styles])
    setStatus(`Gaya “${name}” disimpan`)
  }
  const applySavedTextStyle = (style: SavedTextStyle) => {
    if (!selectedText) return
    applyToSelected(style.properties)
    setStatus(`Gaya “${style.name}” diterapkan`)
  }
  const deleteSavedTextStyle = (id: string) => setSavedTextStyles((styles) => styles.filter((style) => style.id !== id))
  const updateObjectShadow = (patch: Partial<{ color: string; blur: number; offsetX: number; offsetY: number }> | null) => {
    if (!selected || !editor.current) return
    if (!patch) { applyToSelected({ shadow: null }); return }
    const current = selected.shadow as { color?: string; blur?: number; offsetX?: number; offsetY?: number } | null
    applyToSelected({ shadow: {
      color: patch.color ?? current?.color ?? 'rgba(32,43,71,0.35)',
      blur: patch.blur ?? current?.blur ?? 16,
      offsetX: patch.offsetX ?? current?.offsetX ?? 4,
      offsetY: patch.offsetY ?? current?.offsetY ?? 6,
    } })
  }
  const updateText3DRotation = (axis: 'x' | 'y', degrees: number) => {
    if (!selectedText || !editor.current) return
    const text = selectedText as ExtrudedText
    const currentX = text.canvasArt3DRotateX || 0
    const currentY = text.canvasArt3DRotateY || 0
    const nextX = axis === 'x' ? degrees : currentX
    const nextY = axis === 'y' ? degrees : currentY
    const baseScaleX = text.canvasArt3DBaseScaleX ?? (text.scaleX || 1) / Math.max(0.17, Math.cos(currentY * Math.PI / 180))
    const baseScaleY = text.canvasArt3DBaseScaleY ?? (text.scaleY || 1) / Math.max(0.17, Math.cos(currentX * Math.PI / 180))
    text.set({ canvasArt3DRotateX: nextX, canvasArt3DRotateY: nextY, canvasArt3DBaseScaleX: baseScaleX, canvasArt3DBaseScaleY: baseScaleY, scaleX: baseScaleX * Math.max(0.17, Math.cos(nextY * Math.PI / 180)), scaleY: baseScaleY * Math.max(0.17, Math.cos(nextX * Math.PI / 180)), dirty: true } as never)
    text.setCoords(); editor.current.requestRenderAll(); syncObjects(); commit()
  }
  const updateTextShadow = (patch: Partial<{ color: string; blur: number; offsetX: number; offsetY: number }>) => {
    const current = selectedText?.shadow as { color?: string; blur?: number; offsetX?: number; offsetY?: number } | null
    applyToSelected({ shadow: {
      color: patch.color ?? current?.color ?? 'rgba(32,43,71,0.32)',
      blur: patch.blur ?? current?.blur ?? 18,
      offsetX: patch.offsetX ?? current?.offsetX ?? 5,
      offsetY: patch.offsetY ?? current?.offsetY ?? 8,
    } })
  }
  const renameLayer = (object: FabricObject, name: string) => { (object as FabricObject & { name?: string }).name = name; syncObjects(); commit() }
  const deleteSelected = () => {
    const canvas = editor.current
    if (!canvas || !selected) return
    canvas.remove(selected); canvas.discardActiveObject(); syncObjects(); snapshot()
  }
  const nudgeSelected = (dx: number, dy: number) => {
    const canvas = editor.current
    if (!canvas || !selected) return
    selected.set({ left: (selected.left || 0) + dx, top: (selected.top || 0) + dy })
    selected.setCoords()
    canvas.requestRenderAll()
    syncObjects()
    commit()
  }
  const duplicateSelected = () => {
    const canvas = editor.current
    if (!canvas || !selected) return
    selected.clone(['name']).then((copy) => {
      copy.set({ left: (selected.left || 0) + 24, top: (selected.top || 0) + 24, name: `${(selected as FabricObject & { name?: string }).name || 'Objek'} salinan` } as never)
      canvas.add(copy); canvas.setActiveObject(copy); syncObjects()
    })
  }
  const copySelected = async () => {
    if (!selected) return
    try {
      objectClipboard.current = await selected.clone(['name'])
      pasteCount.current = 0
      setClipboardHasObject(true)
      setStatus('Objek disalin ke clipboard CanvasArt')
    } catch (error) {
      setStatus(`Objek tidak dapat disalin: ${error instanceof Error ? error.message : 'gagal menyalin'}`)
    }
  }
  const pasteObject = async () => {
    const canvas = editor.current
    const source = objectClipboard.current
    if (!canvas || !source) return
    try {
      const copy = await source.clone(['name'])
      pasteCount.current += 1
      const sourceName = (source as FabricObject & { name?: string }).name || 'Objek'
      copy.set({ left: (source.left || 0) + 24 * pasteCount.current, top: (source.top || 0) + 24 * pasteCount.current, name: `${sourceName} salinan` } as never)
      canvas.add(copy)
      canvas.setActiveObject(copy)
      syncObjects()
      setStatus('Objek ditempel')
    } catch (error) {
      setStatus(`Objek tidak dapat ditempel: ${error instanceof Error ? error.message : 'gagal menempel'}`)
    }
  }
  const moveLayer = (object: FabricObject, direction: 'up' | 'down') => {
    const canvas = editor.current
    if (!canvas) return
    const index = canvas.getObjects().indexOf(object)
    canvas.moveObjectTo(object, Math.max(0, Math.min(canvas.getObjects().length - 1, index + (direction === 'up' ? 1 : -1))))
    canvas.requestRenderAll(); syncObjects(); commit()
  }
  const moveLayerTo = (object: FabricObject, edge: 'front' | 'back') => {
    const canvas = editor.current
    if (!canvas) return
    canvas.moveObjectTo(object, edge === 'front' ? canvas.getObjects().length - 1 : 0)
    canvas.requestRenderAll(); syncObjects(); commit()
  }
  const toggleLayerCheck = (object: FabricObject) => {
    setCheckedLayers((current) => current.includes(object) ? current.filter((item) => item !== object) : [...current, object])
  }
  const groupCheckedLayers = () => {
    const canvas = editor.current
    const ordered = canvas?.getObjects().filter((object) => checkedLayers.includes(object)) || []
    if (!canvas || ordered.length < 2) return
    const firstIndex = Math.min(...ordered.map((object) => canvas.getObjects().indexOf(object)))
    try {
      restoring.current = true
      const group = new Group(ordered, { name: 'Grup', subTargetCheck: false } as never)
      canvas.remove(...ordered)
      canvas.insertAt(firstIndex, group)
      canvas.setActiveObject(group)
      canvas.requestRenderAll()
      restoring.current = false
      setCheckedLayers([])
      syncObjects()
      snapshot()
      setStatus('Layer dikelompokkan')
    } catch (error) {
      restoring.current = false
      window.alert(`Layer tidak dapat dikelompokkan: ${error instanceof Error ? error.message : 'operasi gagal'}`)
    }
  }
  const ungroupSelected = () => {
    const canvas = editor.current
    if (!canvas || selected?.type !== 'group') return
    const group = selected as Group
    const index = canvas.getObjects().indexOf(group)
    if (index < 0) return
    try {
      restoring.current = true
      const children = group.removeAll()
      canvas.remove(group)
      canvas.insertAt(index, ...children)
      canvas.discardActiveObject()
      if (children[0]) canvas.setActiveObject(children[0])
      canvas.requestRenderAll()
      restoring.current = false
      setCheckedLayers([])
      syncObjects()
      snapshot()
      setStatus('Grup dibongkar')
    } catch (error) {
      restoring.current = false
      window.alert(`Grup tidak dapat dibongkar: ${error instanceof Error ? error.message : 'operasi gagal'}`)
    }
  }
  const alignCheckedLayers = (mode: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'distributeX' | 'distributeY') => {
    const canvas = editor.current
    const objectsToAlign = canvas?.getObjects().filter((object) => checkedLayers.includes(object)) || []
    if (!canvas || !objectsToAlign.length) return
    if ((mode === 'distributeX' || mode === 'distributeY') && objectsToAlign.length < 3) return
    const bounds = objectsToAlign.map((object) => ({ object, rect: object.getBoundingRect() }))
    if (mode === 'distributeX' || mode === 'distributeY') {
      const horizontal = mode === 'distributeX'
      const sorted = [...bounds].sort((a, b) => horizontal ? a.rect.left - b.rect.left : a.rect.top - b.rect.top)
      const start = horizontal ? sorted[0].rect.left : sorted[0].rect.top
      const endRect = sorted[sorted.length - 1].rect
      const end = horizontal ? endRect.left + endRect.width : endRect.top + endRect.height
      const occupied = sorted.reduce((total, item) => total + (horizontal ? item.rect.width : item.rect.height), 0)
      const gap = (end - start - occupied) / (sorted.length - 1)
      let cursor = start
      for (const item of sorted) {
        const current = horizontal ? item.rect.left : item.rect.top
        const delta = cursor - current
        item.object.set(horizontal
          ? { left: (item.object.left || 0) + delta }
          : { top: (item.object.top || 0) + delta })
        cursor += (horizontal ? item.rect.width : item.rect.height) + gap
      }
    } else {
      const minLeft = Math.min(...bounds.map(({ rect }) => rect.left))
      const maxRight = Math.max(...bounds.map(({ rect }) => rect.left + rect.width))
      const minTop = Math.min(...bounds.map(({ rect }) => rect.top))
      const maxBottom = Math.max(...bounds.map(({ rect }) => rect.top + rect.height))
      for (const { object, rect } of bounds) {
        let dx = 0
        let dy = 0
        if (mode === 'left') dx = minLeft - rect.left
        if (mode === 'centerX') dx = (canvas.getWidth() - rect.width) / 2 - rect.left
        if (mode === 'right') dx = maxRight - (rect.left + rect.width)
        if (mode === 'top') dy = minTop - rect.top
        if (mode === 'centerY') dy = (canvas.getHeight() - rect.height) / 2 - rect.top
        if (mode === 'bottom') dy = maxBottom - (rect.top + rect.height)
        object.set({ left: (object.left || 0) + dx, top: (object.top || 0) + dy })
        object.setCoords()
      }
    }
    canvas.requestRenderAll()
    syncObjects()
    snapshot()
  }
  const deleteCheckedLayers = () => {
    const canvas = editor.current
    if (!canvas || !checkedLayers.length) return
    restoring.current = true
    canvas.remove(...checkedLayers.filter((object) => canvas.getObjects().includes(object)))
    canvas.discardActiveObject(); canvas.requestRenderAll()
    restoring.current = false
    setCheckedLayers([]); syncObjects(); snapshot()
  }
  const mergeCheckedLayers = async () => {
    const canvas = editor.current
    const mergeSet = new Set(checkedLayers.filter((object) => canvas?.getObjects().includes(object)))
    if (!canvas || mergeSet.size < 2) return
    const originalEntries = canvas.getObjects().map((object, index) => ({ object, index })).filter(({ object }) => mergeSet.has(object))
    const indexes = originalEntries.map(({ index }) => index)
    const bounds = [...mergeSet].map((object) => object.getBoundingRect())
    const pad = 64
    const left = Math.max(0, Math.floor(Math.min(...bounds.map((rect) => rect.left)) - pad))
    const top = Math.max(0, Math.floor(Math.min(...bounds.map((rect) => rect.top)) - pad))
    const right = Math.min(canvas.getWidth(), Math.ceil(Math.max(...bounds.map((rect) => rect.left + rect.width)) + pad))
    const bottom = Math.min(canvas.getHeight(), Math.ceil(Math.max(...bounds.map((rect) => rect.top + rect.height)) + pad))
    if (right <= left || bottom <= top) return
    const originalBackground = canvas.backgroundColor
    const originalBackgroundImage = canvas.backgroundImage
    const originalViewport = canvas.viewportTransform
    let merged: FabricImage | undefined
    try {
      canvas.backgroundColor = 'rgba(0,0,0,0)'
      canvas.backgroundImage = undefined
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
      const raster = canvas.toCanvasElement(1, { left, top, width: right - left, height: bottom - top, filter: (object) => [...mergeSet].some((item) => item === object) })
      merged = new FabricImage(raster, { left, top, name: 'Gabungan layer' } as never)
      restoring.current = true
      canvas.remove(...mergeSet)
      canvas.insertAt(Math.min(...indexes), merged)
      canvas.setActiveObject(merged)
      canvas.backgroundColor = originalBackground
      canvas.backgroundImage = originalBackgroundImage
      canvas.setViewportTransform(originalViewport)
      canvas.requestRenderAll()
      restoring.current = false
      setCheckedLayers([]); syncObjects(); snapshot(); setStatus('Layer digabung')
    } catch (error) {
      if (merged && canvas.getObjects().includes(merged)) canvas.remove(merged)
      for (const entry of originalEntries) {
        if (!canvas.getObjects().includes(entry.object)) canvas.insertAt(Math.min(entry.index, canvas.getObjects().length), entry.object)
      }
      canvas.backgroundColor = originalBackground
      canvas.backgroundImage = originalBackgroundImage
      canvas.setViewportTransform(originalViewport)
      canvas.requestRenderAll()
      restoring.current = false
      window.alert(`Layer tidak dapat digabung: ${error instanceof Error ? error.message : 'render gagal'}`)
    }
  }
  const undo = async () => {
    const canvas = editor.current
    if (!canvas || history.current.length < 2) return
    const current = history.current.pop()!
    future.current.push(current)
    const saved = JSON.parse(history.current.at(-1)!) as { canvas?: Record<string, unknown>; width?: number; height?: number; effects?: typeof effects }
    const state = saved.canvas ? saved : { canvas: saved as Record<string, unknown> }
    restoring.current = true
    if (state.width && state.height) canvas.setDimensions({ width: state.width, height: state.height })
    await canvas.loadFromJSON(state.canvas!)
    if (saved.effects) { effectsRef.current = saved.effects; setEffects(saved.effects) }
    if (saved.width) { setCanvasWidth(saved.width); setCanvasHeight(saved.height || saved.width) }
    syncObjects(); restoring.current = false; editRevision.current += 1; hasUnsavedChanges.current = true; setStatus('Undo')
  }
  const redo = async () => {
    const canvas = editor.current
    if (!canvas || !future.current.length) return
    const next = future.current.pop()!
    history.current.push(next)
    const saved = JSON.parse(next) as { canvas?: Record<string, unknown>; width?: number; height?: number; effects?: typeof effects }
    const state = saved.canvas ? saved : { canvas: saved as Record<string, unknown> }
    restoring.current = true
    if (state.width && state.height) canvas.setDimensions({ width: state.width, height: state.height })
    await canvas.loadFromJSON(state.canvas!)
    if (saved.effects) { effectsRef.current = saved.effects; setEffects(saved.effects) }
    if (saved.width) { setCanvasWidth(saved.width); setCanvasHeight(saved.height || saved.width) }
    syncObjects(); restoring.current = false; editRevision.current += 1; hasUnsavedChanges.current = true; setStatus('Redo')
  }
  const restoreAutosave = async () => {
    const canvas = editor.current
    try {
      const saved = await readLocal()
      if (!saved || !canvas) { window.alert('Belum ada autosave yang dapat dipulihkan.'); return }
      restoring.current = true
      canvas.setDimensions({ width: saved.canvas.width, height: saved.canvas.height })
      await canvas.loadFromJSON(saved.canvas.rendererState)
      projectMetadata.current = saved
      setSavedTextStyles(saved.textStyles || [])
      const restoredBrush = getBrushSettings(saved.brush)
      setBrushColor(restoredBrush.color); setBrushSize(restoredBrush.size); setBrushSmooth(restoredBrush.smooth); setBrushDashed(restoredBrush.dashed)
      const restoredFonts = await installFontAssets(saved.fonts || [])
      fontAssetsRef.current = restoredFonts; setFontAssets(restoredFonts)
      setProjectName(saved.name || 'Desain tanpa judul')
      setCanvasWidth(saved.canvas.width); setCanvasHeight(saved.canvas.height)
      const restoredEffects = { brightness: 0, contrast: 0, saturation: 0, hue: 0, vignette: 0, noise: 0, stripes: 0, ...saved.effects }
      effectsRef.current = restoredEffects
      setEffects(restoredEffects)
      syncBackgroundControls(canvas)
      history.current = [serializeHistoryEntry(canvas)]
      future.current = []
      syncObjects(); setStatus('Autosave dipulihkan')
    } catch (error) {
      window.alert(`Autosave tidak dapat dibuka: ${error instanceof Error ? error.message : 'data rusak'}`)
    } finally {
      restoring.current = false
    }
  }
  const importFont = async (file?: File) => {
    if (!file) return
    if (!/\.(ttf|otf)$/i.test(file.name)) { window.alert('Pilih file font TTF atau OTF.'); return }
    try {
      const family = file.name.replace(/\.(ttf|otf)$/i, '').replace(/[-_]+/g, ' ').trim() || 'Font kustom'
      const dataUrl = await readFileAsDataUrl(file)
      const face = new FontFace(family, `url("${dataUrl}")`)
      await face.load()
      document.fonts.add(face)
      const next = [...fontAssetsRef.current.filter((font) => font.family !== family), { family, dataUrl, fileName: file.name }]
      fontAssetsRef.current = next
      setFontAssets(next)
      projectMetadata.current = { ...projectMetadata.current, effects: effectsRef.current, fonts: next }
      if (selectedText) applyToSelected({ fontFamily: family })
      else setStatus(`Font ${family} ditambahkan`)
    } catch (error) {
      window.alert(`Font tidak dapat dimuat: ${error instanceof Error ? error.message : 'file tidak valid'}`)
    }
  }
  const removeFont = (family: string) => {
    const asset = fontAssetsRef.current.find((font) => font.family === family)
    if (!asset) return
    const face = [...document.fonts].find((font) => font.family === family)
    if (face) document.fonts.delete(face)
    const next = fontAssetsRef.current.filter((font) => font.family !== family)
    fontAssetsRef.current = next
    setFontAssets(next)
    projectMetadata.current = { ...projectMetadata.current, effects: effectsRef.current, fonts: next }
    setStatus(`Font ${family} dihapus dari pustaka`)
  }
  const saveProject = async () => {
    const canvas = editor.current
    if (!canvas) return
    projectMetadata.current = { ...projectMetadata.current, effects, fonts: fontAssetsRef.current, textStyles: savedTextStyles, brush: getBrushSettings({ color: brushColor, size: brushSize, smooth: brushSmooth, dashed: brushDashed }) }
    const file = createProject(projectName, canvas.toJSON(), canvas.getWidth(), canvas.getHeight(), projectMetadata.current)
    projectMetadata.current = file
    const zip = new JSZip()
    zip.file('project.json', JSON.stringify(file, null, 2))
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    download(blob, `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'canvasart'}.canvasart`)
    setStatus('Proyek diunduh')
  }
  const openProject = async (file?: File) => {
    if (!file || !editor.current) return
    try {
      const zip = await JSZip.loadAsync(file)
      const entry = zip.file('project.json')
      if (!entry) throw new Error('Manifest project.json tidak ditemukan')
      const project = parseProject(JSON.parse(await entry.async('text')))
      const canvas = editor.current
      if (!canvas) return
      const restoredFonts = await installFontAssets(project.fonts || [])
      fontAssetsRef.current = restoredFonts; setFontAssets(restoredFonts)
      restoring.current = true
      canvas.setDimensions({ width: project.canvas.width, height: project.canvas.height })
      await canvas.loadFromJSON(project.canvas.rendererState)
      projectMetadata.current = project
      setSavedTextStyles(project.textStyles || [])
      const restoredBrush = getBrushSettings(project.brush)
      setBrushColor(restoredBrush.color); setBrushSize(restoredBrush.size); setBrushSmooth(restoredBrush.smooth); setBrushDashed(restoredBrush.dashed)
      setProjectName(project.name || 'Desain tanpa judul')
      const restoredEffects = { brightness: 0, contrast: 0, saturation: 0, hue: 0, vignette: 0, noise: 0, stripes: 0, ...project.effects }
      effectsRef.current = restoredEffects
      setEffects(restoredEffects)
      setCanvasWidth(project.canvas.width); setCanvasHeight(project.canvas.height)
      syncBackgroundControls(canvas)
      history.current = [serializeHistoryEntry(canvas)]
      future.current = []
      syncObjects(); restoring.current = false; setStatus('Proyek dibuka')
    } catch (error) {
      restoring.current = false
      window.alert(`Tidak dapat membuka proyek: ${error instanceof Error ? error.message : 'file tidak valid'}`)
    }
  }
  const renderExportBlob = useCallback(async () => {
    const canvas = editor.current
    if (!canvas) throw new Error('Kanvas editor belum siap')
    const source = new Image()
    const targetWidth = exportCustomDimensions ? Math.max(16, Math.min(8192, Math.round(exportCustomWidth))) : Math.round(canvas.getWidth() * exportScale)
    const targetHeight = exportCustomDimensions ? Math.max(16, Math.min(8192, Math.round(exportCustomHeight))) : Math.round(canvas.getHeight() * exportScale)
    source.src = canvas.toDataURL({ format: 'png', multiplier: exportCustomDimensions ? 1 : exportScale, enableRetinaScaling: false })
    await new Promise<void>((resolve, reject) => { source.onload = () => resolve(); source.onerror = () => reject(new Error('Gagal merender gambar')) })
    const output = document.createElement('canvas')
    output.width = targetWidth; output.height = targetHeight
    const context = output.getContext('2d')
    if (!context) throw new Error('Canvas ekspor tidak tersedia')
    if (exportFormat === 'jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, output.width, output.height)
    }
    context.filter = `brightness(${100 + effects.brightness}%) contrast(${100 + effects.contrast}%) saturate(${100 + effects.saturation}%) hue-rotate(${effects.hue}deg)`
    if (exportCustomDimensions && exportFit === 'contain') {
      const scale = Math.min(output.width / source.naturalWidth, output.height / source.naturalHeight)
      const drawWidth = source.naturalWidth * scale
      const drawHeight = source.naturalHeight * scale
      context.drawImage(source, (output.width - drawWidth) / 2, (output.height - drawHeight) / 2, drawWidth, drawHeight)
    } else context.drawImage(source, 0, 0, output.width, output.height)
    context.filter = 'none'
    if (effects.vignette > 0) {
      const radius = Math.min(output.width, output.height)
      const gradient = context.createRadialGradient(output.width / 2, output.height / 2, radius * 0.2, output.width / 2, output.height / 2, radius * 0.75)
      gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, `rgba(0,0,0,${effects.vignette / 100})`)
      context.fillStyle = gradient; context.fillRect(0, 0, output.width, output.height)
    }
    if (effects.stripes > 0) {
      context.fillStyle = `rgba(24,32,50,${effects.stripes / 400})`
      for (let y = 0; y < output.height; y += 4) context.fillRect(0, y, output.width, 1)
    }
    if (noiseTile && effects.noise > 0) {
      const noise = new Image(); noise.src = noiseTile
      await new Promise<void>((resolve) => { noise.onload = () => resolve() })
      const pattern = context.createPattern(noise, 'repeat')
      if (pattern) { context.globalAlpha = Math.min(0.7, effects.noise / 140); context.fillStyle = pattern; context.fillRect(0, 0, output.width, output.height); context.globalAlpha = 1 }
    }
    const mimeType = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
    return await new Promise<Blob>((resolve, reject) => output.toBlob((result) => result ? resolve(result) : reject(new Error('Gagal membuat berkas gambar')), mimeType, exportJpegQuality))
  }, [effects, exportFormat, exportJpegQuality, exportScale, exportCustomDimensions, exportCustomWidth, exportCustomHeight, exportFit, noiseTile])
  const exportImage = async (share = false) => {
    try {
    const blob = await renderExportBlob()
    const mimeType = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
    const filename = `${projectName.replace(/[^a-z0-9-_ ]/gi, '').replaceAll(' ', '-')}.${exportFormat}`
    if (share) {
      const file = new File([blob], filename, { type: mimeType })
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
          await navigator.share({ files: [file], title: projectName })
          setShowExport(false)
          setStatus('Gambar dibagikan')
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            setStatus('Berbagi dibatalkan')
            return
          }
        }
      }
    }
    download(blob, filename)
    setShowExport(false)
    setStatus(share ? 'Browser tidak mendukung berbagi file · gambar diunduh' : 'Gambar diekspor')
    } catch (error) {
      setStatus('Gagal mengekspor gambar')
      window.alert(`Gambar tidak dapat diekspor: ${error instanceof Error ? error.message : 'kegagalan render'}`)
    }
  }
  useEffect(() => {
    if (!showExport) { setExportPreviewUrl(''); setExportPreviewError(''); return }
    let cancelled = false
    let objectUrl = ''
    setExportPreviewLoading(true)
    setExportPreviewError('')
    setExportPreviewUrl('')
    void renderExportBlob().then((blob) => {
      if (cancelled) return
      objectUrl = URL.createObjectURL(blob)
      setExportPreviewUrl(objectUrl)
    }).catch((error) => {
      if (!cancelled) setExportPreviewError(error instanceof Error ? error.message : 'Gagal membuat preview')
    }).finally(() => { if (!cancelled) setExportPreviewLoading(false) })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [showExport, renderExportBlob, canvasWidth, canvasHeight])
  const addQuote = (quote: QuoteEntry) => {
    const canvas = editor.current
    if (!canvas) return
    const width = canvas.getWidth()
    const text = new FabricText(quote.text, { left: width * 0.12, top: canvas.getHeight() * 0.38, width: width * 0.76, fontFamily: 'Georgia', fontSize: Math.max(24, Math.min(54, Math.round(width * 0.045))), textAlign: 'center', fill: '#202b47', name: `Kutipan · ${quote.category}` } as never)
    canvas.add(text); canvas.setActiveObject(text); setShowQuotes(false); setActiveTab('Text'); syncObjects()
  }
  const toggleQuoteFavorite = (id: string) => setFavoriteQuotes((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const visibleQuotes = QUOTES.filter((quote) => {
    const query = quoteSearch.trim().toLocaleLowerCase(quote.language === 'id' ? 'id' : 'en')
    return (quoteCategory === 'all' || quote.category === quoteCategory)
      && (quoteLanguage === 'all' || quote.language === quoteLanguage)
      && (!showFavoriteQuotesOnly || favoriteQuotes.includes(quote.id))
      && (!query || quote.text.toLocaleLowerCase(quote.language === 'id' ? 'id' : 'en').includes(query))
  })
  const resizeCanvas = (width: number, height: number) => {
    const canvas = editor.current
    if (!canvas || width < 16 || height < 16 || width > 8192 || height > 8192) return
    const scaleX = width / canvas.getWidth()
    const scaleY = height / canvas.getHeight()
    if (scaleContentsOnResize) {
      canvas.getObjects().forEach((object) => {
        object.set({ left: (object.left || 0) * scaleX, top: (object.top || 0) * scaleY, scaleX: (object.scaleX || 1) * scaleX, scaleY: (object.scaleY || 1) * scaleY })
        object.setCoords()
      })
    }
    const backgroundImage = canvas.backgroundImage
    if (backgroundImage) backgroundImage.set({ left: 0, top: 0, scaleX: width / (backgroundImage.width || width), scaleY: height / (backgroundImage.height || height) })
    canvas.setDimensions({ width, height })
    setCanvasWidth(width); setCanvasHeight(height); canvas.requestRenderAll(); snapshot(); setShowSize(false); setShowMenu(false)
  }
  const rotateCanvas = (direction: 'clockwise' | 'counterclockwise') => {
    const canvas = editor.current
    if (!canvas) return
    const width = canvas.getWidth()
    const height = canvas.getHeight()
    const rotatePoint = (point: { x: number; y: number }) => direction === 'clockwise'
      ? new Point(height - point.y, point.x)
      : new Point(point.y, width - point.x)
    const angle = direction === 'clockwise' ? 90 : -90
    canvas.getObjects().forEach((object) => {
      const center = rotatePoint(object.getCenterPoint())
      object.rotate(((object.angle || 0) + angle + 360) % 360)
      object.setPositionByOrigin(center, 'center', 'center')
      object.setCoords()
    })
    const backgroundImage = canvas.backgroundImage
    if (backgroundImage) {
      const center = rotatePoint(backgroundImage.getCenterPoint())
      backgroundImage.rotate(((backgroundImage.angle || 0) + angle + 360) % 360)
      backgroundImage.setPositionByOrigin(center, 'center', 'center')
      backgroundImage.setCoords()
    }
    canvas.setDimensions({ width: height, height: width })
    setCanvasWidth(height); setCanvasHeight(width)
    canvas.requestRenderAll()
    snapshot()
  }
  const fitCanvasToView = () => {
    const canvas = editor.current
    const stage = document.querySelector('.canvas-stage')
    if (!canvas || !stage) return
    const availableWidth = stage.clientWidth - 64
    const availableHeight = stage.clientHeight - 96
    const fit = Math.floor(Math.min(availableWidth / canvas.getWidth(), availableHeight / canvas.getHeight()) * 100)
    setZoom(Math.max(25, Math.min(500, fit)))
  }
  const keyboardActionsRef = useRef({ undo, redo, saveProject, duplicateSelected, deleteSelected, copySelected, pasteObject, nudgeSelected })
  keyboardActionsRef.current = { undo, redo, saveProject, duplicateSelected, deleteSelected, copySelected, pasteObject, nudgeSelected }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      const currentSelection = selectedObjectRef.current
      const currentTextIsEditing = Boolean((currentSelection as (FabricObject & { isEditing?: boolean }) | null)?.isEditing)
      if (event.code === 'Space' && !currentTextIsEditing && !(target instanceof HTMLElement && target.closest('button, a, [role="button"]'))) {
        event.preventDefault()
        spacePanRef.current = true
        if (editor.current) { editor.current.defaultCursor = 'grab'; editor.current.setCursor('grab') }
        return
      }
      if (currentTextIsEditing && !(modifier && key === 's')) return
      if (modifier && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) void keyboardActionsRef.current.redo()
        else void keyboardActionsRef.current.undo()
      } else if (modifier && key === 'y') {
        event.preventDefault(); void keyboardActionsRef.current.redo()
      } else if (modifier && key === 's') {
        event.preventDefault(); void keyboardActionsRef.current.saveProject()
      } else if (modifier && key === 'd') {
        event.preventDefault(); keyboardActionsRef.current.duplicateSelected()
      } else if (modifier && key === 'c') {
        event.preventDefault(); void keyboardActionsRef.current.copySelected()
      } else if (modifier && key === 'v') {
        event.preventDefault(); void keyboardActionsRef.current.pasteObject()
      } else if (key === 'delete' || key === 'backspace') {
        event.preventDefault(); keyboardActionsRef.current.deleteSelected()
      } else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        const selectedObject = selectedObjectRef.current
        if (!selectedObject || (target instanceof HTMLElement && target.closest('button, a, [role="button"]'))) return
        if ((selectedObject as FabricObject & { isEditing?: boolean }).isEditing) return
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0
        const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0
        keyboardActionsRef.current.nudgeSelected(dx, dy)
      } else if (key === '+' || key === '=') {
        event.preventDefault(); setZoom((current) => Math.min(500, current + 10))
      } else if (key === '-') {
        event.preventDefault(); setZoom((current) => Math.max(25, current - 10))
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      spacePanRef.current = false
      if (editor.current && editor.current.defaultCursor !== 'grabbing') {
        editor.current.defaultCursor = 'default'; editor.current.setCursor('default')
      }
    }
    const onWindowBlur = () => { spacePanRef.current = false; if (editor.current && editor.current.defaultCursor !== 'grabbing') { editor.current.defaultCursor = 'default'; editor.current.setCursor('default') } }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onWindowBlur) }
  }, [])
  const chooseBackgroundImage = async (file?: File) => {
    const canvas = editor.current
    if (!file || !canvas) return
    const src = await readFileAsDataUrl(file)
    const image = await FabricImage.fromURL(src)
    image.set({ left: 0, top: 0, scaleX: canvas.getWidth() / (image.width || canvas.getWidth()), scaleY: canvas.getHeight() / (image.height || canvas.getHeight()), selectable: false, evented: false, name: 'Latar' } as never)
    canvas.backgroundImage = image
    canvas.requestRenderAll(); snapshot(); setShowMenu(false)
  }
  const openCamera = (target: 'background' | 'object') => {
    setCameraTarget(target)
    setCameraError('')
    setCameraActive(false)
    setShowCamera(true)
  }
  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera tidak didukung di browser ini. Gunakan pemilih file sebagai gantinya.')
      return
    }
    const requestId = ++cameraRequestId.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      if (requestId !== cameraRequestId.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      cameraStream.current = stream
      setCameraActive(true)
    } catch (error) {
      if (requestId === cameraRequestId.current) setCameraError(error instanceof Error ? `Kamera tidak dapat diakses: ${error.message}` : 'Kamera tidak dapat diakses. Periksa izin browser atau gunakan pemilih file.')
    }
  }
  const captureCameraImage = async () => {
    const video = cameraVideo.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Tunggu sampai pratinjau kamera siap, lalu ambil foto.')
      return
    }
    const capture = document.createElement('canvas')
    capture.width = video.videoWidth
    capture.height = video.videoHeight
    const context = capture.getContext('2d')
    if (!context) { setCameraError('Tidak dapat membuat gambar dari kamera.'); return }
    context.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => capture.toBlob(resolve, 'image/jpeg', 0.94))
    if (!blob) { setCameraError('Gambar kamera tidak dapat dibuat.'); return }
    const file = new File([blob], `canvasart-camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
    cameraStream.current?.getTracks().forEach((track) => track.stop())
    cameraStream.current = null
    setCameraActive(false)
    setShowCamera(false)
    if (cameraTarget === 'background') await chooseBackgroundImage(file)
    else await addImage(file)
  }

  return (
    <div className={`app-shell ${previewMode ? 'preview-mode' : ''}`}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark">C</div><span>Canvas<span className="brand-accent">Art</span></span><span className="beta-tag">LOCAL</span></div>
        <div className="project-title"><input value={projectName} onChange={(e) => setProjectName(e.target.value)} aria-label="Nama proyek" /><span className="save-state"><i />{status}</span></div>
        <div className="top-actions">
          <button className="quiet-btn" onClick={() => setShowAddMenu(true)}><span aria-hidden="true">＋</span> Tambah</button>
          <button className="icon-btn" title="Undo" onClick={() => void undo()}>↶</button>
          <button className="icon-btn" title="Redo" onClick={() => void redo()}>↷</button>
          <span className="toolbar-divider" />
          <button className="quiet-btn" onClick={() => document.getElementById('open-project')?.click()}>Buka proyek</button>
          <input id="open-project" className="hidden-input" type="file" accept=".canvasart,.zip" onChange={(e) => void openProject(e.target.files?.[0])} />
          <button className="quiet-btn" onClick={() => void saveProject()}>Simpan proyek</button>
          <button className="quiet-btn share-btn" title="Bagikan gambar" onClick={() => void exportImage(true)}>Bagikan</button>
          <button className="primary-btn" onClick={() => { setExportCustomWidth(canvasWidth); setExportCustomHeight(canvasHeight); setExportCustomDimensions(false); setShowExport(true) }}><span>↓</span> Ekspor</button>
          <button className="more-btn" title="Menu" onClick={() => setShowMenu(true)}>•••</button>
        </div>
      </header>

      <main className="main-layout">
        <aside className="tool-rail">
          <button className="tool-btn active" title="Pilih" onClick={() => setTool('select')}><span>↖</span><small>Pilih</small></button>
          <button className="tool-btn" title="Tambah teks" onClick={addText}><span>T</span><small>Teks</small></button>
          <button className="tool-btn" title="Bentuk" onClick={() => addShape('rect')}><span>▢</span><small>Bentuk</small></button>
          <button className="tool-btn" title="Gambar" onClick={() => setTool('draw')}><span>✎</span><small>Gambar</small></button>
          <button className="tool-btn" title="Impor gambar" onClick={() => document.getElementById('import-image')?.click()}><span>▧</span><small>Impor</small></button>
          <input id="import-image" className="hidden-input" type="file" accept="image/*" onChange={(e) => void addImage(e.target.files?.[0])} />
          <div className="rail-separator" />
          <button className={`tool-btn ${grid ? 'active' : ''}`} title="Grid" onClick={() => setGrid(!grid)}><span>▦</span><small>Grid</small></button>
          <button className={`tool-btn ${snap ? 'active' : ''}`} title="Snap ke grid" onClick={() => setSnap(!snap)}><span>⌁</span><small>Snap</small></button>
          <div className="rail-spacer" />
          <button className="tool-btn" title="Pustaka kutipan" onClick={() => setShowQuotes(true)}><span>❞</span><small>Kutipan</small></button>
          <button className="tool-btn" title="Layer" onClick={() => document.querySelector('.layers-panel')?.scrollIntoView({ behavior: 'smooth' })}><span>▤</span><small>Layer</small></button>
        </aside>

        <section className="workspace">
          <div className="workspace-toolbar">
            <div className="crumb"><span>Proyek</span><b>/</b><strong>{projectName}</strong></div>
            <div className="workspace-tools">
              <button className="mini-btn" title="Perkecil" onClick={() => setZoom(Math.max(25, zoom - 10))}>−</button>
              <span className="zoom-value" title="Ctrl+scroll untuk zoom · Space+drag untuk pan">{zoom}%</span>
              <button className="mini-btn" title="Perbesar" onClick={() => setZoom(Math.min(500, zoom + 10))}>+</button>
              <span className="toolbar-divider" />
              <button className="mini-btn fit-btn" onClick={fitCanvasToView}>Pas ke layar</button>
              <button className="mini-btn" title="Pratinjau layar penuh" onClick={() => setPreviewMode(true)}>⛶</button>
              {(grid || snap) && <label className="grid-spacing-control">Grid {gridSpacing}px<input aria-label="Jarak grid dan snap" type="range" min="16" max="200" step="4" value={gridSpacing} onChange={(e) => setGridSpacing(Number(e.target.value))} /></label>}
            </div>
          </div>
          <div className={`canvas-stage ${grid ? 'show-grid' : ''}`} style={{ '--grid-spacing': `${gridSpacing * canvasFrameWidth / canvasWidth}px` } as CSSProperties}>
            {previewMode && <button className="preview-exit" onClick={() => setPreviewMode(false)}>Keluar pratinjau <kbd>Esc</kbd></button>}
            <div ref={canvasFrame} className="canvas-frame" style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}><canvas ref={canvasElement} />{effects.vignette > 0 && <div className="effect-overlay vignette-overlay" style={{ background: `radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,${effects.vignette / 100}) 100%)` }} />}{effects.stripes > 0 && <div className="effect-overlay stripes-overlay" style={{ opacity: effects.stripes / 100 }} />}{noiseTile && <div className="effect-overlay noise-overlay" style={{ backgroundImage: `url(${noiseTile})`, opacity: Math.min(0.55, effects.noise / 100) }} />}{(tool === 'bezier' || tool === 'bezier-edit') && <svg className="bezier-overlay" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}><path d={bezierPathData(tool === 'bezier-edit' && bezierEditObjectRef.current ? transformBezierPoints(bezierEditObjectRef.current, bezierPoints) : bezierPoints, bezierClosed)} fill="none" stroke={bezierColor} strokeWidth="5" strokeDasharray="14 10" />{(tool === 'bezier-edit' && bezierEditObjectRef.current ? transformBezierPoints(bezierEditObjectRef.current, bezierPoints) : bezierPoints).map((point, index) => <g key={`${point.x}-${point.y}-${index}`}>{point.handleOut && <><line x1={point.x} y1={point.y} x2={point.x + point.handleOut.x} y2={point.y + point.handleOut.y} stroke={bezierColor} strokeWidth="3" /><circle cx={point.x + point.handleOut.x} cy={point.y + point.handleOut.y} r="8" fill={bezierColor} /></>}{point.handleIn && <><line x1={point.x} y1={point.y} x2={point.x + point.handleIn.x} y2={point.y + point.handleIn.y} stroke={bezierColor} strokeWidth="3" /><circle cx={point.x + point.handleIn.x} cy={point.y + point.handleIn.y} r="8" fill={bezierColor} /></>}<circle cx={point.x} cy={point.y} r="12" fill="#fff" stroke={bezierColor} strokeWidth="5" /></g>)}</svg>}</div>
            <div className="canvas-caption"><span><i className="status-dot" />Kanvas {canvasWidth} × {canvasHeight} px</span><span>{objectCountLabel}</span></div>
          </div>
          <div className="bottom-dock">
            <nav className="tab-strip" aria-label="Panel editor">
              {(['Presets', 'Text', 'Object', 'Background', 'Effects'] as Tab[]).map((tab, i) => <button key={tab} className={`tab-button ${activeTab === tab ? 'selected' : ''}`} onClick={() => setActiveTab(tab)}><span>{['◉', 'T', '⬡', '▧', '✦'][i]}</span>{tab === 'Background' ? 'Latar' : tab === 'Effects' ? 'Efek' : tab === 'Object' ? 'Objek' : tab === 'Presets' ? 'Preset' : 'Teks'}</button>)}
            </nav>
            <div className="tab-content">
              {activeTab === 'Object' && !showEmojiLibrary && <div className="sticker-library quick-controls"><div className="sticker-library-heading"><strong>Stiker ilustrasi · {STICKERS.length}</strong><input type="search" value={emojiSearch} onChange={(e) => setEmojiSearch(e.target.value)} placeholder="Cari stiker…" aria-label="Cari stiker ilustrasi" /></div><div className="sticker-filters"><select aria-label="Kategori stiker" value={stickerCategory} onChange={(e) => setStickerCategory(e.target.value as 'all' | StickerCategory)}><option value="all">Semua kategori</option>{(['Badge','Dekorasi','Ekspresi','Simbol'] as StickerCategory[]).map((category) => <option key={category} value={category}>{category}</option>)}</select><button className={showFavoriteStickersOnly ? 'chip-active' : ''} onClick={() => setShowFavoriteStickersOnly(!showFavoriteStickersOnly)}>★ Favorit</button></div><div className="sticker-grid">{visibleStickers.map((sticker) => <div className="sticker-card" key={sticker.id}><button className="sticker-add" title={'Tambahkan ' + sticker.name} onClick={() => void addVectorSticker(sticker)}><img src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sticker.svg)} alt="" /><span>{sticker.name}</span></button><button className={'sticker-favorite ' + (favoriteStickers.includes(sticker.id) ? 'is-favorite' : '')} aria-label={favoriteStickers.includes(sticker.id) ? 'Hapus ' + sticker.name + ' dari favorit' : 'Favoritkan ' + sticker.name} title="Favorit" onClick={() => toggleStickerFavorite(sticker.id)}>{favoriteStickers.includes(sticker.id) ? '★' : '☆'}</button></div>)}{visibleStickers.length === 0 && <small className="sticker-empty">Tidak ada stiker yang cocok.</small>}</div><small>Aset SVG orisinal, lokal, dan dapat diedit di kanvas.</small></div>}
              {activeTab === 'Presets' && <div className="preset-row">{['Default', 'Thin', 'Keep Calm', 'Meme', '3D', '3D Text', 'Old Text', 'New Text'].map((name, i) => <button className="preset-card" key={name} onClick={() => applyTextPreset(name)}><span className={`preset-preview preview-${i}`}><b>{name === 'Meme' ? 'MEME' : name === '3D' || name === '3D Text' ? '3D' : 'Aa'}</b></span><small>{name}</small></button>)}</div>}
              {activeTab === 'Text' && <div className="quick-controls"><button className="control-chip" onClick={addText}>＋ Tambah teks</button><button className="control-chip" onClick={addDate}>Tanggal saat ini</button><button className="control-chip" onClick={duplicateSelected} disabled={!selected}>Duplikasi</button><button className="control-chip danger-chip" onClick={deleteSelected} disabled={!selected}>Hapus</button><span className="control-divider" /><label>Font <select disabled={!selectedText} value={selectedText?.fontFamily || 'Arial'} onChange={(e) => applyToSelected({ fontFamily: e.target.value })}><option>Arial</option><option>Georgia</option><option>Impact</option><option>Verdana</option><option>Courier New</option>{fontAssets.map((font) => <option key={font.family} value={font.family}>{font.family}</option>)}</select></label><button className="control-chip" onClick={() => document.getElementById('import-font')?.click()}>＋ Impor font</button><input id="import-font" className="hidden-input" type="file" accept=".ttf,.otf,font/ttf,font/otf" onChange={(e) => { void importFont(e.target.files?.[0]); e.currentTarget.value = '' }} />{fontAssets.map((font) => <button key={font.family} className="control-chip" title={`Hapus ${font.family} dari pustaka`} onClick={() => removeFont(font.family)}>× {font.family}</button>)}<label>Ukuran <input type="number" min="8" max="500" disabled={!selectedText} value={selectedText?.fontSize || 48} onChange={(e) => applyToSelected({ fontSize: Number(e.target.value) })} /></label><button className="format-btn" disabled={!selectedText} onClick={() => applyToSelected({ fontWeight: selectedText?.fontWeight === 'bold' ? 'normal' : 'bold' })}><b>B</b></button><button className="format-btn" disabled={!selectedText} onClick={() => applyToSelected({ fontStyle: selectedText?.fontStyle === 'italic' ? 'normal' : 'italic' })}><i>I</i></button></div>}
              {activeTab === 'Object' && <div className="quick-controls"><button className="control-chip" onClick={() => setShowEmojiLibrary(!showEmojiLibrary)}>Stiker & emoji</button><button className="control-chip" onClick={addArrow}>＋ Panah</button><label>Warna panah <input type="color" value={arrowColor} onChange={(e) => setArrowColor(e.target.value)} /></label><label>Panjang <input type="range" min="100" max="600" step="10" value={arrowLength} onChange={(e) => setArrowLength(Number(e.target.value))} /></label><label>Tebal <input type="range" min="8" max="100" step="2" value={arrowThickness} onChange={(e) => setArrowThickness(Number(e.target.value))} /></label><label>Kepala <select value={arrowHead} onChange={(e) => setArrowHead(e.target.value as 'wide' | 'narrow' | 'none')}><option value="wide">Lebar</option><option value="narrow">Sempit</option><option value="none">Tanpa kepala</option></select></label><label>Ekor <select value={arrowTail} onChange={(e) => setArrowTail(e.target.value as 'flat' | 'notched')}><option value="flat">Rata</option><option value="notched">Takik</option></select></label><button className="control-chip" onClick={() => addShape('rect')}>＋ Persegi</button><button className="control-chip" onClick={() => addShape('circle')}>＋ Lingkaran</button><button className="control-chip" onClick={() => addShape('triangle')}>＋ Segitiga</button><button className="control-chip" onClick={() => addShape('star')}>＋ Bintang</button><button className="control-chip" onClick={() => addShape('pentagon')}>＋ Segi lima</button><button className="control-chip" onClick={() => addShape('hexagon')}>＋ Segi enam</button><button className="control-chip" onClick={() => addShape('diamond')}>＋ Belah ketupat</button><button className="control-chip" onClick={() => addShape('line')}>＋ Garis</button><button className="control-chip" onClick={() => setTool(tool === 'draw' ? 'select' : 'draw')}>{tool === 'draw' ? 'Selesai menggambar' : 'Mode kuas'}</button><button className={`control-chip ${tool === 'bezier-edit' ? 'chip-active' : ''}`} onClick={() => { if (tool === 'bezier-edit') finishBezierEdit(); else { bezierPointsRef.current = []; setBezierPoints([]); setTool(tool === 'bezier' ? 'select' : 'bezier') } }}>{tool === 'bezier-edit' ? 'Selesai edit anchor' : tool === 'bezier' ? 'Keluar Bezier' : '＋ Bezier'}</button>{tool === 'bezier' && <><button className="control-chip" disabled={bezierPoints.length < 2} onClick={finishBezier}>Selesaikan path</button><button className="control-chip" disabled={!bezierPoints.length} onClick={() => { const next = bezierPointsRef.current.slice(0, -1); bezierPointsRef.current = next; setBezierPoints(next) }}>Hapus titik terakhir</button><button className="control-chip" onClick={cancelBezier}>Batal</button><label className="color-control">Warna path <input type="color" value={bezierColor} onChange={(e) => setBezierColor(e.target.value)} /></label><label>Tutup bentuk <input type="checkbox" checked={bezierClosed} onChange={(e) => setBezierClosed(e.target.checked)} /></label><span>{bezierPoints.length} titik</span></>}<label className="color-control">Warna kuas <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} /></label><label>Ukuran kuas <input type="range" min="1" max="60" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} /></label></div>}
              {activeTab === 'Object' && showEmojiLibrary && <div className="emoji-library"><input type="search" value={emojiSearch} onChange={(e) => setEmojiSearch(e.target.value)} placeholder="Cari emoji atau kategori" aria-label="Cari emoji atau kategori" /><div className="emoji-grid">{EMOJI_STICKERS.filter((emoji, index) => {
                const category = index < 30 ? 'wajah' : index < 40 ? 'hati cinta' : index < 56 ? 'alam bunga' : index < 61 ? 'makanan' : index < 75 ? 'perayaan benda' : index < 82 ? 'simbol' : 'gestur tangan'
                const query = emojiSearch.trim().toLocaleLowerCase('id')
                return !query || emoji.includes(query) || category.includes(query)
              }).map((emoji, index) => <button key={`${emoji}-${index}`} title={`Tambahkan ${emoji}`} onClick={() => addEmojiSticker(emoji)}>{emoji}</button>)}</div><small>Stiker berupa emoji teks sistem; tampilannya dapat berbeda antarperangkat.</small></div>}
              {activeTab === 'Object' && tool === 'draw' && <div className="quick-controls brush-options"><label>Penghalusan / simplifikasi <span>{brushSmooth.toFixed(1)}</span><input type="range" min="0" max="8" step="0.2" value={brushSmooth} onChange={(e) => setBrushSmooth(Number(e.target.value))} /></label><label>Garis putus-putus<input type="checkbox" checked={brushDashed} onChange={(e) => setBrushDashed(e.target.checked)} /></label><small>Penghalusan Fabric memakai kurva kuadratik; simplifikasi mengurangi titik berdekatan.</small></div>}
              {activeTab === 'Background' && <div className="quick-controls">
                <label className="color-control">Warna latar <input type="color" value={background} onChange={(e) => { setBackground(e.target.value); setTransparent(false) }} /></label>
                <button className={`control-chip ${transparent ? 'chip-active' : ''}`} onClick={() => setTransparent(!transparent)}>▧ Transparan</button>
                <label className="color-control">Gradasi <select value={backgroundGradientType} onChange={(e) => setBackgroundGradientType(e.target.value as 'linear' | 'radial')}><option value="linear">Linear</option><option value="radial">Radial</option></select></label>
                <label className="color-control">Warna awal <input type="color" value={backgroundGradientStart} onChange={(e) => setBackgroundGradientStart(e.target.value)} /></label>
                <label className="color-control">Warna akhir <input type="color" value={backgroundGradientEnd} onChange={(e) => setBackgroundGradientEnd(e.target.value)} /></label>
                <button className="control-chip" onClick={applyBackgroundGradient}>Terapkan gradasi</button>
                <button className="control-chip" onClick={() => document.getElementById('background-image')?.click()}>Pilih gambar latar</button>
                <button className="control-chip" onClick={() => openCamera('background')}>Ambil foto untuk latar</button>
                <input id="background-image" className="hidden-input" type="file" accept="image/*" onChange={(e) => { void chooseBackgroundImage(e.target.files?.[0]); e.currentTarget.value = '' }} />
                {editor.current?.backgroundImage instanceof FabricImage && <div className="background-crop-controls"><strong>Crop gambar latar</strong><div className="numeric-grid"><label>Crop X<input type="number" min="0" max={Math.round(editor.current.backgroundImage.width || 1)} value={Math.round(editor.current.backgroundImage.cropX || 0)} onChange={(e) => updateBackgroundCrop('cropX', Number(e.target.value))} /></label><label>Crop Y<input type="number" min="0" max={Math.round(editor.current.backgroundImage.height || 1)} value={Math.round(editor.current.backgroundImage.cropY || 0)} onChange={(e) => updateBackgroundCrop('cropY', Number(e.target.value))} /></label><label>Lebar<input type="number" min="1" value={Math.round(editor.current.backgroundImage.width || 1)} onChange={(e) => updateBackgroundCrop('width', Number(e.target.value))} /></label><label>Tinggi<input type="number" min="1" value={Math.round(editor.current.backgroundImage.height || 1)} onChange={(e) => updateBackgroundCrop('height', Number(e.target.value))} /></label></div><button className="control-chip" onClick={resetBackgroundCrop}>Reset crop latar</button></div>}
              </div>}
              {activeTab === 'Effects' && <div className="quick-controls effects-controls"><button className="control-chip" onClick={() => rotateCanvas('counterclockwise')}>↶ Putar 90°</button><button className="control-chip" onClick={() => rotateCanvas('clockwise')}>↷ Putar 90°</button><label>Brightness <input type="range" min="-100" max="100" value={effects.brightness} onChange={(e) => updateEffects({ brightness: Number(e.target.value) })} /></label><label>Contrast <input type="range" min="-100" max="100" value={effects.contrast} onChange={(e) => updateEffects({ contrast: Number(e.target.value) })} /></label><label>Saturation <input type="range" min="-100" max="100" value={effects.saturation} onChange={(e) => updateEffects({ saturation: Number(e.target.value) })} /></label><label>Hue <input type="range" min="-180" max="180" value={effects.hue} onChange={(e) => updateEffects({ hue: Number(e.target.value) })} /></label><label>Vignette <input type="range" min="0" max="100" value={effects.vignette} onChange={(e) => updateEffects({ vignette: Number(e.target.value) })} /></label><label>Noise <input type="range" min="0" max="100" value={effects.noise} onChange={(e) => updateEffects({ noise: Number(e.target.value) })} /></label><label>Stripes <input type="range" min="0" max="100" value={effects.stripes} onChange={(e) => updateEffects({ stripes: Number(e.target.value) })} /></label><button className="control-chip" onClick={() => updateEffects({ brightness: 0, contrast: 0, saturation: 0, hue: 0, vignette: 0, noise: 0, stripes: 0 })}>Reset efek</button></div>}
            </div>
          </div>
        </section>

        <aside className="inspector">
          <div className="panel-heading"><div><h2>Properti</h2><p>{selected ? getObjectName(selected, 0) : 'Pilih objek untuk mengedit'}</p></div><button className="panel-menu">•••</button></div>
          {selected ? <div className="inspector-content">
            {selectedText && <section className="property-section">
              <h3>Konten & tipografi</h3>
              <details className="saved-styles" open={savedTextStyles.length > 0}>
                <summary>Gaya teks tersimpan · {savedTextStyles.length}</summary>
                <div className="saved-style-create"><input aria-label="Nama gaya teks" value={newTextStyleName} onChange={(e) => setNewTextStyleName(e.target.value)} /><button className="control-chip" onClick={saveSelectedTextStyle}>Simpan gaya</button></div>
                {savedTextStyles.length > 0 ? <div className="saved-style-list">{savedTextStyles.map((style) => <div className="saved-style-row" key={style.id}><button className="saved-style-apply" title={`Terapkan gaya ${style.name}`} onClick={() => applySavedTextStyle(style)}>{style.name}</button><button className="saved-style-delete" title={`Hapus gaya ${style.name}`} onClick={() => deleteSavedTextStyle(style.id)}>×</button></div>)}</div> : <small>Gaya yang disimpan tersimpan lokal di browser ini.</small>}
              </details>
              <textarea value={selectedText.text} onChange={(e) => applyToSelected({ text: e.target.value })} rows={3} />
              <label className="property-label">Warna teks <input type="color" value={typeof selectedText.fill === 'string' ? selectedText.fill : '#202b47'} onChange={(e) => applyToSelected({ fill: e.target.value })} /></label>
              <details className="partial-color-panel"><summary>Warna sebagian teks</summary><small>Rentang indeks karakter memakai awal termasuk dan akhir tidak termasuk.</small><div className="numeric-grid"><label>Awal<input type="number" min="0" max={graphemeCount(selectedText.text)} value={partialTextStart} onChange={(e) => setPartialTextStart(Number(e.target.value))} /></label><label>Akhir<input type="number" min="0" max={graphemeCount(selectedText.text)} value={partialTextEnd} onChange={(e) => setPartialTextEnd(Number(e.target.value))} /></label></div><label className="property-label">Warna rentang <input type="color" value={partialTextColor} onChange={(e) => setPartialTextColor(e.target.value)} /></label><button className="control-chip" onClick={applyPartialTextColor}>Terapkan pada rentang</button></details>
              <div className="numeric-grid">
                <label>Perataan<select value={selectedText.textAlign || 'left'} onChange={(e) => applyToSelected({ textAlign: e.target.value })}><option value="left">Kiri</option><option value="center">Tengah</option><option value="right">Kanan</option><option value="justify">Justify</option></select></label>
                <label>Spasi huruf<input type="number" min="-500" max="2000" value={selectedText.charSpacing || 0} onChange={(e) => applyToSelected({ charSpacing: Number(e.target.value) })} /></label>
                <label>Spasi kata<input type="number" min="-100" max="500" value={(selectedText as WordSpacedText).canvasArtWordSpacing || 0} onChange={(e) => applyToSelected({ canvasArtWordSpacing: Number(e.target.value) })} /></label>
                <label>Jarak baris<input type="number" min="0.5" max="5" step="0.1" value={selectedText.lineHeight || 1.16} onChange={(e) => applyToSelected({ lineHeight: Number(e.target.value) })} /></label>
                <label>Garis bawah<input type="checkbox" checked={Boolean(selectedText.underline)} onChange={(e) => applyToSelected({ underline: e.target.checked })} /></label>
                <label>Teks dicoret<input type="checkbox" checked={Boolean(selectedText.linethrough)} onChange={(e) => applyToSelected({ linethrough: e.target.checked })} /></label>
              </div>
              <label className="property-label">Opacity <span>{Math.round((selectedText.opacity ?? 1) * 100)}%</span><input type="range" min="0" max="100" value={Math.round((selectedText.opacity ?? 1) * 100)} onChange={(e) => applyToSelected({ opacity: Number(e.target.value) / 100 })} /></label>
              <details><summary>Latar teks</summary><label className="property-label">Warna latar <input type="color" value={typeof selectedText.textBackgroundColor === 'string' && selectedText.textBackgroundColor ? selectedText.textBackgroundColor : '#f4c95d'} onChange={(e) => applyToSelected({ textBackgroundColor: e.target.value })} /></label><div className="numeric-grid"><label>Padding kiri<input type="number" min="0" max="100" value={(selectedText as BackgroundStyledText).canvasArtBackgroundPaddingLeft || 0} onChange={(e) => applyToSelected({ canvasArtBackgroundPaddingLeft: Number(e.target.value) })} /></label><label>Padding kanan<input type="number" min="0" max="100" value={(selectedText as BackgroundStyledText).canvasArtBackgroundPaddingRight || 0} onChange={(e) => applyToSelected({ canvasArtBackgroundPaddingRight: Number(e.target.value) })} /></label><label>Padding atas<input type="number" min="0" max="100" value={(selectedText as BackgroundStyledText).canvasArtBackgroundPaddingTop || 0} onChange={(e) => applyToSelected({ canvasArtBackgroundPaddingTop: Number(e.target.value) })} /></label><label>Padding bawah<input type="number" min="0" max="100" value={(selectedText as BackgroundStyledText).canvasArtBackgroundPaddingBottom || 0} onChange={(e) => applyToSelected({ canvasArtBackgroundPaddingBottom: Number(e.target.value) })} /></label><label>Radius sudut<input type="number" min="0" max="100" value={(selectedText as BackgroundStyledText).canvasArtBackgroundRadius || 0} onChange={(e) => applyToSelected({ canvasArtBackgroundRadius: Number(e.target.value) })} /></label></div><button className="control-chip" onClick={() => applyToSelected({ textBackgroundColor: '', canvasArtBackgroundPaddingLeft: 0, canvasArtBackgroundPaddingRight: 0, canvasArtBackgroundPaddingTop: 0, canvasArtBackgroundPaddingBottom: 0, canvasArtBackgroundRadius: 0 })}>Hapus latar teks</button></details>
              <details><summary>Stroke</summary><label className="property-label">Warna <input type="color" value={typeof selectedText.stroke === 'string' ? selectedText.stroke : '#000000'} onChange={(e) => applyToSelected({ stroke: e.target.value })} /></label><label className="property-label">Lebar <input type="range" min="0" max="20" value={Number(selectedText.strokeWidth || 0)} onChange={(e) => applyToSelected({ strokeWidth: Number(e.target.value) })} /></label></details>
              <details><summary>Bayangan</summary>
                <label className="property-label">Warna bayangan <input type="color" value={typeof (selectedText.shadow as { color?: string } | null)?.color === 'string' && (selectedText.shadow as { color: string }).color.startsWith('#') ? (selectedText.shadow as { color: string }).color : '#202b47'} onChange={(e) => updateTextShadow({ color: e.target.value })} /></label>
                <label className="property-label">Blur <span>{Math.round((selectedText.shadow as { blur?: number } | null)?.blur ?? 18)} px</span><input type="range" min="0" max="80" value={Math.round((selectedText.shadow as { blur?: number } | null)?.blur ?? 18)} onChange={(e) => updateTextShadow({ blur: Number(e.target.value) })} /></label>
                <div className="numeric-grid"><label>Offset X<input type="number" min="-120" max="120" value={Math.round((selectedText.shadow as { offsetX?: number } | null)?.offsetX ?? 5)} onChange={(e) => updateTextShadow({ offsetX: Number(e.target.value) })} /></label><label>Offset Y<input type="number" min="-120" max="120" value={Math.round((selectedText.shadow as { offsetY?: number } | null)?.offsetY ?? 8)} onChange={(e) => updateTextShadow({ offsetY: Number(e.target.value) })} /></label></div>
                <button className="control-chip" onClick={() => updateTextShadow({ color: '#5268dc', blur: 22, offsetX: 0, offsetY: 0 })}>Outer glow</button>
                <button className="control-chip" onClick={() => applyToSelected({ shadow: null })}>Matikan bayangan</button>
              </details>
              {renderMaskControls()}
              <details><summary>Rotasi 3D X/Y · ortografik</summary>
                <label className="property-label">Sumbu X <span>{(selectedText as ExtrudedText).canvasArt3DRotateX || 0}°</span><input type="range" min="-80" max="80" value={(selectedText as ExtrudedText).canvasArt3DRotateX || 0} onChange={(e) => updateText3DRotation('x', Number(e.target.value))} /></label>
                <label className="property-label">Sumbu Y <span>{(selectedText as ExtrudedText).canvasArt3DRotateY || 0}°</span><input type="range" min="-80" max="80" value={(selectedText as ExtrudedText).canvasArt3DRotateY || 0} onChange={(e) => updateText3DRotation('y', Number(e.target.value))} /></label>
                <small>Simulasi ortografik dengan pemendekan sumbu. Perspektif kamera dan manipulasi empat titik belum tersedia.</small>
              </details>
              <details><summary>Teks 3D · ekstrusi</summary>
                <label className="property-label">Kedalaman <span>{(selectedText as ExtrudedText).canvasArt3DDepth || 0} px</span><input type="range" min="0" max="32" value={(selectedText as ExtrudedText).canvasArt3DDepth || 0} onChange={(e) => applyToSelected({ canvasArt3DDepth: Number(e.target.value), objectCaching: Number(e.target.value) === 0 })} /></label>
                <div className="numeric-grid"><label>Sudut ekstrusi<input type="number" min="0" max="359" value={(selectedText as ExtrudedText).canvasArt3DAngle ?? 45} onChange={(e) => applyToSelected({ canvasArt3DAngle: Number(e.target.value) })} /></label><label>Mode<select value={(selectedText as ExtrudedText).canvasArt3DMode || 'oblique'} onChange={(e) => applyToSelected({ canvasArt3DMode: e.target.value })}><option value="oblique">Oblique</option><option value="perspective">Perspective semu</option></select></label></div>
                <label className="property-label">Warna kedalaman <input type="color" value={(selectedText as ExtrudedText).canvasArt3DColor || '#344987'} onChange={(e) => applyToSelected({ canvasArt3DColor: e.target.value })} /></label>
                <label className="property-label">Penggelapan sisi <span>{(selectedText as ExtrudedText).canvasArt3DDarken || 0}%</span><input type="range" min="0" max="100" value={(selectedText as ExtrudedText).canvasArt3DDarken || 0} onChange={(e) => applyToSelected({ canvasArt3DDarken: Number(e.target.value) })} /></label>
                <label className="property-label">Simulasikan cahaya <input type="checkbox" checked={Boolean((selectedText as ExtrudedText).canvasArt3DLightEnabled)} onChange={(e) => applyToSelected({ canvasArt3DLightEnabled: e.target.checked })} /></label>
                {(selectedText as ExtrudedText).canvasArt3DLightEnabled && <><label className="property-label">Arah cahaya <span>{(selectedText as ExtrudedText).canvasArt3DLightAngle ?? 315}°</span><input type="range" min="0" max="359" value={(selectedText as ExtrudedText).canvasArt3DLightAngle ?? 315} onChange={(e) => applyToSelected({ canvasArt3DLightAngle: Number(e.target.value) })} /></label>
                  <label className="property-label">Intensitas cahaya <span>{Math.round(((selectedText as ExtrudedText).canvasArt3DLightIntensity ?? 0.75) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selectedText as ExtrudedText).canvasArt3DLightIntensity ?? 0.75) * 100)} onChange={(e) => applyToSelected({ canvasArt3DLightIntensity: Number(e.target.value) / 100 })} /></label>
                  <label className="property-label">Ambient light <span>{Math.round(((selectedText as ExtrudedText).canvasArt3DAmbientLight ?? 0.22) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selectedText as ExtrudedText).canvasArt3DAmbientLight ?? 0.22) * 100)} onChange={(e) => applyToSelected({ canvasArt3DAmbientLight: Number(e.target.value) / 100 })} /></label></>}
                <small>Ekstrusi disusun dari salinan glyph 2D; perspektif semu belum sama dengan renderer 3D penuh.</small>
              </details>
              <details><summary>Emboss</summary>
                <label className="property-label">Aktif <input type="checkbox" checked={Boolean((selectedText as ExtrudedText).canvasArtEmbossEnabled)} onChange={(e) => applyToSelected({ canvasArtEmbossEnabled: e.target.checked })} /></label>
                <label className="property-label">Sudut cahaya <span>{(selectedText as ExtrudedText).canvasArtEmbossAngle ?? 45}°</span><input type="range" min="0" max="359" value={(selectedText as ExtrudedText).canvasArtEmbossAngle ?? 45} onChange={(e) => applyToSelected({ canvasArtEmbossAngle: Number(e.target.value) })} /></label>
                <label className="property-label">Intensitas <span>{Math.round(((selectedText as ExtrudedText).canvasArtEmbossIntensity ?? 0.65) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selectedText as ExtrudedText).canvasArtEmbossIntensity ?? 0.65) * 100)} onChange={(e) => applyToSelected({ canvasArtEmbossIntensity: Number(e.target.value) / 100 })} /></label>
                <label className="property-label">Ambient light <span>{Math.round(((selectedText as ExtrudedText).canvasArtEmbossAmbient ?? 0.2) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selectedText as ExtrudedText).canvasArtEmbossAmbient ?? 0.2) * 100)} onChange={(e) => applyToSelected({ canvasArtEmbossAmbient: Number(e.target.value) / 100 })} /></label>
                <label className="property-label">Specular hardness <span>{Math.round(((selectedText as ExtrudedText).canvasArtEmbossHardness ?? 0.7) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selectedText as ExtrudedText).canvasArtEmbossHardness ?? 0.7) * 100)} onChange={(e) => applyToSelected({ canvasArtEmbossHardness: Number(e.target.value) / 100 })} /></label>
                <label className="property-label">Bevel <span>{(selectedText as ExtrudedText).canvasArtEmbossBevel ?? 3} px</span><input type="range" min="1" max="24" value={(selectedText as ExtrudedText).canvasArtEmbossBevel ?? 3} onChange={(e) => applyToSelected({ canvasArtEmbossBevel: Number(e.target.value) })} /></label>
              </details>
              <details><summary>3D Shadow · lantai</summary>
                <label className="property-label">Aktif <input type="checkbox" checked={Boolean((selectedText as ExtrudedText).canvasArt3DShadowEnabled)} onChange={(e) => applyToSelected({ canvasArt3DShadowEnabled: e.target.checked })} /></label>
                <label className="property-label">Warna <input type="color" value={(selectedText as ExtrudedText).canvasArt3DShadowColor || '#161a24'} onChange={(e) => applyToSelected({ canvasArt3DShadowColor: e.target.value })} /></label>
                <label className="property-label">Arah <span>{(selectedText as ExtrudedText).canvasArt3DShadowAngle || 0}°</span><input type="range" min="-80" max="80" value={(selectedText as ExtrudedText).canvasArt3DShadowAngle || 0} onChange={(e) => applyToSelected({ canvasArt3DShadowAngle: Number(e.target.value) })} /></label>
                <label className="property-label">Panjang <span>{Math.round(((selectedText as ExtrudedText).canvasArt3DShadowLength ?? 0.2) * 100)}%</span><input type="range" min="5" max="80" value={Math.round(((selectedText as ExtrudedText).canvasArt3DShadowLength ?? 0.2) * 100)} onChange={(e) => applyToSelected({ canvasArt3DShadowLength: Number(e.target.value) / 100 })} /></label>
                <label className="property-label">Jarak <span>{(selectedText as ExtrudedText).canvasArt3DShadowGap ?? 0} px</span><input type="range" min="0" max="160" value={(selectedText as ExtrudedText).canvasArt3DShadowGap ?? 0} onChange={(e) => applyToSelected({ canvasArt3DShadowGap: Number(e.target.value) })} /></label>
                <label className="property-label">Blur <span>{(selectedText as ExtrudedText).canvasArt3DShadowBlur || 0} px</span><input type="range" min="0" max="60" value={(selectedText as ExtrudedText).canvasArt3DShadowBlur || 0} onChange={(e) => applyToSelected({ canvasArt3DShadowBlur: Number(e.target.value) })} /></label>
                <label className="property-label">Opacity <span>{Math.round(((selectedText as ExtrudedText).canvasArt3DShadowOpacity ?? 0.45) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selectedText as ExtrudedText).canvasArt3DShadowOpacity ?? 0.45) * 100)} onChange={(e) => applyToSelected({ canvasArt3DShadowOpacity: Number(e.target.value) / 100 })} /></label>
              </details>
              <details><summary>Reflection</summary>
                <label className="property-label">Aktif <input type="checkbox" checked={Boolean((selectedText as ExtrudedText).canvasArtReflectionEnabled)} onChange={(e) => applyToSelected({ canvasArtReflectionEnabled: e.target.checked })} /></label>
                <label className="property-label">Jarak <span>{(selectedText as ExtrudedText).canvasArtReflectionGap ?? 0} px</span><input type="range" min="0" max="120" value={(selectedText as ExtrudedText).canvasArtReflectionGap ?? 0} onChange={(e) => applyToSelected({ canvasArtReflectionGap: Number(e.target.value) })} /></label>
                <label className="property-label">Panjang <span>{Math.round(((selectedText as ExtrudedText).canvasArtReflectionLength ?? 0.65) * 100)}%</span><input type="range" min="10" max="150" value={Math.round(((selectedText as ExtrudedText).canvasArtReflectionLength ?? 0.65) * 100)} onChange={(e) => applyToSelected({ canvasArtReflectionLength: Number(e.target.value) / 100 })} /></label>
                <label className="property-label">Opacity <span>{Math.round(((selectedText as ExtrudedText).canvasArtReflectionOpacity ?? 0.35) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selectedText as ExtrudedText).canvasArtReflectionOpacity ?? 0.35) * 100)} onChange={(e) => applyToSelected({ canvasArtReflectionOpacity: Number(e.target.value) / 100 })} /></label>
              </details>
              <details><summary>Inner Shadow</summary>
                <label className="property-label">Aktif <input type="checkbox" checked={Boolean((selectedText as ExtrudedText).canvasArtInnerShadowEnabled)} onChange={(e) => applyToSelected({ canvasArtInnerShadowEnabled: e.target.checked, objectCaching: Number((selectedText as ExtrudedText).canvasArt3DDepth || 0) === 0 })} /></label>
                <label className="property-label">Warna <input type="color" value={(selectedText as ExtrudedText).canvasArtInnerShadowColor || '#202b47'} onChange={(e) => applyToSelected({ canvasArtInnerShadowColor: e.target.value })} /></label>
                <label className="property-label">Blur <span>{(selectedText as ExtrudedText).canvasArtInnerShadowBlur ?? 8} px</span><input type="range" min="0" max="48" value={(selectedText as ExtrudedText).canvasArtInnerShadowBlur ?? 8} onChange={(e) => applyToSelected({ canvasArtInnerShadowBlur: Number(e.target.value) })} /></label>
                <div className="numeric-grid"><label>Offset X<input type="number" min="-80" max="80" value={(selectedText as ExtrudedText).canvasArtInnerShadowOffsetX ?? 2} onChange={(e) => applyToSelected({ canvasArtInnerShadowOffsetX: Number(e.target.value) })} /></label><label>Offset Y<input type="number" min="-80" max="80" value={(selectedText as ExtrudedText).canvasArtInnerShadowOffsetY ?? 2} onChange={(e) => applyToSelected({ canvasArtInnerShadowOffsetY: Number(e.target.value) })} /></label></div>
                <label className="property-label">Opacity <span>{Math.round(((selectedText as ExtrudedText).canvasArtInnerShadowOpacity ?? 0.7) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selectedText as ExtrudedText).canvasArtInnerShadowOpacity ?? 0.7) * 100)} onChange={(e) => applyToSelected({ canvasArtInnerShadowOpacity: Number(e.target.value) / 100 })} /></label>
              </details>
              <details><summary>Gradasi teks</summary>
                <label className="property-label">Warna awal <input id="text-gradient-start" type="color" defaultValue="#5268dc" /></label>
                <label className="property-label">Warna akhir <input id="text-gradient-end" type="color" defaultValue="#f472b6" /></label>
                <label className="property-label">Jenis gradasi <select id="text-gradient-type" defaultValue="linear"><option value="linear">Linear</option><option value="radial">Radial</option></select></label>
                <button className="control-chip" onClick={() => applyTextGradient(
                  (document.getElementById('text-gradient-type') as HTMLSelectElement)?.value === 'radial' ? 'radial' : 'linear',
                  (document.getElementById('text-gradient-start') as HTMLInputElement)?.value || '#5268dc',
                  (document.getElementById('text-gradient-end') as HTMLInputElement)?.value || '#f472b6',
                )}>Terapkan gradasi</button>
                <button className="control-chip" onClick={() => applyToSelected({ fill: '#202b47' })}>Kembali ke warna solid</button>
              </details>
              <details><summary>Tekstur teks</summary>
                <button className="control-chip" onClick={() => document.getElementById('text-texture')?.click()}>Pilih gambar tekstur</button>
                <input id="text-texture" className="hidden-input" type="file" accept="image/*" onChange={(e) => { void applyTextTexture(e.target.files?.[0]); e.currentTarget.value = '' }} />
                <small>Gambar lokal diulang sebagai pola isi teks dan ikut tersimpan dalam proyek.</small>
              </details>
              <details><summary>Teks melengkung</summary>
                <label className="property-label">Lengkung <span>{(selectedText as FabricText & { canvasArtCurve?: number }).canvasArtCurve || 0}</span>
                  <input type="range" min="-100" max="100" value={(selectedText as FabricText & { canvasArtCurve?: number }).canvasArtCurve || 0} onChange={(e) => applyTextCurve(Number(e.target.value))} />
                </label>
                <small>Nilai positif melengkung ke atas; nilai negatif ke bawah.</small>
              </details>
            </section>}
            {(selected as FabricObject & { canvasArtArrowLength?: number }).canvasArtArrowLength && <section className="property-section"><h3>Panah</h3><label className="property-label">Panjang <span>{(selected as FabricObject & { canvasArtArrowLength?: number }).canvasArtArrowLength} px</span><input type="range" min="40" max="1200" step="10" value={(selected as FabricObject & { canvasArtArrowLength: number }).canvasArtArrowLength} onChange={(e) => updateSelectedArrow({ length: Number(e.target.value) })} /></label><label className="property-label">Tebal batang <span>{(selected as FabricObject & { canvasArtArrowThickness?: number }).canvasArtArrowThickness || 32} px</span><input type="range" min="4" max="240" step="2" value={(selected as FabricObject & { canvasArtArrowThickness?: number }).canvasArtArrowThickness || 32} onChange={(e) => updateSelectedArrow({ thickness: Number(e.target.value) })} /></label><div className="numeric-grid"><label>Kepala<select value={(selected as FabricObject & { canvasArtArrowHead?: string }).canvasArtArrowHead || 'wide'} onChange={(e) => updateSelectedArrow({ head: e.target.value as 'wide' | 'narrow' | 'none' })}><option value="wide">Lebar</option><option value="narrow">Sempit</option><option value="none">Tanpa kepala</option></select></label><label>Ekor<select value={(selected as FabricObject & { canvasArtArrowTail?: string }).canvasArtArrowTail || 'flat'} onChange={(e) => updateSelectedArrow({ tail: e.target.value as 'flat' | 'notched' })}><option value="flat">Rata</option><option value="notched">Takik</option></select></label></div><small>Pengaturan ini mengubah geometri panah dan ikut tersimpan di project.</small></section>}
            <section className="property-section"><h3>Perspektif empat titik</h3>{(selected as FabricObject & { canvasArtWarpSourceId?: string; canvasArtWarpCorners?: PerspectiveCorner[] }).canvasArtWarpSourceId ? <><small>Objek dirender sebagai mesh perspektif; layer sumber tetap tersimpan dan bisa dipulihkan.</small><div className="numeric-grid">{(['Kiri atas','Kanan atas','Kanan bawah','Kiri bawah'] as const).flatMap((label, index) => { const point = (selected as FabricImage & { canvasArtWarpCorners?: PerspectiveCorner[] }).canvasArtWarpCorners?.[index] || [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }][index]; return [<label key={`${label}-x`}>{label} X %<input type="number" min="-50" max="150" step="1" value={Math.round(point.x * 100)} onChange={(e) => updatePerspectiveCorner(index, 'x', Number(e.target.value) / 100)} /></label>,<label key={`${label}-y`}>{label} Y %<input type="number" min="-50" max="150" step="1" value={Math.round(point.y * 100)} onChange={(e) => updatePerspectiveCorner(index, 'y', Number(e.target.value) / 100)} /></label>] })}</div><button className="control-chip danger-chip" onClick={removePerspectiveWarp}>Lepas warp · pulihkan sumber</button></> : <><small>Atur posisi X/Y keempat sudut dalam persen dari ukuran objek.</small><button className="control-chip" onClick={applyPerspectiveWarp}>Mulai warp perspektif</button></>}</section>
            <section className="property-section"><h3>Mask objek</h3>{renderMaskControls()}</section>
            {selected.type !== 'image' && <section className="property-section"><h3>Isi & garis objek</h3><label className="property-label">Warna isi <input type="color" value={typeof selected.fill === 'string' ? selected.fill : '#8eafff'} onChange={(e) => applyToSelected({ fill: e.target.value })} /></label><label className="property-label">Opasitas <span>{Math.round((selected.opacity ?? 1) * 100)}%</span><input type="range" min="0" max="100" value={Math.round((selected.opacity ?? 1) * 100)} onChange={(e) => applyToSelected({ opacity: Number(e.target.value) / 100 })} /></label><label className="property-label">Warna garis <input type="color" value={typeof selected.stroke === 'string' ? selected.stroke : '#202b47'} onChange={(e) => applyToSelected({ stroke: e.target.value })} /></label><label className="property-label">Ketebalan garis <input type="range" min="0" max="40" value={Number(selected.strokeWidth || 0)} onChange={(e) => applyToSelected({ strokeWidth: Number(e.target.value) })} /></label>{!['text','i-text','textbox','group'].includes(selected.type || '') && <details><summary>Gradien dan tekstur</summary><label className="property-label">Warna awal <input id="object-gradient-start" type="color" defaultValue="#5268dc" /></label><label className="property-label">Warna akhir <input id="object-gradient-end" type="color" defaultValue="#f472b6" /></label><label className="property-label">Jenis gradasi <select id="object-gradient-type" defaultValue="linear"><option value="linear">Linear</option><option value="radial">Radial</option></select></label><button className="control-chip" onClick={() => applyObjectGradient((document.getElementById('object-gradient-type') as HTMLSelectElement)?.value === 'radial' ? 'radial' : 'linear', (document.getElementById('object-gradient-start') as HTMLInputElement)?.value || '#5268dc', (document.getElementById('object-gradient-end') as HTMLInputElement)?.value || '#f472b6')}>Terapkan gradien</button><button className="control-chip" onClick={() => document.getElementById('object-texture')?.click()}>Pilih tekstur gambar</button><input id="object-texture" className="hidden-input" type="file" accept="image/*" onChange={(e) => { void applyObjectTexture(e.target.files?.[0]); e.currentTarget.value = '' }} /></details>}</section>}
            {selected.type === 'image' && <section className="property-section"><h3>Crop gambar</h3>
              <div className="numeric-grid">
                <label>Crop X<input type="number" min="0" value={Math.round((selected as FabricImage).cropX || 0)} onChange={(e) => updateImageCrop('cropX', Number(e.target.value))} /></label>
                <label>Crop Y<input type="number" min="0" value={Math.round((selected as FabricImage).cropY || 0)} onChange={(e) => updateImageCrop('cropY', Number(e.target.value))} /></label>
                <label>Lebar crop<input type="number" min="1" value={Math.round(selected.width || 1)} onChange={(e) => updateImageCrop('width', Number(e.target.value))} /></label>
                <label>Tinggi crop<input type="number" min="1" value={Math.round(selected.height || 1)} onChange={(e) => updateImageCrop('height', Number(e.target.value))} /></label>
              </div>
              <button className="control-chip" onClick={resetImageCrop}>Reset crop</button>
              <button className="control-chip" onClick={() => document.getElementById('reselect-image')?.click()}>Ganti gambar</button>
              <input id="reselect-image" className="hidden-input" type="file" accept="image/*" onChange={(e) => { void reselectImage(e.target.files?.[0]); e.currentTarget.value = '' }} />
            </section>}
            {selected.type === 'image' && <section className="property-section"><h3>Penghapus manual</h3>
              <button className={`control-chip ${tool === 'erase' ? 'chip-active' : ''}`} onClick={() => setTool(tool === 'erase' ? 'select' : 'erase')}>{tool === 'erase' ? 'Selesai menghapus' : 'Mode penghapus'}</button>
              {tool === 'erase' && <label className="property-label">Ukuran kuas <span>{eraserWidth} px</span><input type="range" min="2" max="240" value={eraserWidth} onChange={(e) => setEraserWidth(Number(e.target.value))} /></label>}
              <small>Pilih gambar, aktifkan mode, lalu sapukan kuas. Setiap sapuan dapat dibatalkan dengan Undo.</small>
            </section>}
            {selected.type === 'image' && <section className="property-section"><h3>Filter gambar</h3>
              <label className="property-label">Brightness <span>{Math.round(getImageFilter('Brightness', 'brightness') * 100)}</span><input type="range" min="-100" max="100" value={Math.round(getImageFilter('Brightness', 'brightness') * 100)} onChange={(e) => setImageFilter('Brightness', 'brightness', Number(e.target.value) / 100)} /></label>
              <label className="property-label">Contrast <span>{Math.round(getImageFilter('Contrast', 'contrast') * 100)}</span><input type="range" min="-100" max="100" value={Math.round(getImageFilter('Contrast', 'contrast') * 100)} onChange={(e) => setImageFilter('Contrast', 'contrast', Number(e.target.value) / 100)} /></label>
              <label className="property-label">Saturation <span>{Math.round(getImageFilter('Saturation', 'saturation') * 100)}</span><input type="range" min="-100" max="100" value={Math.round(getImageFilter('Saturation', 'saturation') * 100)} onChange={(e) => setImageFilter('Saturation', 'saturation', Number(e.target.value) / 100)} /></label>
              <label className="property-label">Hue <span>{Math.round(getImageFilter('HueRotation', 'rotation') * 180)}°</span><input type="range" min="-180" max="180" value={Math.round(getImageFilter('HueRotation', 'rotation') * 180)} onChange={(e) => setImageFilter('HueRotation', 'rotation', Number(e.target.value) / 180)} /></label>
              <button className="control-chip" onClick={() => { setImageFilter('Brightness', 'brightness', 0); setImageFilter('Contrast', 'contrast', 0); setImageFilter('Saturation', 'saturation', 0); setImageFilter('HueRotation', 'rotation', 0) }}>Reset filter gambar</button>
            </section>}
            {selected.type === 'image' && <section className="property-section"><h3>Erase Color / Chroma Key</h3><label className="property-label">Warna yang dihapus <input type="color" value={chromaColor} onChange={(e) => setChromaColor(e.target.value)} /></label><label className="property-label">Toleransi <span>{chromaTolerance}</span><input type="range" min="0" max="255" value={chromaTolerance} onChange={(e) => setChromaTolerance(Number(e.target.value))} /></label><label className="property-label">Kehalusan tepi <span>{chromaSoftness}</span><input type="range" min="0" max="128" value={chromaSoftness} onChange={(e) => setChromaSoftness(Number(e.target.value))} /></label><button className="control-chip" onClick={() => void eraseImageColor()}>Hapus warna dari gambar</button></section>}
            {selected.type === 'path' && Boolean((selected as FabricPath & { canvasArtBezierPoints?: BezierPoint[] }).canvasArtBezierPoints?.length) && <section className="property-section"><h3>Path Bezier</h3><button className={`control-chip ${tool === 'bezier-edit' ? 'chip-active' : ''}`} onClick={() => tool === 'bezier-edit' ? finishBezierEdit() : startBezierEdit()}>{tool === 'bezier-edit' ? 'Selesai edit anchor' : 'Edit anchor dan handle'}</button><small>Seret titik jangkar di kanvas untuk mengubah bentuk path.</small></section>}
            {!selectedText && ['image','rect','circle','ellipse','triangle','polygon','path'].includes(selected.type || '') && <section className="property-section"><h3>Efek permukaan objek</h3>
              <details><summary>Inner Shadow</summary>
                <label className="property-label">Aktif <input type="checkbox" checked={Boolean((selected as StyledCanvasObject).canvasArtInnerShadowEnabled)} onChange={(e) => applyToSelected({ canvasArtInnerShadowEnabled: e.target.checked, objectCaching: false, dirty: true })} /></label>
                <label className="property-label">Warna <input type="color" value={(selected as StyledCanvasObject).canvasArtInnerShadowColor || '#202b47'} onChange={(e) => applyToSelected({ canvasArtInnerShadowColor: e.target.value, objectCaching: false, dirty: true })} /></label>
                <label className="property-label">Blur <span>{(selected as StyledCanvasObject).canvasArtInnerShadowBlur || 0} px</span><input type="range" min="0" max="48" value={(selected as StyledCanvasObject).canvasArtInnerShadowBlur || 0} onChange={(e) => applyToSelected({ canvasArtInnerShadowBlur: Number(e.target.value), objectCaching: false, dirty: true })} /></label>
                <div className="numeric-grid"><label>Offset X<input type="number" min="-80" max="80" value={(selected as StyledCanvasObject).canvasArtInnerShadowOffsetX || 0} onChange={(e) => applyToSelected({ canvasArtInnerShadowOffsetX: Number(e.target.value), objectCaching: false, dirty: true })} /></label><label>Offset Y<input type="number" min="-80" max="80" value={(selected as StyledCanvasObject).canvasArtInnerShadowOffsetY || 0} onChange={(e) => applyToSelected({ canvasArtInnerShadowOffsetY: Number(e.target.value), objectCaching: false, dirty: true })} /></label></div>
                <label className="property-label">Opacity <span>{Math.round(((selected as StyledCanvasObject).canvasArtInnerShadowOpacity ?? 0.7) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selected as StyledCanvasObject).canvasArtInnerShadowOpacity ?? 0.7) * 100)} onChange={(e) => applyToSelected({ canvasArtInnerShadowOpacity: Number(e.target.value) / 100, objectCaching: false, dirty: true })} /></label>
              </details>
              <details><summary>Emboss</summary>
                <label className="property-label">Aktif <input type="checkbox" checked={Boolean((selected as StyledCanvasObject).canvasArtEmbossEnabled)} onChange={(e) => applyToSelected({ canvasArtEmbossEnabled: e.target.checked, objectCaching: false, dirty: true })} /></label>
                <label className="property-label">Sudut cahaya <span>{(selected as StyledCanvasObject).canvasArtEmbossAngle ?? 45}°</span><input type="range" min="0" max="359" value={(selected as StyledCanvasObject).canvasArtEmbossAngle ?? 45} onChange={(e) => applyToSelected({ canvasArtEmbossAngle: Number(e.target.value), objectCaching: false, dirty: true })} /></label>
                <label className="property-label">Intensitas <span>{Math.round(((selected as StyledCanvasObject).canvasArtEmbossIntensity ?? 0.65) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selected as StyledCanvasObject).canvasArtEmbossIntensity ?? 0.65) * 100)} onChange={(e) => applyToSelected({ canvasArtEmbossIntensity: Number(e.target.value) / 100, objectCaching: false, dirty: true })} /></label>
                <label className="property-label">Ambient light <span>{Math.round(((selected as StyledCanvasObject).canvasArtEmbossAmbient ?? 0.2) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selected as StyledCanvasObject).canvasArtEmbossAmbient ?? 0.2) * 100)} onChange={(e) => applyToSelected({ canvasArtEmbossAmbient: Number(e.target.value) / 100, objectCaching: false, dirty: true })} /></label>
                <label className="property-label">Specular hardness <span>{Math.round(((selected as StyledCanvasObject).canvasArtEmbossHardness ?? 0.7) * 100)}%</span><input type="range" min="0" max="100" value={Math.round(((selected as StyledCanvasObject).canvasArtEmbossHardness ?? 0.7) * 100)} onChange={(e) => applyToSelected({ canvasArtEmbossHardness: Number(e.target.value) / 100, objectCaching: false, dirty: true })} /></label>
                <label className="property-label">Bevel <span>{(selected as StyledCanvasObject).canvasArtEmbossBevel ?? 3} px</span><input type="range" min="1" max="24" value={(selected as StyledCanvasObject).canvasArtEmbossBevel ?? 3} onChange={(e) => applyToSelected({ canvasArtEmbossBevel: Number(e.target.value), objectCaching: false, dirty: true })} /></label>
              </details>
            </section>}
            {!selectedText && <section className="property-section"><h3>Bayangan objek</h3>
              <label className="property-label">Aktif <input type="checkbox" checked={Boolean(selected.shadow)} onChange={(e) => updateObjectShadow(e.target.checked ? {} : null)} /></label>
              <label className="property-label">Warna <input type="color" value={typeof (selected.shadow as { color?: string } | null)?.color === 'string' && (selected.shadow as { color: string }).color.startsWith('#') ? (selected.shadow as { color: string }).color : '#202b47'} onChange={(e) => updateObjectShadow({ color: e.target.value })} /></label>
              <label className="property-label">Blur <span>{Math.round((selected.shadow as { blur?: number } | null)?.blur || 0)} px</span><input type="range" min="0" max="80" value={Math.round((selected.shadow as { blur?: number } | null)?.blur || 0)} onChange={(e) => updateObjectShadow({ blur: Number(e.target.value) })} /></label>
              <div className="numeric-grid"><label>Offset X<input type="number" min="-120" max="120" value={Math.round((selected.shadow as { offsetX?: number } | null)?.offsetX || 0)} onChange={(e) => updateObjectShadow({ offsetX: Number(e.target.value) })} /></label><label>Offset Y<input type="number" min="-120" max="120" value={Math.round((selected.shadow as { offsetY?: number } | null)?.offsetY || 0)} onChange={(e) => updateObjectShadow({ offsetY: Number(e.target.value) })} /></label></div>
              <button className="control-chip" onClick={() => updateObjectShadow({ color: '#5268dc', blur: 22, offsetX: 0, offsetY: 0 })}>Outer glow</button>
            </section>}
            <section className="property-section"><h3>Transformasi</h3><div className="numeric-grid"><label>X<input type="number" value={Math.round(selected.left || 0)} onChange={(e) => applyToSelected({ left: Number(e.target.value) })} /></label><label>Y<input type="number" value={Math.round(selected.top || 0)} onChange={(e) => applyToSelected({ top: Number(e.target.value) })} /></label><label>Sudut<input type="number" value={Math.round(selected.angle || 0)} onChange={(e) => applyToSelected({ angle: Number(e.target.value) })} /></label><label>Skala<input type="number" step="0.1" value={Number((selected.scaleX || 1).toFixed(1))} onChange={(e) => applyToSelected({ scaleX: Number(e.target.value), scaleY: Number(e.target.value) })} /></label></div><h4 className="relative-position-title">Posisi relatif pada kanvas</h4><div className="relative-position-grid" role="group" aria-label="Posisi relatif pada kanvas">{(['top','center','bottom'] as const).flatMap((vertical) => (['left','center','right'] as const).map((horizontal) => <button key={`${vertical}-${horizontal}`} title={`${vertical === 'top' ? 'Atas' : vertical === 'center' ? 'Tengah' : 'Bawah'} · ${horizontal === 'left' ? 'Kiri' : horizontal === 'center' ? 'Tengah' : 'Kanan'}`} aria-label={`Posisi ${vertical} ${horizontal}`} onClick={() => positionSelectedRelative(horizontal, vertical)}><span className={`position-dot dot-${vertical}-${horizontal}`} /></button>))}</div></section>
            <section className="property-section"><h3>Layer terpilih</h3><div className="layer-actions"><button onClick={duplicateSelected}>Duplikasi</button><button onClick={() => void copySelected()}>Salin</button><button disabled={!clipboardHasObject} onClick={() => void pasteObject()}>Tempel</button><button onClick={() => moveLayer(selected, 'up')}>Naik satu</button><button onClick={() => moveLayer(selected, 'down')}>Turun satu</button><button onClick={() => moveLayerTo(selected, 'front')}>Paling depan</button><button onClick={() => moveLayerTo(selected, 'back')}>Paling belakang</button><button className="danger-text" onClick={deleteSelected}>Hapus</button>{selected.type === 'group' && <button onClick={ungroupSelected}>Bongkar grup</button>}</div></section>
          </div> : <div className="empty-selection"><div className="empty-icon">✦</div><strong>Belum ada objek dipilih</strong><span>Pilih elemen di kanvas atau tambahkan elemen baru.</span><button className="control-chip" onClick={addText}>＋ Tambah teks</button></div>}
          <div className="layers-panel">
            <div className="layers-title"><h3>Layers</h3><span>{objects.length}</span><button title="Tambah teks" onClick={addText}>＋</button></div>
            {checkedLayers.length > 0 && <>
              <div className="layer-bulk-actions"><span>{checkedLayers.length} dipilih</span><button onClick={deleteCheckedLayers}>Hapus</button><button disabled={checkedLayers.length < 2} onClick={groupCheckedLayers}>Grup</button><button disabled={checkedLayers.length < 2} onClick={() => void mergeCheckedLayers()}>Gabungkan</button></div>
              <div className="layer-align-actions">
                <button onClick={() => alignCheckedLayers('left')}>Kiri</button><button onClick={() => alignCheckedLayers('centerX')}>Tengah X</button><button onClick={() => alignCheckedLayers('right')}>Kanan</button>
                <button onClick={() => alignCheckedLayers('top')}>Atas</button><button onClick={() => alignCheckedLayers('centerY')}>Tengah Y</button><button onClick={() => alignCheckedLayers('bottom')}>Bawah</button>
                <button disabled={checkedLayers.length < 3} onClick={() => alignCheckedLayers('distributeX')}>Sebar X</button><button disabled={checkedLayers.length < 3} onClick={() => alignCheckedLayers('distributeY')}>Sebar Y</button>
              </div>
            </>}
            <div className="layer-list">{[...objects].reverse().map((object, reverseIndex) => {
              const index = objects.length - reverseIndex - 1
              const attrs = object as FabricObject & { name?: string; visible?: boolean; selectable?: boolean }
              return <div className={`layer-row ${selected === object ? 'layer-selected' : ''}`} key={String((object as FabricObject & { id?: string }).id || index)} onClick={() => { editor.current?.setActiveObject(object); syncObjects() }}>
                <input className="layer-check" type="checkbox" aria-label={`Pilih layer ${getObjectName(object, index)}`} checked={checkedLayers.includes(object)} onClick={(e) => e.stopPropagation()} onChange={() => toggleLayerCheck(object)} />
                <span className="layer-type">{object.type === 'i-text' || object.type === 'text' || object.type === 'textbox' ? 'T' : object.type === 'image' ? '▧' : '◇'}</span>
                <input aria-label="Nama layer" value={getObjectName(object, index)} onClick={(e) => e.stopPropagation()} onChange={(e) => renameLayer(object, e.target.value)} />
                <button title={attrs.visible === false ? 'Tampilkan' : 'Sembunyikan'} onClick={(e) => { e.stopPropagation(); attrs.visible = attrs.visible === false; object.set('visible', attrs.visible); editor.current?.requestRenderAll(); syncObjects(); commit() }}>{attrs.visible === false ? '○' : '◉'}</button>
                <button title="Kunci/buka" onClick={(e) => { e.stopPropagation(); object.set('selectable', attrs.selectable === false); object.set('evented', attrs.selectable === false); syncObjects(); commit() }}>{attrs.selectable === false ? '▣' : '⌑'}</button>
              </div>
            })}{!objects.length && <div className="layers-empty">Objek akan muncul di sini</div>}</div>
          </div>
        </aside>
      </main>

      {showAddMenu && <div className="modal-backdrop" onClick={() => setShowAddMenu(false)}><div className="modal-card menu-modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">ELEMEN KANVAS</span><h2>Tambah elemen</h2></div><button onClick={() => setShowAddMenu(false)}>×</button></div><button className="menu-action" onClick={() => { setShowAddMenu(false); addText() }}>Teks baru</button><button className="menu-action" onClick={() => { setShowAddMenu(false); addDate() }}>Tanggal saat ini</button><button className="menu-action" onClick={() => { setShowAddMenu(false); setActiveTab('Object'); setShowEmojiLibrary(true) }}>Stiker & emoji</button><button className="menu-action" onClick={() => { setShowAddMenu(false); setActiveTab('Object'); addShape('rect') }}>Bentuk persegi</button><button className="menu-action" onClick={() => { setShowAddMenu(false); document.getElementById('import-image')?.click() }}>Impor gambar</button><button className="menu-action" onClick={() => { setShowAddMenu(false); openCamera('object') }}>Ambil foto sebagai objek</button><button className="menu-action" onClick={() => { setShowAddMenu(false); setActiveTab('Object'); setTool('draw') }}>Gambar dengan kuas</button></div></div>}
      {showMenu && <div className="modal-backdrop" onClick={() => setShowMenu(false)}><div className="modal-card menu-modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">CANVASART</span><h2>Menu proyek</h2></div><button onClick={() => setShowMenu(false)}>×</button></div><button className="menu-action" onClick={() => document.getElementById('menu-background-image')?.click()}>Gunakan gambar sebagai latar</button><input id="menu-background-image" className="hidden-input" type="file" accept="image/*" onChange={(e) => { void chooseBackgroundImage(e.target.files?.[0]); e.currentTarget.value = '' }} /><button className="menu-action" onClick={() => { setShowMenu(false); openCamera('background') }}>Ambil gambar dari kamera</button><button className="menu-action" onClick={() => { setShowMenu(false); setShowSize(true) }}>Ukuran kanvas…</button><button className="menu-action" onClick={() => { setShowMenu(false); void restoreAutosave() }}>Pulihkan autosave</button><button className="menu-action" onClick={() => { setShowMenu(false); setShowQuotes(true) }}>Buka kutipan</button><div className="menu-note">Pemrosesan desain dilakukan lokal di browser.</div></div></div>}
      {showCamera && <div className="modal-backdrop" onClick={() => setShowCamera(false)}><div className="modal-card camera-modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">KAMERA LOKAL</span><h2>{cameraTarget === 'background' ? 'Ambil foto untuk latar' : 'Ambil foto sebagai objek'}</h2></div><button onClick={() => setShowCamera(false)}>×</button></div><div className="camera-preview">{cameraActive ? <video ref={cameraVideo} autoPlay playsInline muted /> : <div><span>Pratinjau kamera akan muncul di sini.</span><button className="control-chip" onClick={() => void startCamera()}>Aktifkan kamera</button></div>}</div>{cameraError && <p className="camera-error" role="alert">{cameraError}</p>}<input id="camera-file" className="hidden-input" type="file" accept="image/*" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (cameraTarget === 'background') void chooseBackgroundImage(file); else void addImage(file); setShowCamera(false) } e.currentTarget.value = '' }} /><div className="camera-actions"><button className="quiet-btn" onClick={() => document.getElementById('camera-file')?.click()}>Pilih file</button>{cameraActive && <button className="primary-btn" onClick={() => void captureCameraImage()}>Ambil foto</button>}</div><small className="size-hint">Browser akan meminta izin kamera. Video hanya digunakan untuk mengambil foto di perangkat ini.</small></div></div>}
      {showSize && <div className="modal-backdrop" onClick={() => setShowSize(false)}><div className="modal-card size-modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">DOKUMEN</span><h2>Ukuran kanvas</h2></div><button onClick={() => setShowSize(false)}>×</button></div><div className="size-presets">{[['Square',1080,1080],['Profile Picture',800,800],['YouTube Thumbnail',1280,720],['YouTube Channel Banner',2560,1440],['Facebook Cover Art',1640,624],['Google Header Image',2120,1192],['Twitter Header Size',1500,500]].map(([name,w,h]) => <button key={String(name)} className="control-chip" onClick={() => resizeCanvas(Number(w),Number(h))}>{name} · {w}×{h}</button>)}</div><div className="size-fields"><label>Lebar<input id="custom-width" type="number" min="16" max="8192" defaultValue={canvasWidth} /></label><label>Tinggi<input id="custom-height" type="number" min="16" max="8192" defaultValue={canvasHeight} /></label></div><label className="size-scale-option"><input type="checkbox" checked={scaleContentsOnResize} onChange={(e) => setScaleContentsOnResize(e.target.checked)} /> Skalakan posisi dan objek mengikuti ukuran baru</label><button className="primary-btn export-confirm" onClick={() => resizeCanvas(Number((document.getElementById('custom-width') as HTMLInputElement)?.value), Number((document.getElementById('custom-height') as HTMLInputElement)?.value))}>Terapkan ukuran</button><small className="size-hint">Maks. 8192 px per sisi. Pilih opsi di atas untuk ikut menskalakan isi desain.</small></div></div>}
      {showQuotes && <div className="modal-backdrop" onClick={() => setShowQuotes(false)}><div className="modal-card quote-modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PUSTAKA LOKAL · {QUOTES.length}</span><h2>Kutipan</h2></div><button onClick={() => setShowQuotes(false)}>×</button></div><p className="modal-intro">Pilih kutipan orisinal CanvasArt untuk menambahkannya sebagai teks yang bisa diedit.</p><input className="quote-search" type="search" value={quoteSearch} onChange={(e) => setQuoteSearch(e.target.value)} placeholder="Cari kutipan…" aria-label="Cari kutipan" /><div className="quote-filters"><select aria-label="Kategori kutipan" value={quoteCategory} onChange={(e) => setQuoteCategory(e.target.value as 'all' | QuoteCategory)}><option value="all">Semua kategori</option>{['Motivation','Success','Friendship','Happiness','Inspiration','Positivity','Absurd'].map((category) => <option key={category}>{category}</option>)}</select><select aria-label="Bahasa kutipan" value={quoteLanguage} onChange={(e) => setQuoteLanguage(e.target.value as 'all' | QuoteLanguage)}><option value="all">Semua bahasa</option><option value="id">Indonesia</option><option value="en">English</option></select><button className={`control-chip ${showFavoriteQuotesOnly ? 'chip-active' : ''}`} onClick={() => setShowFavoriteQuotesOnly(!showFavoriteQuotesOnly)}>★ Favorit</button></div><div className="quote-list">{visibleQuotes.map((quote) => <div className="quote-row" key={quote.id}><button className="quote-choice" onClick={() => addQuote(quote)}><span>“{quote.text}”</span><small>{quote.category} · {quote.language === 'id' ? 'Indonesia' : 'English'}</small></button><button className={`quote-favorite ${favoriteQuotes.includes(quote.id) ? 'is-favorite' : ''}`} aria-label={favoriteQuotes.includes(quote.id) ? 'Hapus dari favorit' : 'Tambahkan ke favorit'} title={favoriteQuotes.includes(quote.id) ? 'Hapus favorit' : 'Jadikan favorit'} onClick={() => toggleQuoteFavorite(quote.id)}>{favoriteQuotes.includes(quote.id) ? '★' : '☆'}</button></div>)}{visibleQuotes.length === 0 && <div className="quote-empty">Tidak ada kutipan yang cocok.</div>}</div></div></div>}
      {showExport && <div className="modal-backdrop" onClick={() => setShowExport(false)}><div className="modal-card export-modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">SIMPAN HASIL</span><h2>Ekspor desain</h2></div><button onClick={() => setShowExport(false)}>×</button></div><label className="modal-label">Format<select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as 'png' | 'jpeg')}><option value="png">PNG · transparan</option><option value="jpeg">JPEG · kualitas tinggi</option></select></label>{exportFormat === 'jpeg' && <label className="modal-label">Kualitas JPEG · {Math.round(exportJpegQuality * 100)}%<input type="range" min="0.3" max="1" step="0.05" value={exportJpegQuality} onChange={(e) => setExportJpegQuality(Number(e.target.value))} /></label>}<label className="modal-label">Ukuran<select value={exportScale} onChange={(e) => setExportScale(Number(e.target.value))}><option value="0.5">Low · {Math.round(canvasWidth * 0.5)} × {Math.round(canvasHeight * 0.5)} px</option><option value="0.75">Medium · {Math.round(canvasWidth * 0.75)} × {Math.round(canvasHeight * 0.75)} px</option><option value="1">High · {canvasWidth} × {canvasHeight} px</option><option value="1.5">Very High · {Math.round(canvasWidth * 1.5)} × {Math.round(canvasHeight * 1.5)} px</option><option value="2">Ultra · {canvasWidth * 2} × {canvasHeight * 2} px</option></select></label><label className="modal-label export-custom-toggle">Dimensi kustom<input type="checkbox" checked={exportCustomDimensions} onChange={(e) => setExportCustomDimensions(e.target.checked)} /></label>{exportCustomDimensions && <div className="size-fields"><label>Lebar keluaran<input type="number" min="16" max="8192" value={exportCustomWidth} onChange={(e) => setExportCustomWidth(Number(e.target.value) || 16)} onBlur={() => setExportCustomWidth((value) => Math.max(16, Math.min(8192, Math.round(value))))} /></label><label>Tinggi keluaran<input type="number" min="16" max="8192" value={exportCustomHeight} onChange={(e) => setExportCustomHeight(Number(e.target.value) || 16)} onBlur={() => setExportCustomHeight((value) => Math.max(16, Math.min(8192, Math.round(value))))} /></label></div>}<label className="modal-label">Penyesuaian isi<select value={exportFit} onChange={(e) => setExportFit(e.target.value as 'contain' | 'stretch')}><option value="contain">Pertahankan proporsi</option><option value="stretch">Penuhi ukuran keluaran</option></select></label><small className="size-hint">Mode pertahankan proporsi akan menyisakan ruang transparan di PNG atau putih di JPEG bila rasio ukuran berbeda.</small><div className="export-preview"><div className="preview-image-wrap">{exportPreviewUrl ? <img src={exportPreviewUrl} alt={`Preview ${projectName}`} /> : <span>{exportPreviewLoading ? 'Merender preview…' : exportPreviewError || 'Preview belum tersedia'}</span>}</div><div><b>{projectName}</b><small>{exportCustomDimensions ? `${Math.max(16, Math.min(8192, Math.round(exportCustomWidth)))} × ${Math.max(16, Math.min(8192, Math.round(exportCustomHeight)))}` : `${Math.round(canvasWidth * exportScale)} × ${Math.round(canvasHeight * exportScale)}`} px · {exportFormat.toUpperCase()}</small></div></div><div className="export-actions"><button className="quiet-btn" onClick={() => void exportImage(true)}>Bagikan</button><button className="primary-btn export-confirm" onClick={() => void exportImage()}>Unduh gambar</button></div></div></div>}
    </div>
  )
}

export default App
