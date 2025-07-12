// Branded UserId type
export type UserId = string & { readonly __brand: 'UserId' };

export const UserId = {
  of: (value: string): UserId => value as UserId,
  generate: (): UserId => crypto.randomUUID() as UserId,
  equals: (a: UserId, b: UserId): boolean => a === b,
  toString: (id: UserId): string => id,
};
