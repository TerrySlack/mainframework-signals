import { describe, it, expect, vi, afterEach } from "vitest";

import { assertBrowser, assertWorker, BROWSER_ONLY_ERROR, isBrowser } from "../shared/utils/assert-browser";
import { restoreAfterWindowStub } from "./setup";

describe("assert-browser", () => {
  afterEach(() => {
    restoreAfterWindowStub();
  });

  it("isBrowser is true in jsdom", () => {
    expect(isBrowser()).toBe(true);
  });

  it("isBrowser is false when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const mod = await import("../shared/utils/assert-browser");

    expect(mod.isBrowser()).toBe(false);
  });

  it("isBrowser is false when window is null", async () => {
    vi.stubGlobal("window", null);
    vi.resetModules();

    const mod = await import("../shared/utils/assert-browser");

    expect(mod.isBrowser()).toBe(false);
  });

  it("assertBrowser does not throw in jsdom", () => {
    expect(() => assertBrowser()).not.toThrow();
  });

  it("assertBrowser throws when window is undefined", async () => {
    vi.stubGlobal("window", undefined);

    vi.resetModules();

    const mod = await import("../shared/utils/assert-browser");

    expect(() => mod.assertBrowser()).toThrow(mod.BROWSER_ONLY_ERROR);
  });

  it("assertWorker throws when Worker is undefined", () => {
    vi.stubGlobal("Worker", undefined);

    expect(() => assertWorker()).toThrow("@mainframework/signals requires Web Workers");
  });

  it("exports BROWSER_ONLY_ERROR", () => {
    expect(BROWSER_ONLY_ERROR).toContain("browser-only");
  });
});
