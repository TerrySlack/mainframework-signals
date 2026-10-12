// signal.ts

import {
  ensureStoreJanitor,
  getRoute,
  getStoredSignal,
  globalSignalStore,
  routeSignalStore,
  runStoreCleanup,
  storeSignal,
} from "../store";
import { isBrowser } from "../utils/assert-browser";

import { getOrCreateSyncSignal } from "./get-or-create-sync-signal";
import { stopResourceInterval } from "./resource-timers";
import { resource, type Resource } from "./resource";

export type Signal<T> = {
  (): T;
  set: (value: T | ((previous: T) => T)) => void;
};

export type SignalOptions = {
  global?: boolean;
  route?: string | number;
  refetchInterval?: number;
};

export const isPromiseLike = (value: unknown): value is Promise<unknown> =>
  value !== null &&
  typeof value === "object" &&
  "then" in value &&
  typeof (value as Promise<unknown>).then === "function";

export type AsyncSource<T> = Promise<T> | (() => Promise<T>);

export type SignalInitialValue<T> = T | AsyncSource<T>;

export type CreateSignal = {
  <T>(cacheId: string, initialValue: AsyncSource<T>, options?: SignalOptions): Resource<T> | null;
  <T>(cacheId: string, initialValue: SignalInitialValue<T>, options?: SignalOptions): Signal<T> | null;
};

export const createSignal = (<T>(
  cacheId: string,
  initialValue: SignalInitialValue<T>,
  options?: SignalOptions,
): Signal<T> | Resource<T> | null => {
  if (!isBrowser()) {
    return null;
  }

  ensureStoreJanitor();

  const route = getRoute(options?.route);
  const global = options?.global ?? false;

  void runStoreCleanup(route, "route");

  const existing = getStoredSignal(cacheId, route, global);

  if (existing) {
    return existing as unknown as Signal<T> | Resource<T>;
  }

  if (isPromiseLike(initialValue) || typeof initialValue === "function") {
    const createdSignal = resource(cacheId, initialValue as AsyncSource<T>, options);

    storeSignal({
      id: cacheId,
      route,
      global,
      signal: createdSignal as unknown as Signal<unknown>,
      created: Date.now(),
    });

    return createdSignal;
  }

  return getOrCreateSyncSignal(cacheId, initialValue, options);
}) as CreateSignal;

export const destroySignal = (cacheId: string, options?: SignalOptions) => {
  if (!isBrowser()) {
    return;
  }

  const route = getRoute(options?.route);

  stopResourceInterval(cacheId);

  globalSignalStore.delete(cacheId);

  const routeMap = routeSignalStore.get(route);

  routeMap?.delete(cacheId);

  for (const suffix of [":value", ":loading", ":error"]) {
    const subId = `${cacheId}${suffix}`;

    globalSignalStore.delete(subId);
    routeMap?.delete(subId);
  }
};
