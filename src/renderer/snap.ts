import type { Canvas, FabricObject } from 'fabric'

export interface SnapGuide {
  x?: number
  y?: number
}

/**
 * Calculates snapping for a moving object against:
 * 1. Canvas bounds and canvas center lines
 * 2. Other objects on canvas (edges and centers)
 * 3. Fallback grid spacing (if enabled)
 */
export function calculateObjectSnap(
  target: FabricObject,
  canvas: Canvas,
  gridEnabled: boolean,
  snapEnabled: boolean,
  gridSpacing: number,
  snapTolerance: number = 8
): { left: number; top: number; guides: SnapGuide[] } {
  let left = target.left || 0
  let top = target.top || 0
  const guides: SnapGuide[] = []

  if (!snapEnabled) {
    return { left, top, guides }
  }

  const canvasWidth = canvas.getWidth()
  const canvasHeight = canvas.getHeight()
  const targetBounds = target.getBoundingRect()
  const targetWidth = targetBounds.width
  const targetHeight = targetBounds.height

  // Candidate alignment lines on X-axis (left, center, right)
  const targetXCenters = [
    { offset: 0, pos: left }, // left
    { offset: targetWidth / 2, pos: left + targetWidth / 2 }, // center
    { offset: targetWidth, pos: left + targetWidth }, // right
  ]

  // Candidate alignment lines on Y-axis (top, center, bottom)
  const targetYCenters = [
    { offset: 0, pos: top }, // top
    { offset: targetHeight / 2, pos: top + targetHeight / 2 }, // center
    { offset: targetHeight, pos: top + targetHeight }, // bottom
  ]

  // Collect reference points from canvas center/edges
  const refX: number[] = [0, canvasWidth / 2, canvasWidth]
  const refY: number[] = [0, canvasHeight / 2, canvasHeight]

  // Collect reference points from other selectable objects
  const otherObjects = canvas.getObjects().filter((obj) => obj !== target && obj.visible !== false)
  for (const obj of otherObjects) {
    const b = obj.getBoundingRect()
    refX.push(b.left, b.left + b.width / 2, b.left + b.width)
    refY.push(b.top, b.top + b.height / 2, b.top + b.height)
  }

  // Find closest X snap
  let minDiffX = snapTolerance
  let snapTargetX: number | null = null
  let snapGuideX: number | null = null

  for (const tc of targetXCenters) {
    for (const rx of refX) {
      const diff = Math.abs(tc.pos - rx)
      if (diff < minDiffX) {
        minDiffX = diff
        snapTargetX = rx - tc.offset
        snapGuideX = rx
      }
    }
  }

  // Find closest Y snap
  let minDiffY = snapTolerance
  let snapTargetY: number | null = null
  let snapGuideY: number | null = null

  for (const tc of targetYCenters) {
    for (const ry of refY) {
      const diff = Math.abs(tc.pos - ry)
      if (diff < minDiffY) {
        minDiffY = diff
        snapTargetY = ry - tc.offset
        snapGuideY = ry
      }
    }
  }

  if (snapTargetX !== null) {
    left = snapTargetX
    if (snapGuideX !== null) guides.push({ x: snapGuideX })
  } else if (gridEnabled && gridSpacing > 0) {
    left = Math.round(left / gridSpacing) * gridSpacing
  }

  if (snapTargetY !== null) {
    top = snapTargetY
    if (snapGuideY !== null) guides.push({ y: snapGuideY })
  } else if (gridEnabled && gridSpacing > 0) {
    top = Math.round(top / gridSpacing) * gridSpacing
  }

  return { left, top, guides }
}
