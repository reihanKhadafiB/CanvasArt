import {
  Circle,
  Ellipse,
  FabricImage,
  FabricObject,
  FabricText,
  Polygon,
  Rect,
  Triangle,
  Path as FabricPath,
} from 'fabric'
import type { Canvas } from 'fabric'
import { darkenHexColor, lightHexColor } from './color'

export interface BackgroundStyledText {
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

export type WordSpacedText = FabricText & { canvasArtWordSpacing?: number }
export type GraphemeBoxLike = { width: number; kernedWidth: number; [key: string]: unknown }

export type ExtrudedText = FabricText & {
  canvasArt3DDepth?: number
  canvasArt3DAngle?: number
  canvasArt3DColor?: string
  canvasArt3DMode?: 'oblique' | 'perspective'
  canvasArt3DDarken?: number
  canvasArt3DLightEnabled?: boolean
  canvasArt3DLightAngle?: number
  canvasArt3DLightIntensity?: number
  canvasArt3DAmbientLight?: number
  canvasArt3DRotateX?: number
  canvasArt3DRotateY?: number
  canvasArt3DBaseScaleX?: number
  canvasArt3DBaseScaleY?: number
  canvasArtInnerShadowEnabled?: boolean
  canvasArtInnerShadowColor?: string
  canvasArtInnerShadowBlur?: number
  canvasArtInnerShadowOffsetX?: number
  canvasArtInnerShadowOffsetY?: number
  canvasArtInnerShadowOpacity?: number
  canvasArtReflectionEnabled?: boolean
  canvasArtReflectionGap?: number
  canvasArtReflectionLength?: number
  canvasArtReflectionOpacity?: number
  canvasArt3DShadowEnabled?: boolean
  canvasArt3DShadowColor?: string
  canvasArt3DShadowAngle?: number
  canvasArt3DShadowLength?: number
  canvasArt3DShadowGap?: number
  canvasArt3DShadowBlur?: number
  canvasArt3DShadowOpacity?: number
  canvasArtEmbossEnabled?: boolean
  canvasArtEmbossAngle?: number
  canvasArtEmbossIntensity?: number
  canvasArtEmbossAmbient?: number
  canvasArtEmbossHardness?: number
  canvasArtEmbossBevel?: number
  textBackgroundColor?: string
}

export type StyledCanvasObject = FabricObject & {
  canvasArtInnerShadowEnabled?: boolean
  canvasArtInnerShadowColor?: string
  canvasArtInnerShadowBlur?: number
  canvasArtInnerShadowOffsetX?: number
  canvasArtInnerShadowOffsetY?: number
  canvasArtInnerShadowOpacity?: number
  canvasArtEmbossEnabled?: boolean
  canvasArtEmbossAngle?: number
  canvasArtEmbossIntensity?: number
  canvasArtEmbossAmbient?: number
  canvasArtEmbossHardness?: number
  canvasArtEmbossBevel?: number
}

export interface LocalMask {
  canvas: HTMLCanvasElement
  width: number
  height: number
  margin: number
}

const textPrototype = FabricText.prototype as unknown as Record<string, unknown>
const nativeGetGraphemeBox = textPrototype._getGraphemeBox as (
  this: FabricText,
  grapheme: string,
  lineIndex: number,
  charIndex: number,
  previous?: string,
  skipLeft?: boolean,
) => GraphemeBoxLike

textPrototype._getGraphemeBox = function (
  this: FabricText,
  grapheme: string,
  lineIndex: number,
  charIndex: number,
  previous?: string,
  skipLeft?: boolean,
) {
  const box = nativeGetGraphemeBox.call(this, grapheme, lineIndex, charIndex, previous, skipLeft)
  const spacing = grapheme === ' ' ? Math.max(-100, Math.min(500, (this as WordSpacedText).canvasArtWordSpacing || 0)) : 0
  return spacing ? { ...box, width: box.width + spacing, kernedWidth: box.kernedWidth + spacing } : box
}

const renderNativeTextBackground = textPrototype._renderTextLinesBackground as (
  this: FabricText,
  ctx: CanvasRenderingContext2D,
) => void

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
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, width, height, corner)
    } else {
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
  try {
    renderNativeTextBackground.call(this, ctx)
  } finally {
    text.textBackgroundColor = fill
  }
  ctx.fillStyle = originalFill
}

export const renderNativeText = textPrototype._render as (this: FabricText, ctx: CanvasRenderingContext2D) => void

