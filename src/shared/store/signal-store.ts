import { Signal } from "../core/signal";

export interface SignalEntry<T> {
  id: string;

  route: string;

  global: boolean;

  signal: Signal<T>;

  created: number;
}

export const signalStore = new Map<string, Map<string, SignalEntry<any>>>();

export const getRoute = (route?: string | number) => {
  if (route !== undefined) return String(route);

  if (typeof window === "undefined") return "ssr";

  return window.location.pathname + window.location.search;
};

export const storeSignal = <T>(entry: SignalEntry<T>) => {
  let route = signalStore.get(entry.route);

  if (!route) {
    route = new Map();

    signalStore.set(entry.route, route);
  }

  route.set(entry.id, entry);
};
