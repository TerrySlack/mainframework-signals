import { isBrowser } from "../utils/assert-browser";

import { Computation, cleanupComputation, setActiveComputation } from "./reactive";

export const effect = (callback: () => void): (() => void) | null => {
  if (!isBrowser()) {
    return null;
  }

  const Computation: Computation = {
    dependencies: new Set(),

    execute() {
      cleanupComputation(Computation);

      setActiveComputation(Computation);

      try {
        callback();
      } finally {
        setActiveComputation(null);
      }
    },
  };

  Computation.execute();

  return () => {
    cleanupComputation(Computation);
  };
};
