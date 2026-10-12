import { purgeStaleRoutes } from "./signal-store";

let cleanupPromise: Promise<void> | null = null;
let generation = 0;
let lastRoute: string | null = null;

export const runStoreCleanup = (currentRoute: string, reason: "route" | "janitor"): Promise<void> => {
  if (reason === "route") {
    if (lastRoute !== null && lastRoute !== currentRoute) {
      generation++;
    }

    lastRoute = currentRoute;
    purgeStaleRoutes(currentRoute);

    return Promise.resolve();
  }

  if (cleanupPromise !== null) {
    return cleanupPromise;
  }

  const capturedGen = generation;

  cleanupPromise = Promise.resolve()
    .then(() => {
      if (capturedGen !== generation) {
        return;
      }

      purgeStaleRoutes(currentRoute);
    })
    .finally(() => {
      cleanupPromise = null;
    });

  return cleanupPromise;
};