export function renderInnerTextShadow(text: FabricText, ctx: CanvasRenderingContext2D): void {
  const styled = text as ExtrudedText
  if (!styled.canvasArtInnerShadowEnabled) return
  const blur = Math.max(0, Math.min(48, styled.canvasArtInnerShadowBlur || 0))
  const offsetX = Math.max(-80, Math.min(80, styled.canvasArtInnerShadowOffsetX || 0))
  const offsetY = Math.max(-80, Math.min(80, styled.canvasArtInnerShadowOffsetY || 0))
  const margin = Math.ceil(blur * 2 + Math.max(Math.abs(offsetX), Math.abs(offsetY)) + 4)
  const width = Math.max(1, Math.ceil(text.width || text.getScaledWidth()))
  const height = Math.max(1, Math.ceil(text.height || text.getScaledHeight()))
  const mask = document.createElement('canvas')
  mask.width = width + margin * 2
  mask.height = height + margin * 2
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
  shifted.width = mask.width
  shifted.height = mask.height
  const shiftedContext = shifted.getContext('2d')
  if (!shiftedContext) return
  shiftedContext.filter = blur ? `blur(${blur}px)` : 'none'
  shiftedContext.drawImage(mask, offsetX, offsetY)
  shiftedContext.filter = 'none'
  const inner = document.createElement('canvas')
  inner.width = mask.width
  inner.height = mask.height
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

export function renderTextEmboss(text: FabricText, ctx: CanvasRenderingContext2D): void {
  const styled = text as ExtrudedText
  if (!styled.canvasArtEmbossEnabled) return
  const angle = ((styled.canvasArtEmbossAngle || 45) * Math.PI) / 180
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
    ctx.save()
    ctx.translate(-Math.cos(angle) * distance, -Math.sin(angle) * distance)
    renderNativeText.call(text, ctx)
    ctx.restore()
    ctx.globalAlpha *= Math.max(0.25, intensity)
    text.set({ stroke: '#111827' } as never)
    ctx.save()
    ctx.translate(Math.cos(angle) * distance, Math.sin(angle) * distance)
    renderNativeText.call(text, ctx)
    ctx.restore()
  } finally {
    text.set({ fill: original.fill, stroke: original.stroke, strokeWidth: original.strokeWidth, shadow: original.shadow } as never)
    ctx.restore()
  }
}

