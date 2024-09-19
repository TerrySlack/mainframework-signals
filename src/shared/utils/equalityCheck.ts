export const isEqual = (a: unknown, b: unknown): boolean => {
  if (typeof a !== typeof b) {
    return false; // Types are different
  }

  if (typeof a !== "object" || a === null) {
    return a === b; // For non-object types, perform simple comparison
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false; // Arrays have different lengths
    }
    let i = 0;
    while (i < a.length) {
      if (!isEqual(a[i], b[i])) {
        return false; // Array elements are different
      }
      i += 1;
    }

    return true; // All array elements are equal
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return false; // One is an array and the other is not, they can't be equal
  }

  const objA = a as Record<string | number, unknown>;
  const objB = b as Record<string | number, unknown>;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false; // Objects have different number of keys
  }

  let j = 0;
  while (j < keysA.length) {
    const key = keysA[j];
    if (!keysB.includes(key) || !isEqual(objA[key], objB[key])) {
      return false; // Keys are different or their values are not equal
    }
    j += 1;
  }

  return true; // All keys and their values are equal
};
