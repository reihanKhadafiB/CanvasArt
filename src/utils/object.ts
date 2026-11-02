import type { FabricObject, FabricText } from 'fabric'

export function getObjectName(object: FabricObject, index: number): string {
  const candidate = object as FabricObject & { name?: string; id?: string }
  return (
    candidate.name ||
    (object.type === 'i-text' || object.type === 'text'
      ? (object as FabricText).text.slice(0, 22) || 'Text'
      : `${object.type || 'Object'} ${index + 1}`)
  )
}
