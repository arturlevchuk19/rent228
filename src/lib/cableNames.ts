// Keep the stored key compatible with existing quantities and shipment marks.
export const cableDisplayName = (type: string) => type === 'Кабель 32А 4P' ? 'Кабель 16A 4P (Лебедочный)' : type;

export const cableLengthDisplayName = (type: string, length: string) =>
  type === 'PowerCON 1м - 10м' && length === '3м (8шт)' ? '3м (5шт)' : length;
