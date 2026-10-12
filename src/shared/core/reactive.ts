export interface Computation {
  execute(): void;
  dependencies: Set<SignalNode<any>>;
}

export interface SignalNode<T> {
  value: T;
  computations: Set<Computation>;
  equals: (a: T, b: T) => boolean;
}

let activeComputation: Computation | null = null;

export const getActiveComputation = () => activeComputation;

export const setActiveComputation = (Computation: Computation | null) => {
  activeComputation = Computation;
};

export const track = <T>(node: SignalNode<T>) => {
  if (!activeComputation) {
    return;
  }

  node.computations.add(activeComputation);
  activeComputation.dependencies.add(node);
};

export const cleanupComputation = (Computation: Computation) => {
  Computation.dependencies.forEach((dependency) => {
    dependency.computations.delete(Computation);
  });

  Computation.dependencies.clear();
};

export const notify = (node: SignalNode<any>) => {
  const Computations = Array.from(node.computations);

  Computations.forEach((Computation) => {
    queueComputation(Computation);
  });
};

const pendingComputations = new Set<Computation>();

let flushing = false;

export const queueComputation = (Computation: Computation) => {
  pendingComputations.add(Computation);

  if (!flushing) {
    flushing = true;

    queueMicrotask(() => {
      pendingComputations.forEach((Computation) => Computation.execute());

      pendingComputations.clear();

      flushing = false;
    });
  }
};