export function renderText3DShadow(text: FabricText, ctx: CanvasRenderingContext2D): void {
  const styled = text as ExtrudedText
  if (!styled.canvasArt3DShadowEnabled) return
  const gap = Math.max(0, Math.min(160, styled.canvasArt3DShadowGap || 0))
  const length = Math.max(0.05, Math.min(0.8, styled.canvasArt3DShadowLength ?? 0.2))
  const angle = ((styled.canvasArt3DShadowAngle || 0) * Math.PI) / 180
  const blur = Math.max(0, Math.min(60, styled.canvasArt3DShadowBlur || 0))
  const opacity = Math.max(0, Math.min(1, styled.canvasArt3DShadowOpacity ?? 0.45))
  const height = Math.max(1, text.height || text.getScaledHeight())
  const original = { fill: text.fill, stroke: text.stroke, strokeWidth: text.strokeWidth, shadow: text.shadow, background: styled.textBackgroundColor }
  ctx.save()
  try {
    ctx.globalAlpha *= opacity
    ctx.filter = blur ? `blur(${blur}px)` : 'none'
    ctx.translate(0, height / 2 + gap + (height * length) / 2)
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

export function renderTextReflection(text: FabricText, ctx: CanvasRenderingContext2D): void {
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
  if (!depth) {
    renderText3DShadow(this, ctx)
    renderTextReflection(this, ctx)
    renderNativeText.call(this, ctx)
    renderTextEmboss(this, ctx)
    renderInnerTextShadow(this, ctx)
    return
  }
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
        const lightAngle = ((text.canvasArt3DLightAngle ?? 315) * Math.PI) / 180
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

export function createObjectAlphaMask(
  object: FabricObject,
  nativeRender: (this: FabricObject, ctx: CanvasRenderingContext2D) => void,
  blur: number,
  offsetX: number,
  offsetY: number,
  bevel = 0,
): LocalMask | null {
  const scaleX = Math.max(0.01, object.scaleX || 1)
  const scaleY = Math.max(0.01, object.scaleY || 1)
  const width = Math.max(1, Math.ceil(object.width || object.getScaledWidth() / scaleX))
  const height = Math.max(1, Math.ceil(object.height || object.getScaledHeight() / scaleY))
  const margin = Math.ceil(blur * 2 + Math.max(Math.abs(offsetX), Math.abs(offsetY)) + bevel + 4)
  const mask = document.createElement('canvas')
  mask.width = width + margin * 2
  mask.height = height + margin * 2
  const maskContext = mask.getContext('2d')
  if (!maskContext) return null
  const original = { opacity: object.opacity, shadow: object.shadow }
  try {
    object.set({ opacity: 1, shadow: null } as never)
    maskContext.translate(margin + width / 2, margin + height / 2)
    nativeRender.call(object, maskContext)
  } finally {
    object.set({ opacity: original.opacity, shadow: original.shadow } as never)
  }
  maskContext.globalCompositeOperation = 'source-in'
  maskContext.fillStyle = '#fff'
  maskContext.fillRect(0, 0, mask.width, mask.height)
  return { canvas: mask, width, height, margin }
}

export function drawObjectInnerEdge(
  ctx: CanvasRenderingContext2D,
  mask: LocalMask,
  color: string,
  blur: number,
  offsetX: number,
  offsetY: number,
  opacity: number,
): void {
  const shifted = document.createElement('canvas')
  shifted.width = mask.canvas.width
  shifted.height = mask.canvas.height
  const shiftedContext = shifted.getContext('2d')
  if (!shiftedContext) return
  shiftedContext.filter = blur ? `blur(${blur}px)` : 'none'
  shiftedContext.drawImage(mask.canvas, offsetX, offsetY)
  shiftedContext.filter = 'none'
  const inner = document.createElement('canvas')
  inner.width = mask.canvas.width
  inner.height = mask.canvas.height
  const innerContext = inner.getContext('2d')
  if (!innerContext) return
  innerContext.fillStyle = color
  innerContext.fillRect(0, 0, inner.width, inner.height)
  innerContext.globalCompositeOperation = 'destination-out'
  innerContext.drawImage(shifted, 0, 0)
  innerContext.globalCompositeOperation = 'destination-in'
  innerContext.drawImage(mask.canvas, 0, 0)
  ctx.save()
  ctx.globalAlpha *= Math.max(0, Math.min(1, opacity))
  ctx.drawImage(inner, -mask.width / 2 - mask.margin, -mask.height / 2 - mask.margin)
  ctx.restore()
}

export function renderStyledObject(
  object: FabricObject,
  ctx: CanvasRenderingContext2D,
  nativeRender: (this: FabricObject, ctx: CanvasRenderingContext2D) => void,
): void {
  const styled = object as StyledCanvasObject
  if (!styled.canvasArtInnerShadowEnabled && !styled.canvasArtEmbossEnabled) {
    nativeRender.call(object, ctx)
    return
  }
  const innerBlur = Math.max(0, Math.min(48, styled.canvasArtInnerShadowBlur || 0))
  const innerX = Math.max(-80, Math.min(80, styled.canvasArtInnerShadowOffsetX || 0))
  const innerY = Math.max(-80, Math.min(80, styled.canvasArtInnerShadowOffsetY || 0))
  const bevel = Math.max(1, Math.min(24, styled.canvasArtEmbossBevel || 3))
  const embossBlur = ((1 - Math.max(0, Math.min(1, styled.canvasArtEmbossHardness ?? 0.7))) * bevel) / 5
  const mask = createObjectAlphaMask(
    object,
    nativeRender,
    Math.max(innerBlur, embossBlur),
    Math.max(Math.abs(innerX), bevel),
    Math.max(Math.abs(innerY), bevel),
    bevel,
  )
  nativeRender.call(object, ctx)
  if (!mask) return
  if (styled.canvasArtInnerShadowEnabled) {
    drawObjectInnerEdge(
      ctx,
      mask,
      styled.canvasArtInnerShadowColor || '#202b47',
      innerBlur,
      innerX,
      innerY,
      styled.canvasArtInnerShadowOpacity ?? 0.7,
    )
  }
  if (styled.canvasArtEmbossEnabled) {
    const angle = ((styled.canvasArtEmbossAngle ?? 45) * Math.PI) / 180
    const intensity = Math.max(0, Math.min(1, styled.canvasArtEmbossIntensity ?? 0.65))
    const ambient = Math.max(0, Math.min(1, styled.canvasArtEmbossAmbient ?? 0.2))
    const distance = bevel * 0.55
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance
    drawObjectInnerEdge(ctx, mask, '#ffffff', embossBlur, -dx, -dy, intensity * (1 - ambient * 0.35))
    drawObjectInnerEdge(ctx, mask, '#111827', embossBlur, dx, dy, intensity * (0.45 + ambient * 0.35))
  }
}

export function installStyledObjectRenderers(): void {
  const prototypes = [
    FabricImage.prototype,
    Rect.prototype,
    Circle.prototype,
    Ellipse.prototype,
    Triangle.prototype,
    Polygon.prototype,
    FabricPath.prototype,
  ]
  for (const prototype of prototypes) {
    const record = prototype as unknown as Record<string, unknown>
    if (!Object.prototype.hasOwnProperty.call(record, '_render')) continue
    const nativeRender = record._render as (this: FabricObject, ctx: CanvasRenderingContext2D) => void
    record._render = function (this: FabricObject, ctx: CanvasRenderingContext2D) {
      renderStyledObject(this, ctx, nativeRender)
    }
  }
}
installStyledObjectRenderers()


export async function syncPathMaskDependents(canvas: Canvas, source: FabricPath & { canvasArtId?: string }): Promise<void> {
  if (!source.canvasArtId) return
  const dependents = canvas
    .getObjects()
    .filter(
      (object) =>
        (object as FabricObject & { canvasArtMaskSourceId?: string }).canvasArtMaskSourceId === source.canvasArtId,
    )
  for (const target of dependents) {
    const mode = (target as FabricObject & { canvasArtMaskMode?: 'in' | 'out' }).canvasArtMaskMode || 'in'
    const clipPath = await source.clone()
    clipPath.set({
      absolutePositioned: true,
      inverted: mode === 'out',
      visible: true,
      selectable: false,
      evented: false,
    } as never)
    target.set({ clipPath, dirty: true } as never)
    target.setCoords()
  }
  if (dependents.length) canvas.requestRenderAll()
}
