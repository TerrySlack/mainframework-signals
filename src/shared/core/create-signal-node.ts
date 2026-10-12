import { isEqual } from "@mainframework/is-deep-equal";

import { isBrowser } from "../utils/assert-browser";

import { notify, SignalNode, track } from "./reactive";
import type { Signal } from "./signal";

export const createSyncSignal = <T>(initialValue: T): Signal<T> => {
  const node: SignalNode<T> = {
    value: initialValue,
    computations: new Set(),
    equals: isEqual,
  };

  const getter = (() => {
    if (!isBrowser()) {
      return undefined as T;
    }

    track(node);
    return node.value;
  }) as Signal<T>;

  getter.set = (value) => {
    if (!isBrowser()) {
      return;
    }

    const next = typeof value === "function" ? (value as (previous: T) => T)(node.value) : value;

    if (node.equals(node.value, next)) {
      return;
    }

    node.value = next;

    notify(node);
  };

  return getter;
};
