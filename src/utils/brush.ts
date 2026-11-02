import type { BrushSettings } from '../document'

export function getBrushSettings(settings?: Partial<BrushSettings>): BrushSettings {
  return {
    color: /^#[\da-f]{6}$/i.test(settings?.color || '') ? settings!.color! : '#202b47',
    size: Math.max(1, Math.min(60, Number.isFinite(settings?.size) ? settings!.size! : 8)),
    smooth: Math.max(0, Math.min(8, Number.isFinite(settings?.smooth) ? settings!.smooth! : 0.4)),
    dashed: Boolean(settings?.dashed),
  }
}
