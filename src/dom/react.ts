import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { effect } from "../shared/core/effect";
import { getRoute } from "../shared/store/signal-store";
import { isBrowser } from "../shared/utils/assert-browser";

import { collectBackingDeps } from "./collect-backing-deps";
import { peekDomElement, registerReactBump, unregisterReactBump } from "./core";
import { getStoredDomSignal, lookupDomEntry } from "./dom-store";
import { getOrCreateDomSignal } from "./get-or-create-dom-signal";
import type { DomRef, DomSignal, UseDomSignalOptions } from "./types";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const bump = (n: number) => (n === 9 ? 0 : n + 1);

export const useDomSignal = <T extends HTMLElement>(
  ref: DomRef<T>,
  options?: UseDomSignalOptions,
): DomSignal | null => {
  const cacheIdRef = useRef("");
  const routeRef = useRef("");
  const globalRef = useRef(false);
  const [, setTrigger] = useState(0);

  useIsomorphicLayoutEffect(() => {
    if (!isBrowser()) {
      return;
    }

    const cacheId = cacheIdRef.current;

    if (cacheId.length === 0) {
      return;
    }

    const dom = getStoredDomSignal(cacheId, routeRef.current, globalRef.current);

    if (!dom) {
      return;
    }

    const current = ref.current;

    if (current != null && !Object.is(current, peekDomElement(dom))) {
      dom.attachElement(current);
    } else if (current == null && peekDomElement(dom) != null) {
      dom.detach();
    }
  });

  useIsomorphicLayoutEffect(() => {
    return () => {
      if (!isBrowser()) {
        return;
      }

      const cacheId = cacheIdRef.current;

      if (cacheId.length === 0) {
        return;
      }

      const dom = getStoredDomSignal(cacheId, routeRef.current, globalRef.current);

      dom?.detach();
    };
  }, []);

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    const cacheId = cacheIdRef.current;

    if (cacheId.length === 0) {
      return;
    }

    const dom = getStoredDomSignal(cacheId, routeRef.current, globalRef.current);

    if (!dom) {
      return;
    }

    const bumpFn = () => {
      setTrigger(bump);
    };

    registerReactBump(dom, bumpFn);

    const entry = lookupDomEntry(cacheId, { route: routeRef.current, global: globalRef.current });

    const stop = effect(() => {
      collectBackingDeps(entry?.backingSnapshot, () => {
        setTrigger(bump);
      });
    });

    return () => {
      stop?.();
      unregisterReactBump(dom, bumpFn);
    };
  }, []);

  if (!isBrowser()) {
    return null;
  }

  if (cacheIdRef.current.length === 0) {
    cacheIdRef.current =
      options?.cacheId ??
      ("crypto" in window ? crypto.randomUUID() : `sid_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    routeRef.current = getRoute(options?.route);
    globalRef.current = options?.global ?? false;
  }

  getOrCreateDomSignal(cacheIdRef.current, options);

  return getStoredDomSignal(cacheIdRef.current, routeRef.current, globalRef.current) ?? null;
};
