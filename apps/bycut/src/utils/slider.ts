/** Base UI Slider callbacks receive `number | readonly number[]`; read the single thumb value. */
export function firstSliderValue(value: number | readonly number[]): number {
  return typeof value === 'number' ? value : value[0]
}
