import { useEffect, useState, useCallback } from "react";

import { isEqual } from "../utils/equalityCheck";

type Comparator<T> = (prev: T, next: T) => boolean;

export const useCustomSyncExternalStore = <T>(
  subscribe: (callback: () => void) => () => void,
  getSnapshot: () => T,
  customComparator: Comparator<T> = isEqual, //Provide a default comparator
): T => {
  // Use useState to store the snapshot and trigger re-renders
  const [snapshot, setSnapshot] = useState(getSnapshot);

  // Handle store updates and decide whether to update the snapshot
  const handleStoreUpdate = useCallback(() => {
    const newSnapshot = getSnapshot();

    // Use custom comparator or fallback to strict equality
    const shouldUpdate = !customComparator(snapshot, newSnapshot);

    if (shouldUpdate) {
      setSnapshot(newSnapshot); // Update state, triggers re-render
    }
  }, [customComparator, getSnapshot, snapshot]);

  // Subscribe to the store and clean up
  useEffect(() => {
    const unsubscribe = subscribe(handleStoreUpdate);
    handleStoreUpdate(); // Check initially when subscribing

    return () => unsubscribe();
  }, [subscribe, handleStoreUpdate]);

  // Return the current snapshot
  return snapshot;
};
