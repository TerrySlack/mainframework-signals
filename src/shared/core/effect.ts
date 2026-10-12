import { Computation, cleanupComputation, setActiveComputation } from "./reactive";

export const effect = (callback: () => void) => {
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
