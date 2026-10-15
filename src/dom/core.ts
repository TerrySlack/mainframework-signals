import { notify, track, type SignalNode } from "../shared/core/reactive";
import { isBrowser } from "../shared/utils/assert-browser";

import type { DomSignal } from "./types";

const elementNodes = new WeakMap<DomSignal, SignalNode<HTMLElement | null>>();
const bumpSets = new WeakMap<DomSignal, Set<() => void>>();
const dirtyScheduled = new WeakMap<DomSignal, boolean>();

const getElementNode = (dom: DomSignal): SignalNode<HTMLElement | null> => {
  let node = elementNodes.get(dom);

  if (!node) {
    node = {
      value: null,
      computations: new Set(),
      equals: Object.is,
    };
    elementNodes.set(dom, node);
  }

  return node;
};

export const readDomElement = (dom: DomSignal): HTMLElement | null => {
  const node = getElementNode(dom);
  track(node);
  return node.value;
};

export const peekDomElement = (dom: DomSignal): HTMLElement | null => getElementNode(dom).value;

export const writeDomElement = (dom: DomSignal, next: HTMLElement | null): void => {
  const node = getElementNode(dom);

  if (Object.is(node.value, next)) {
    return;
  }

  node.value = next;
  notify(node);
};

export const registerReactBump = (dom: DomSignal, bumpFn: () => void): void => {
  let set = bumpSets.get(dom);

  if (!set) {
    set = new Set();
    bumpSets.set(dom, set);
  }

  set.add(bumpFn);
};

export const unregisterReactBump = (dom: DomSignal, bumpFn: () => void): void => {
  bumpSets.get(dom)?.delete(bumpFn);
};

export const clearReactBumps = (dom: DomSignal): void => {
  bumpSets.delete(dom);
};

export const markDomDirty = (dom: DomSignal | null): void => {
  if (dom === null || !isBrowser()) {
    return;
  }

  const set = bumpSets.get(dom);

  if (!set || set.size === 0) {
    return;
  }

  if (dirtyScheduled.get(dom)) {
    return;
  }

  dirtyScheduled.set(dom, true);

  queueMicrotask(() => {
    dirtyScheduled.set(dom, false);
    const current = bumpSets.get(dom);

    if (!current) {
      return;
    }

    current.forEach((bumpFn) => {
      bumpFn();
    });
  });
};
