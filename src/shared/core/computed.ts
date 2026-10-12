import { isEqual } from "@mainframework/is-deep-equal";
import { SignalNode, cleanupComputation, setActiveComputation, track, notify } from "./reactive";

export type Computed<T> = () => T;

export const computed = <T>(calculation: () => T): Computed<T> => {
  let value: T;

  const computation = {
    dependencies: new Set<SignalNode<any>>(),

    execute() {
      cleanupComputation(computation);

      setActiveComputation(computation);

      try {
        const next = calculation();

        if (!isEqual(value, next)) {
          value = next;
          node.value = next;
          notify(node);
        }
      } finally {
        setActiveComputation(null);
      }
    },
  };

  const node: SignalNode<T> = {
    value: undefined as T,
    computations: new Set(),
    equals: isEqual,
  };

  computation.execute();

  return () => {
    track(node);
    return value;
  };
};
