export const BROWSER_ONLY_ERROR = "@mainframework/signals is browser-only and cannot run during SSR or on the server";

export const isBrowser = (): boolean => typeof window !== "undefined" && window != null;

export const assertBrowser = (): void => {
  if (!isBrowser()) {
    throw new Error(BROWSER_ONLY_ERROR);
  }
};

export const assertWorker = (): void => {
  assertBrowser();

  if (typeof Worker === "undefined") {
    throw new Error("@mainframework/signals requires Web Workers and cannot run in this browser environment");
  }
};
