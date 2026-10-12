import { describe, it, expect, vi, afterEach } from "vitest";

import { batch, enqueue } from "../shared/core/batch";
import { restoreAfterWindowStub } from "./setup";

describe("batch", () => {
  afterEach(() => {
    restoreAfterWindowStub();
  });

  it("batch and enqueue are no-ops when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const mod = await import("../shared/core/batch");

    let ran = false;

    mod.batch(() => {
      mod.enqueue(() => {
        ran = true;
      });
    });

    mod.enqueue(() => {
      ran = true;
    });

    expect(ran).toBe(false);
  });

  it("runs enqueued jobs after batch completes", () => {
    let ran = false;

    batch(() => {
      enqueue(() => {
        ran = true;
      });
    });

    expect(ran).toBe(true);
  });

  it("runs enqueued jobs immediately when not inside batch", () => {
    let ran = false;

    enqueue(() => {
      ran = true;
    });

    expect(ran).toBe(true);
  });

  it("defers jobs until outer nested batch ends", () => {
    const order: number[] = [];

    batch(() => {
      enqueue(() => order.push(1));

      batch(() => {
        enqueue(() => order.push(2));
      });

      enqueue(() => order.push(3));
    });

    expect(order).toEqual([1, 2, 3]);
  });
});
