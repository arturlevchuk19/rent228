export const UNIT_OF_MEASUREMENT = [
  'шт.',
  'м.',
  'комп.',
  'ед.',
  'чел.',
] as const;

export type UnitOfMeasurement = typeof UNIT_OF_MEASUREMENT[number];

export const DEFAULT_UNIT: UnitOfMeasurement = 'шт.';
