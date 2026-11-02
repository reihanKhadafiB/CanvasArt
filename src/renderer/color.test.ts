import { describe, expect, it } from 'vitest'
import { darkenHexColor, lightHexColor } from './color'

describe('color.ts - Hex manipulation utilities', () => {
  it('darkens hex colors by percentage', () => {
    expect(darkenHexColor('#ffffff', 0)).toBe('#ffffff')
    expect(darkenHexColor('#ffffff', 100)).toBe('#000000')
    expect(darkenHexColor('#808080', 50)).toBe('#404040')
  })

  it('preserves invalid hex colors safely', () => {
    expect(darkenHexColor('invalid', 20)).toBe('invalid')
    expect(lightHexColor('transparent', 1.2)).toBe('transparent')
  })

  it('illuminates and brightens colors', () => {
    expect(lightHexColor('#000000', 1.0)).toBe('#000000')
    expect(lightHexColor('#102030', 0.5)).toBe('#081018')
    expect(lightHexColor('#808080', 1.5)).toBe('#ffffff')
  })
})
