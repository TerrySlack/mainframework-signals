import { describe, it, expect, beforeEach } from "vitest";

import { getOrCreateSyncSignal } from "../shared/core/get-or-create-sync-signal";
import { resetAllStores } from "./helpers/store-reset";

describe("getOrCreateSyncSignal", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("returns the same signal for the same cache key", () => {
    const first = getOrCreateSyncSignal("sync-key", 1, { route: "r1" });
    const second = getOrCreateSyncSignal("sync-key", 99, { route: "r1" });

    expect(first).toBe(second);
    expect(first()).toBe(1);
  });
});
