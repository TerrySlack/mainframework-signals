import { effect } from "../shared/core/effect";
import type { Resource } from "../shared/core/resource";
import type { Signal } from "../shared/core/signal";

import { applyDomProp, applyDomProps } from "./apply-dom-props";
import { isOneShotBacking } from "./collect-backing-deps";
import type { DomBacking, DomProps } from "./types";
import type { DomSignal } from "./types";

const wireDisposers = new WeakMap<DomSignal, () => void>();

export const getBackingSnapshot = (backing?: DomBacking): DomBacking | undefined => {
  if (!backing) {
    return undefined;
  }

  if (isOneShotBacking(backing)) {
    return { props: { ...backing.props } };
  }

  const snapshot = {} as Record<string, unknown>;

  for (const key of Object.keys(backing)) {
    snapshot[key] = (backing as Record<string, unknown>)[key];
  }

  return snapshot;
};

const isResourceSource = (source: unknown): source is Resource<unknown> =>
  typeof source === "function" && "reload" in source;

const isSignalSource = (source: unknown): source is Signal<unknown> => typeof source === "function" && "set" in source;

const readMappedValue = (source: unknown): unknown => {
  if (isResourceSource(source)) {
    const value = source();

    if (value === undefined) {
      return undefined;
    }

    return value;
  }

  if (isSignalSource(source)) {
    return source();
  }

  if (typeof source === "function") {
    return undefined;
  }

  return source;
};

const applyMappedBacking = (element: HTMLElement, backing: DomBacking): void => {
  const mapped = backing as Record<keyof DomProps, unknown>;

  for (const key of Object.keys(backing) as (keyof DomProps)[]) {
    const source = mapped[key];

    if (source === undefined) {
      continue;
    }

    if (isResourceSource(source)) {
      source();
      source.loading();
      source.error();
    }

    const value = readMappedValue(source);

    if (value === undefined) {
      continue;
    }

    applyDomProp(element, key, value as DomProps[keyof DomProps]);
  }
};

export const startWireBacking = (dom: DomSignal, element: HTMLElement, snapshot: DomBacking): void => {
  stopWireBacking(dom);

  if (isOneShotBacking(snapshot)) {
    applyDomProps(element, snapshot.props);
    return;
  }

  const stop = effect(() => {
    applyMappedBacking(element, snapshot);
  });

  if (stop) {
    wireDisposers.set(dom, stop);
  }
};

export const stopWireBacking = (dom: DomSignal): void => {
  const stop = wireDisposers.get(dom);

  if (stop) {
    stop();
    wireDisposers.delete(dom);
  }
};
