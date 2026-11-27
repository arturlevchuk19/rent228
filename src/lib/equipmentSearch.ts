export function normalizeEquipmentSearch(value: string): string {
  return canonicalEquipmentSubtype(value).toLowerCase().replace(/[aа]/g, 'а');
}

export function canonicalEquipmentType(value: string): string {
  const type = value.trim();
  return /^(силовой распределитель|распределитель питания)$/i.test(type) ? 'Распределитель питания' : type;
}

export function canonicalEquipmentSubtype(value: string): string {
  return value.trim().replace(/([0-9]+)\s*[AaАа](?![\p{L}\p{N}])/gu, '$1А');
}
