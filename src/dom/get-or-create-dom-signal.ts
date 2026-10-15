import { ensureStoreJanitor } from "../shared/store/store-janitor";
import { runStoreCleanup } from "../shared/store/store-cleanup";
import { getRoute } from "../shared/store/signal-store";
import { isBrowser } from "../shared/utils/assert-browser";

import { createDomProxy } from "./dom-proxy";
import { ensureDomPurgeRegistered, getStoredDomSignal, storeDomSignal } from "./dom-store";
import { writeDomElement } from "./core";
import { getBackingSnapshot } from "./wire-backing";
import type { DomSignal, DomSignalOptions } from "./types";

export const getOrCreateDomSignal = (cacheId: string, options?: DomSignalOptions): DomSignal | null => {
  if (!isBrowser()) {
    return null;
  }

  ensureDomPurgeRegistered();
  ensureStoreJanitor();

  const route = getRoute(options?.route);
  const global = options?.global ?? false;

  void runStoreCleanup(route, "route");

  const existing = getStoredDomSignal(cacheId, route, global);

  if (existing) {
    return existing;
  }

  const entry = {
    id: cacheId,
    route,
    global,
    dom: null as unknown as DomSignal,
    created: Date.now(),
    notifyOnWrite: options?.notifyOnWrite ?? false,
    backingSnapshot: getBackingSnapshot(options?.backing),
  };

  const dom = createDomProxy(entry);
  entry.dom = dom;

  storeDomSignal(entry);
  writeDomElement(dom, null);

  return dom;
};
