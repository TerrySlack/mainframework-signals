import { registerRoutePurge } from "../shared/store/purge-registry";
import { getRoute } from "../shared/store/signal-store";

import type { DomBacking } from "./types";
import type { DomSignal } from "./types";

export interface DomEntry {
  id: string;
  route: string;
  global: boolean;
  dom: DomSignal;
  created: number;
  notifyOnWrite: boolean;
  backingSnapshot?: DomBacking;
}

export const globalDomStore = new Map<string, DomEntry>();
export const routeDomStore = new Map<string, Map<string, DomEntry>>();

export const getStoredDomSignal = (cacheId: string, route: string, global: boolean): DomSignal | undefined => {
  if (global) {
    const globalEntry = globalDomStore.get(cacheId);

    if (globalEntry) {
      return globalEntry.dom;
    }
  }

  const routeMap = routeDomStore.get(route);
  const existing = routeMap?.get(cacheId);

  return existing?.dom;
};

export const storeDomSignal = (entry: DomEntry): void => {
  if (entry.global) {
    globalDomStore.set(entry.id, entry);
  }

  let route = routeDomStore.get(entry.route);

  if (!route) {
    route = new Map();
    routeDomStore.set(entry.route, route);
  }

  route.set(entry.id, entry);
};

export const deleteDomEntry = (entry: DomEntry): void => {
  if (entry.global) {
    globalDomStore.delete(entry.id);
  }

  routeDomStore.get(entry.route)?.delete(entry.id);
};

export const purgeStaleDomRoutes = (currentRoute: string): void => {
  for (const [routeKey, entries] of routeDomStore.entries()) {
    if (routeKey === currentRoute) {
      continue;
    }

    const snapshot = Array.from(entries.values());

    for (const entry of snapshot) {
      if (!entry.global) {
        entry.dom.dispose();
      }
    }

    for (const [id, entry] of entries.entries()) {
      if (!entry.global) {
        entries.delete(id);
      }
    }

    if (entries.size === 0) {
      routeDomStore.delete(routeKey);
    }
  }
};

export const ensureDomPurgeRegistered = (): void => {
  registerRoutePurge(purgeStaleDomRoutes);
};

export const lookupDomEntry = (
  cacheId: string,
  options?: { route?: string | number; global?: boolean },
): DomEntry | undefined => {
  const route = getRoute(options?.route);
  const global = options?.global ?? false;

  if (global) {
    const globalEntry = globalDomStore.get(cacheId);

    if (globalEntry) {
      return globalEntry;
    }
  }

  return routeDomStore.get(route)?.get(cacheId);
};
