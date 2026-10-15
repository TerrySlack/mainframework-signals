const routePurges = new Set<(currentRoute: string) => void>();

export const registerRoutePurge = (purge: (currentRoute: string) => void): void => {
  routePurges.add(purge);
};

export const runRegisteredPurges = (currentRoute: string): void => {
  for (const purge of routePurges) {
    purge(currentRoute);
  }
};

export const resetPurgeRegistry = (): void => {
  routePurges.clear();
};
