import { isBrowser } from "../shared/utils/assert-browser";

import { lookupDomEntry } from "./dom-store";
import { getOrCreateDomSignal } from "./get-or-create-dom-signal";
import { peekDomElement } from "./core";
import type { DomSignal, DomSignalOptions } from "./types";

export type { DomBacking, DomProps, DomSignal, DomSignalOptions, UseDomSignalOptions, DomRef } from "./types";

export const domSignal = (
  cacheId: string,
  element: HTMLElement | null,
  options?: DomSignalOptions,
): DomSignal | null => {
  if (!isBrowser()) {
    return null;
  }

  const dom = getOrCreateDomSignal(cacheId, options);

  if (!dom) {
    return null;
  }

  if (!Object.is(peekDomElement(dom), element)) {
    dom.attachElement(element);
  }

  return dom;
};

export const destroyDomSignal = (cacheId: string, options?: Pick<DomSignalOptions, "route" | "global">): void => {
  if (!isBrowser()) {
    return;
  }

  const entry = lookupDomEntry(cacheId, options);

  if (entry) {
    entry.dom.dispose();
  }
};
