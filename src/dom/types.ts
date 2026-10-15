import type { Resource } from "../shared/core/resource";
import type { Signal } from "../shared/core/signal";

export type DomProps = {
  textContent?: string | null;
  innerHTML?: string | null;
  className?: string | null;
  id?: string | null;
  hidden?: boolean | null;
  value?: string | null;
  checked?: boolean | null;
  disabled?: boolean | null;
  src?: string | null;
  href?: string | null;
  alt?: string | null;
  title?: string | null;
  placeholder?: string | null;
  type?: string | null;
  name?: string | null;
  htmlFor?: string | null;
  tabIndex?: number | null;
};

export type DomPropValue<K extends keyof DomProps> = NonNullable<DomProps[K]> | null;

export type DomPropSource<K extends keyof DomProps> =
  DomPropValue<K> | Signal<DomPropValue<K>> | Resource<DomPropValue<K>>;

export type DomBacking = { props: DomProps } | { [K in keyof DomProps]?: DomPropSource<K> };

export type DomSignalOptions = {
  global?: boolean;
  route?: string | number;
  backing?: DomBacking;
  notifyOnWrite?: boolean;
};

export type UseDomSignalOptions = DomSignalOptions & {
  cacheId?: string;
};

export type DomRef<T extends HTMLElement> = {
  readonly current: T | null;
};

export type DomSignal = {
  readonly cacheId: string;
  readonly route: string;
  readonly global: boolean;
  readonly element: HTMLElement | null;
  attachElement: (element: HTMLElement | null) => void;
  detach: () => void;
  dispose: () => void;
};
