import { describe, it, expect, vi } from "vitest";

import {
  cleanupComputation,
  getActiveComputation,
  notify,
  queueComputation,
  setActiveComputation,
  track,
  type Computation,
  type SignalNode,
} from "../shared/core/reactive";

describe("reactive", () => {
  it("track does nothing without active computation", () => {
    const node: SignalNode<number> = {
      value: 0,
      computations: new Set(),
      equals: (a, b) => a === b,
    };

    setActiveComputation(null);
    track(node);

    expect(node.computations.size).toBe(0);
  });

  it("track links active computation and node", () => {
    const node: SignalNode<number> = {
      value: 0,
      computations: new Set(),
      equals: (a, b) => a === b,
    };

    const computation: Computation = {
      dependencies: new Set(),
      execute: () => {},
    };

    setActiveComputation(computation);
    track(node);

    expect(node.computations.has(computation)).toBe(true);
    expect(computation.dependencies.has(node)).toBe(true);

    setActiveComputation(null);
  });

  it("cleanupComputation removes links", () => {
    const node: SignalNode<number> = {
      value: 0,
      computations: new Set(),
      equals: (a, b) => a === b,
    };

    const computation: Computation = {
      dependencies: new Set(),
      execute: () => {},
    };

    node.computations.add(computation);
    computation.dependencies.add(node);

    cleanupComputation(computation);

    expect(node.computations.size).toBe(0);
    expect(computation.dependencies.size).toBe(0);
  });

  it("notify schedules computation execute on microtask", async () => {
    const node: SignalNode<number> = {
      value: 0,
      computations: new Set(),
      equals: (a, b) => a === b,
    };

    const execute = vi.fn();

    const computation: Computation = {
      dependencies: new Set(),
      execute,
    };

    node.computations.add(computation);

    notify(node);

    expect(execute).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });

  it("queueComputation runs through enqueue", async () => {
    const execute = vi.fn();

    const computation: Computation = {
      dependencies: new Set(),
      execute,
    };

    queueComputation(computation);

    await vi.waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });

  it("getActiveComputation returns current computation", () => {
    const computation: Computation = {
      dependencies: new Set(),
      execute: () => {},
    };

    setActiveComputation(computation);
    expect(getActiveComputation()).toBe(computation);
    setActiveComputation(null);
  });
});
