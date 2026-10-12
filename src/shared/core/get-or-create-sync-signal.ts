import { getRoute, getStoredSignal, storeSignal, type SignalEntry } from "../store";
import { assertBrowser } from "../utils/assert-browser";

import { createSyncSignal } from "./create-signal-node";
import type { Signal } from "./signal";
import type { SignalOptions } from "./signal";

export const getOrCreateSyncSignal = <T>(cacheId: string, initialValue: T, options?: SignalOptions): Signal<T> => {
  assertBrowser();

  const route = getRoute(options?.route);
  const global = options?.global ?? false;

  const existing = getStoredSignal(cacheId, route, global);

  if (existing) {
    return existing as Signal<T>;
  }

  const createdSignal = createSyncSignal(initialValue);

  const entry: SignalEntry<T> = {
    id: cacheId,
    route,
    global,
    signal: createdSignal,
    created: Date.now(),
  };

  storeSignal(entry);

  return createdSignal;
};
