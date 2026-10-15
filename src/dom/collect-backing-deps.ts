import type { Resource } from "../shared/core/resource";
import type { Signal } from "../shared/core/signal";

import type { DomBacking, DomProps } from "./types";

export const isOneShotBacking = (backing: DomBacking): backing is { props: DomProps } =>
  backing !== null && typeof backing === "object" && "props" in backing;

const isResourceSource = (source: unknown): source is Resource<unknown> =>
  typeof source === "function" && "reload" in source;

const isSignalSource = (source: unknown): source is Signal<unknown> => typeof source === "function" && "set" in source;

export const collectBackingDeps = (backing: DomBacking | undefined, onReactiveRead: () => void): void => {
  if (!backing || isOneShotBacking(backing)) {
    return;
  }

  let reactive = false;
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
      reactive = true;
    } else if (isSignalSource(source)) {
      source();
      reactive = true;
    }
  }

  if (reactive) {
    onReactiveRead();
  }
};
