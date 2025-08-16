import { useEffect, useRef, useState, useCallback } from "react";

import { isEqual } from "@mainframework/is-deep-equal";
type Comparator<T> = (prev: T, next: T) => boolean;

const trigger = (v: number) => (v === 9 ? 0 : v + 1);

export const useCustomSyncExternalStore = <T>(
  subscribe: (callback: () => void) => () => void,
  getSnapshot: () => T,
  customComparator: Comparator<T | undefined> = isEqual,
): T => {
  const snapshotRef = useRef<T | undefined>(undefined);

  if (snapshotRef.current === undefined) {
    snapshotRef.current = getSnapshot();
  }

  const [, setTrigger] = useState(0);

  const handleStoreUpdate = useCallback(() => {
    const newSnapshot = getSnapshot();
    if (!customComparator(snapshotRef.current, newSnapshot)) {
      snapshotRef.current = newSnapshot;
      setTrigger(trigger); // trigger re-render
    }
  }, [customComparator, getSnapshot]);

  useEffect(() => {
    const unsubscribe = subscribe(handleStoreUpdate);
    handleStoreUpdate(); // initial check

    return () => unsubscribe();
  }, [subscribe, handleStoreUpdate]);

  return snapshotRef.current;
};
