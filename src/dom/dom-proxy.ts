import { isEqual } from "@mainframework/is-deep-equal";

import { applyDomProp, DOM_PROP_ALLOWLIST } from "./apply-dom-props";
import { clearReactBumps, markDomDirty, peekDomElement, readDomElement, writeDomElement } from "./core";
import { deleteDomEntry, type DomEntry } from "./dom-store";
import { startWireBacking, stopWireBacking } from "./wire-backing";
import type { DomProps } from "./types";
import type { DomSignal } from "./types";

const OWN_KEYS = new Set(["cacheId", "route", "global", "element", "attachElement", "detach", "dispose"]);

const attachElementImpl = (receiver: DomSignal, entry: DomEntry, el: HTMLElement | null): void => {
  if (Object.is(peekDomElement(receiver), el)) {
    return;
  }

  stopWireBacking(receiver);
  writeDomElement(receiver, el);

  if (el !== null && entry.backingSnapshot) {
    startWireBacking(receiver, el, entry.backingSnapshot);
  }
};

const detachImpl = (receiver: DomSignal): void => {
  stopWireBacking(receiver);
  writeDomElement(receiver, null);
};

const disposeImpl = (receiver: DomSignal, entry: DomEntry): void => {
  stopWireBacking(receiver);
  writeDomElement(receiver, null);
  deleteDomEntry(entry);
  clearReactBumps(receiver);
};

export const createDomProxy = (entry: DomEntry): DomSignal => {
  const target = {
    cacheId: entry.id,
    route: entry.route,
    global: entry.global,
    attachElement: (el: HTMLElement | null) => {
      attachElementImpl(receiver, entry, el);
    },
    detach: () => {
      detachImpl(receiver);
    },
    dispose: () => {
      if (!lookupDisposed(entry)) {
        disposeImpl(receiver, entry);
        markDisposed(entry);
      }
    },
  };

  const receiver = new Proxy(target, {
    get(targetObject, key, proxy) {
      if (key === "element") {
        return readDomElement(proxy as DomSignal);
      }

      if (typeof key === "string" && OWN_KEYS.has(key)) {
        return Reflect.get(targetObject, key, proxy) as DomSignal[keyof DomSignal];
      }

      if (typeof key === "string" && key.startsWith("attr:")) {
        const element = peekDomElement(proxy as DomSignal);

        if (element === null) {
          return undefined;
        }

        const attrName = key.slice("attr:".length);

        if (attrName.length === 0) {
          return undefined;
        }

        return element.getAttribute(attrName);
      }

      if (typeof key === "string" && DOM_PROP_ALLOWLIST.has(key)) {
        const element = peekDomElement(proxy as DomSignal);

        if (element === null || !(key in element)) {
          return undefined;
        }

        return (element as unknown as Record<string, unknown>)[key];
      }

      if (typeof key === "string") {
        const element = peekDomElement(proxy as DomSignal);

        if (element !== null && key in element) {
          const value = (element as unknown as Record<string, unknown>)[key];

          if (typeof value === "function") {
            return (value as (...args: unknown[]) => unknown).bind(element);
          }

          return value;
        }

        return undefined;
      }

      return Reflect.get(targetObject, key, proxy) as unknown;
    },
    set(_targetObject, key, value, proxy) {
      if (typeof key === "string" && (key === "cacheId" || key === "route" || key === "global" || key === "element")) {
        return true;
      }

      const element = peekDomElement(proxy as DomSignal);

      if (typeof key === "string" && DOM_PROP_ALLOWLIST.has(key)) {
        if (element === null || !(key in element)) {
          return true;
        }

        const before = (element as unknown as Record<string, unknown>)[key];
        applyDomProp(element, key as keyof DomProps, value as DomProps[keyof DomProps]);
        const after = (element as unknown as Record<string, unknown>)[key];

        if (entry.notifyOnWrite && !isEqual(before, after)) {
          markDomDirty(proxy as DomSignal);
        }

        return true;
      }

      if (typeof key === "string" && key.startsWith("attr:")) {
        if (element === null) {
          return true;
        }

        const attrName = key.slice("attr:".length);

        if (attrName.length === 0) {
          return true;
        }

        const before = element.getAttribute(attrName);

        if (value === null || value === undefined) {
          element.removeAttribute(attrName);
        } else {
          element.setAttribute(attrName, String(value));
        }

        const after = element.getAttribute(attrName);

        if (entry.notifyOnWrite && before !== after) {
          markDomDirty(proxy as DomSignal);
        }

        return true;
      }

      if (typeof key === "string" && element !== null && key in element) {
        const before = (element as unknown as Record<string, unknown>)[key];
        (element as unknown as Record<string, unknown>)[key] = value;
        const after = (element as unknown as Record<string, unknown>)[key];

        if (entry.notifyOnWrite && !isEqual(before, after)) {
          markDomDirty(proxy as DomSignal);
        }

        return true;
      }

      return true;
    },
  }) as DomSignal;

  return receiver;
};

const disposedEntries = new WeakSet<DomEntry>();

const lookupDisposed = (entry: DomEntry): boolean => disposedEntries.has(entry);

const markDisposed = (entry: DomEntry): void => {
  disposedEntries.add(entry);
};
