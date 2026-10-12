import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { resource } from "../shared/core/resource";
import { resetAllStores } from "./helpers/store-reset";
import { restoreAfterWindowStub } from "./setup";

describe("resource", () => {
  afterEach(() => {
    restoreAfterWindowStub();
  });

  beforeEach(() => {
    resetAllStores();
  });

  it("returns null when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const mod = await import("../shared/core/resource");

    expect(mod.resource("ssr-res", () => Promise.resolve(1))).toBeNull();
  });

  it("loads data on create", async () => {
    const res = resource("res-run-once", () => Promise.resolve("ok"), { route: "r" });

    await vi.waitFor(() => {
      expect(res.loading()).toBe(false);
    });

    expect(res()).toBe("ok");
    expect(res.error()).toBeNull();
  });

  it("sets error for rejected promise", async () => {
    const res = resource("res-error", () => Promise.reject(new Error("nope")), { route: "r" });

    await vi.waitFor(() => {
      expect(res.loading()).toBe(false);
    });

    expect(res.error()?.message).toBe("nope");
  });

  it("wraps non-Error rejections", async () => {
    const res = resource(
      "res-string-error",
      () =>
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- non-Error rejection
        Promise.reject("bad"),
      { route: "r" },
    );

    await vi.waitFor(() => {
      expect(res.loading()).toBe(false);
    });

    expect(res.error()?.message).toBe("bad");
  });

  it("ignores stale responses after reload", async () => {
    let resolveFirst!: (value: string) => void;

    const first = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });

    let call = 0;

    const res = resource(
      "res-stale",
      () => {
        call += 1;

        return call === 1 ? first : Promise.resolve("fresh");
      },
      { route: "r" },
    );

    res.reload();

    resolveFirst("stale");

    await vi.waitFor(() => {
      expect(res.loading()).toBe(false);
    });

    expect(res()).toBe("fresh");
  });

  it("ignores stale rejection after reload", async () => {
    let rejectFirst!: (reason: string) => void;

    const first = new Promise<string>((_, reject) => {
      rejectFirst = reject;
    });

    let call = 0;

    const res = resource(
      "res-stale-reject",
      () => {
        call += 1;

        return call === 1 ? first : Promise.resolve("ok");
      },
      { route: "r" },
    );

    res.reload();

    rejectFirst("stale-error");

    await vi.waitFor(() => {
      expect(res.loading()).toBe(false);
    });

    expect(res()).toBe("ok");
    expect(res.error()).toBeNull();
  });

  it("refetchInterval registers interval fetch", async () => {
    const fetch = vi.fn(() => Promise.resolve("interval-data"));

    const res = resource("res-interval", fetch, { refetchInterval: 500, route: "r-interval" });

    await vi.waitFor(() => {
      expect(res.loading()).toBe(false);
    });

    expect(fetch).toHaveBeenCalled();
    expect(res()).toBe("interval-data");
  });

  it("reload and read are no-ops when window is unavailable after creation", async () => {
    const res = resource("res-ssr-guards", () => Promise.resolve(1), { route: "r" });

    await vi.waitFor(() => {
      expect(res.loading()).toBe(false);
    });

    vi.stubGlobal("window", undefined);

    expect(res()).toBeUndefined();
    expect(() => res.reload()).not.toThrow();
  });

  it("reload fetches again", async () => {
    let count = 0;

    const res = resource(
      "res-reload",
      () => {
        count += 1;

        return Promise.resolve(count);
      },
      { route: "r" },
    );

    await vi.waitFor(() => {
      expect(res.loading()).toBe(false);
    });

    expect(res()).toBe(1);

    res.reload();

    await vi.waitFor(() => {
      expect(res.loading()).toBe(false);
    });

    expect(res()).toBe(2);
    expect(count).toBe(2);
  });
});
