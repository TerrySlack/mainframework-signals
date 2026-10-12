// resource.ts — public API via src/index.ts
//

import { getRoute } from "../store";
import { isBrowser } from "../utils/assert-browser";

import { getOrCreateSyncSignal } from "./get-or-create-sync-signal";
import { startResourceInterval } from "./resource-timers";
import { batch } from "./batch";
import { Computation, cleanupComputation, setActiveComputation } from "./reactive";
import type { AsyncSource, Signal } from "./signal";
import type { SignalOptions } from "./signal";

export type ResourceSource<T> = AsyncSource<T>;

export type Resource<T> = {
  (): T | undefined;
  loading: Signal<boolean>;
  error: Signal<Error | null>;
  reload: () => void;
};

export const resource = <T>(
  cacheId: string,
  source: ResourceSource<T>,
  options?: SignalOptions,
): Resource<T> | null => {
  if (!isBrowser()) {
    return null;
  }

  const value = getOrCreateSyncSignal<T | undefined>(`${cacheId}:value`, undefined, options);

  const loading = getOrCreateSyncSignal<boolean>(`${cacheId}:loading`, false, options);

  const error = getOrCreateSyncSignal<Error | null>(`${cacheId}:error`, null, options);

  let requestId = 0;

  const computation: Computation = {
    dependencies: new Set(),
    execute() {},
  };

  const executeFetch = () => {
    const id = ++requestId;

    cleanupComputation(computation);

    setActiveComputation(computation);

    let promise: Promise<T>;

    try {
      promise = typeof source === "function" ? source() : source;
    } finally {
      setActiveComputation(null);
    }

    batch(() => {
      loading.set(true);
      error.set(null);
    });

    void promise
      .then((result) => {
        if (id !== requestId) {
          return;
        }

        batch(() => {
          value.set(result);
        });
      })
      .catch((exception) => {
        if (id !== requestId) {
          return;
        }

        batch(() => {
          error.set(exception instanceof Error ? exception : new Error(String(exception)));
        });
      })
      .finally(() => {
        if (id === requestId) {
          batch(() => {
            loading.set(false);
          });
        }
      });
  };

  const routeKey = getRoute(options?.route);

  if (options?.refetchInterval !== undefined) {
    startResourceInterval(cacheId, routeKey, options.refetchInterval, executeFetch);
  } else {
    executeFetch();
  }

  const result = (() => {
    if (!isBrowser()) {
      return undefined;
    }

    return value();
  }) as Resource<T>;

  result.loading = loading;
  result.error = error;
  result.reload = () => {
    if (!isBrowser()) {
      return;
    }

    executeFetch();
  };

  return result;
};
