import type { FontAsset } from '../document'

export async function installFontAssets(fonts: FontAsset[]): Promise<FontAsset[]> {
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
