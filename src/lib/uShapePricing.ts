export type WidthTruss = '290' | '390';

export function calculateLiftingPrice(
  width: number,
  height: number,
  supportCount: number,
  supportLength: number,
  hoist: 'manual' | 'motor',
  widthTruss: WidthTruss
): number {
  const widthRate = widthTruss === '390' ? 7 : 5;
  const hoistPrice = hoist === 'manual' ? 10 : 80;
  const karetka = 15;
  const base = 15;
  const head = 10;
  return width * widthRate + height * 2 * 5
    + supportCount * supportLength * 5
    + (karetka + base + head) * 2 + 2 * hoistPrice;
}
