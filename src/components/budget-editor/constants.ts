export const NO_LOCATION_GROUP_ID = 'no-location';
export const UNCATEGORIZED_IN_LOCATION_KEY = 'uncategorized';
export const EXTRA_SERVICE_DESCRIPTION_FLAG = '__extra_service__';

export const buildCategoryGroupId = (categoryId: string, locationId?: string | null) =>
  locationId ? `location:${locationId}::category:${categoryId}` : `category:${categoryId}`;

export const buildLocationUncategorizedGroupId = (locationId: string) =>
  `location:${locationId}::${UNCATEGORIZED_IN_LOCATION_KEY}`;

export const parseGroupId = (groupId: string): { locationId: string | null; categoryId: string | null } => {
  if (groupId.startsWith('location:')) {
    const [, rest] = groupId.split('location:');
    const [locationId, tail] = rest.split('::');
    if (!tail || tail === UNCATEGORIZED_IN_LOCATION_KEY) {
      return { locationId, categoryId: null };
    }
    if (tail.startsWith('category:')) {
      return { locationId, categoryId: tail.replace('category:', '') };
    }
  }

  if (groupId.startsWith('category:')) {
    return { locationId: null, categoryId: groupId.replace('category:', '') };
  }

  return { locationId: null, categoryId: null };
};
