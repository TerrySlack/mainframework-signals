import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  startResourceInterval,
  stopResourceInterval,
  stopResourceIntervalsForRoute,
} from "../shared/core/resource-timers";
import { emitTimerExpired, fakeTimerWorkers } from "./setup";

describe("resource-timers", () => {
  beforeEach(() => {
    fakeTimerWorkers.length = 0;
    vi.spyOn(crypto, "randomUUID").mockReturnValue("timer-uuid-1");
  });

  it("startResourceInterval calls onInterval immediately", () => {
    const onInterval = vi.fn();

    startResourceInterval("cache-1", "route-1", 500, onInterval);

    expect(onInterval).toHaveBeenCalledTimes(1);
  });

  it("ignores messages with non-expired type", () => {
    const onInterval = vi.fn();

    startResourceInterval("cache-non-expired", "route-1", 500, onInterval);

    const worker = fakeTimerWorkers[fakeTimerWorkers.length - 1];

    worker.emitMessage({ type: "register", id: "timer-uuid-1" });

    expect(onInterval).toHaveBeenCalledTimes(1);
  });

  it("ignores messages with wrong id", () => {
    const onInterval = vi.fn();

    startResourceInterval("cache-2", "route-1", 500, onInterval);

    const worker = fakeTimerWorkers[fakeTimerWorkers.length - 1];

    worker.emitMessage({ type: "expired", id: "wrong-id" });

    expect(onInterval).toHaveBeenCalledTimes(1);
  });

  it("handles expired message and re-registers", () => {
    const onInterval = vi.fn();

    startResourceInterval("cache-3", "route-1", 500, onInterval);

    const worker = fakeTimerWorkers[fakeTimerWorkers.length - 1];

    emitTimerExpired(worker, "timer-uuid-1");

    expect(onInterval).toHaveBeenCalledTimes(2);
  });

  it("stopResourceInterval is safe when not registered", () => {
    expect(() => stopResourceInterval("missing")).not.toThrow();
  });

  it("stopResourceInterval unregisters active timer", () => {
    const onInterval = vi.fn();

    startResourceInterval("cache-4", "route-2", 1000, onInterval);

    stopResourceInterval("cache-4");

    const worker = fakeTimerWorkers[fakeTimerWorkers.length - 1];

    emitTimerExpired(worker, "timer-uuid-1");

    expect(onInterval).toHaveBeenCalledTimes(1);
  });

  it("stopResourceIntervalsForRoute stops matching timers", () => {
    const onInterval = vi.fn();

    startResourceInterval("cache-5", "route-stop", 1000, onInterval);

    stopResourceIntervalsForRoute("route-stop");

    const worker = fakeTimerWorkers[fakeTimerWorkers.length - 1];

    emitTimerExpired(worker, "timer-uuid-1");

    expect(onInterval).toHaveBeenCalledTimes(1);
  });
});
