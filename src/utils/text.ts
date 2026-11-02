export function graphemeCount(text: string): number {
  return typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)).length
    : Array.from(text).length
}
