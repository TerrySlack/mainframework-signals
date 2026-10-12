import { stopResourceIntervalsForRoute } from "../core/resource-timers";
import type { Resource } from "../core/resource";
import type { Signal } from "../core/signal";

import { assertBrowser } from "../utils/assert-browser";

export type StoredSignal<T> = Signal<T> | Resource<T>;

export interface SignalEntry<T> {
  id: string;

  route: string;

  global: boolean;

  signal: StoredSignal<T>;

  created: number;
}

export const globalSignalStore = new Map<string, SignalEntry<unknown>>();

export const routeSignalStore = new Map<string, Map<string, SignalEntry<unknown>>>();

/** @deprecated Use routeSignalStore */
export const signalStore = routeSignalStore;

export const getCurrentRoute = (): string => {
  assertBrowser();

  return window.location.pathname + window.location.search;
};

export const getRoute = (route?: string | number): string => {
  if (route !== undefined) {
    return String(route);
  }

  return getCurrentRoute();
};

export const purgeStaleRoutes = (currentRoute: string): void => {
  for (const [routeKey, entries] of routeSignalStore.entries()) {
    if (routeKey === currentRoute) {
      continue;
    }

    for (const [id, entry] of entries.entries()) {
      if (!entry.global) {
        entries.delete(id);
      }
    }

    if (entries.size === 0) {
      routeSignalStore.delete(routeKey);
    }

    stopResourceIntervalsForRoute(routeKey);
  }
};

export const getStoredSignal = <T>(cacheId: string, route: string, global: boolean): StoredSignal<T> | undefined => {
  if (global) {
    const globalEntry = globalSignalStore.get(cacheId);

    if (globalEntry) {
      return globalEntry.signal as StoredSignal<T>;
    }
  }

  const routeMap = routeSignalStore.get(route);
  const existing = routeMap?.get(cacheId);

  return existing?.signal as StoredSignal<T> | undefined;
};

export const storeSignal = <T>(entry: SignalEntry<T>) => {
  if (entry.global) {
    globalSignalStore.set(entry.id, entry as SignalEntry<unknown>);
  }

  let route = routeSignalStore.get(entry.route);

  if (!route) {
    route = new Map();

    routeSignalStore.set(entry.route, route);
  }

  route.set(entry.id, entry as SignalEntry<unknown>);
};
