// resource.ts
//
// INTERNAL ONLY - DO NOT EXPORT FROM index.ts
//

import { Signal, signal } from "./signal";
import { Computation, cleanupComputation, setActiveComputation } from "./reactive";

export type ResourceSource<T> = Promise<T> | (() => Promise<T>);

export type Resource<T> = {
  (): T | undefined;
  loading: Signal<boolean>;
  error: Signal<Error | null>;
  reload: () => void;
};

export const resource = <T>(
  cacheId: string,
  source: ResourceSource<T>,
  options?: {
    global?: boolean;
    route?: string | number;
  },
): Resource<T> => {
  const value = signal<T | undefined>(`${cacheId}:value`, undefined, options);

  const loading = signal<boolean>(`${cacheId}:loading`, false, options);

  const error = signal<Error | null>(`${cacheId}:error`, null, options);

  let requestId = 0;

  const computation: Computation = {
    dependencies: new Set(),

    execute() {
      const id = ++requestId;

      cleanupComputation(computation);

      setActiveComputation(computation);

      let promise: Promise<T>;

      try {
        promise = typeof source === "function" ? source() : source;
      } finally {
        setActiveComputation(null);
      }

      loading.set(true);
      error.set(null);

      void promise
        .then((result) => {
          if (id !== requestId) {
            return;
          }

          value.set(result);
        })
        .catch((exception) => {
          if (id !== requestId) {
            return;
          }

          error.set(exception instanceof Error ? exception : new Error(String(exception)));
        })
        .finally(() => {
          if (id === requestId) {
            loading.set(false);
          }
        });
    },
  };

  computation.execute();

  const result = (() => value()) as Resource<T>;

  result.loading = loading;
  result.error = error;
  result.reload = () => computation.execute();

  return result;
};
