import type { TextStyleAsset } from '../document'

export type Tab = 'Presets' | 'Text' | 'Object' | 'Background' | 'Effects'

export interface BezierPoint {
  x: number
  y: number
  handleIn?: { x: number; y: number }
  handleOut?: { x: number; y: number }
}

export interface PerspectiveCorner {
  x: number
  y: number
}

export interface BezierEditDrag {
  index: number
  handle: 'anchor' | 'in' | 'out'
}

export type SavedTextStyle = TextStyleAsset
