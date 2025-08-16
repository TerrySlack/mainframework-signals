export type Signal<T> = {
  get: () => T | undefined;
  //newValue: T | Promise<T> | (() => T | Promise<T>)) => void
  set: (newValue: T | Promise<T> | (() => Promise<T>)) => void;
  subscribe: (callback: (value: T | undefined) => void) => () => void;
  error: { message: string; httpCode?: number } | null;
};

export type SignalEntry<T> = {
  cacheId: string;
  route: string;
  global: boolean;
  signal: Signal<T>;
  listeners: Set<(value: T | undefined) => void>;
};

const isBrowser = typeof window !== "undefined";

// Combined tracking - no need for separate signalIdToRoute map
export const signalStore = new Map<string, Map<string, SignalEntry<any>>>();

// Batch cleanup queue with debouncing
let cleanupQueued = false;
const pendingCleanupRoutes = new Set<string>();

// Tuning parameters for performance optimization
const CLEANUP_CHUNK_SIZE = 50; // Process signals in chunks to avoid blocking
const THROTTLE_THRESHOLD = 5; // Routes before applying delay
const THROTTLE_DELAY = 100; // ms delay for frequent cleanups

const getCurrentRoute = (route?: string | number): string => {
  if (route !== undefined && route !== "") {
    return String(route);
  }
  if (!isBrowser) {
    return "ssr";
  }
  return `${window.location.pathname}${window.location.search}`;
};

export const findRoute = (id: string): string | undefined => {
  for (const [route, signals] of signalStore) {
    if (signals.has(id)) return route;
  }
  return undefined;
};

export const clearListeners = (id: string): void => {
  const route = findRoute(id);
  if (!route) return;

  const routeSignals = signalStore.get(route);
  const signalEntry = routeSignals?.get(id);
  if (signalEntry) {
    signalEntry.listeners.clear();
  }
};

export const destroySignal = (id: string): void => {
  const route = findRoute(id);
  if (!route) return;

  const routeSignals = signalStore.get(route);
  if (routeSignals?.has(id)) {
    const signalEntry = routeSignals.get(id)!;
    signalEntry.listeners.clear();
    routeSignals.delete(id);

    // Clean up empty route
    if (routeSignals.size === 0) {
      signalStore.delete(route);
    }
  }
};

// Optimized cleanup with batching, debouncing, and chunking
const executeCleanup = async (): Promise<void> => {
  const routesToProcess = new Set(pendingCleanupRoutes);
  pendingCleanupRoutes.clear();
  cleanupQueued = false;

  const allSignalsToDestroy: string[] = [];

  // Collect all signals to destroy using while loops for micro-optimization
  const routeIterator = signalStore.entries();
  let routeEntry = routeIterator.next();

  while (!routeEntry.done) {
    const [route, signals] = routeEntry.value;

    // Skip if this is a current route - use Set.has for faster lookup
    if (!routesToProcess.has(route)) {
      const signalIterator = signals.entries();
      let signalEntry = signalIterator.next();

      while (!signalEntry.done) {
        const [id, signal] = signalEntry.value;
        if (!signal.global) {
          allSignalsToDestroy.push(id);
        }
        signalEntry = signalIterator.next();
      }
    }

    routeEntry = routeIterator.next();
  }

  // Process signals in chunks to prevent main thread blocking
  let i = 0;
  while (i < allSignalsToDestroy.length) {
    const chunk = allSignalsToDestroy.slice(i, i + CLEANUP_CHUNK_SIZE);

    // Process chunk
    let j = 0;
    while (j < chunk.length) {
      destroySignal(chunk[j]);
      j++;
    }

    i += CLEANUP_CHUNK_SIZE;

    // Yield to event loop between chunks, with adaptive delay for large queues
    if (i < allSignalsToDestroy.length) {
      const delay = allSignalsToDestroy.length > THROTTLE_THRESHOLD * 10 ? THROTTLE_DELAY : 0;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const scheduleCleanup = (): void => {
  if (cleanupQueued) return;
  cleanupQueued = true;

  const runCleanup = () => executeCleanup().catch(console.error);

  // Enhanced throttling: use longer delay for frequent cleanup requests
  const delay = pendingCleanupRoutes.size > THROTTLE_THRESHOLD ? THROTTLE_DELAY : 0;

  if (isBrowser && "requestIdleCallback" in window) {
    (window as any).requestIdleCallback(runCleanup, { timeout: 1000 });
  } else {
    setTimeout(runCleanup, delay);
  }
};

export const cleanupOldRoutes = (currentRoute: string): void => {
  if (!currentRoute) return;
  pendingCleanupRoutes.add(currentRoute);
  scheduleCleanup();
};

const createSignal = <T>(
  cacheId: string,
  initialValue?: T | Promise<T> | (() => Promise<T>),
  global = false,
  route?: string | number,
): Signal<T> => {
  const currentRoute = getCurrentRoute(route);

  // Get or create route map
  let routeSignals = signalStore.get(currentRoute);
  if (!routeSignals) {
    routeSignals = new Map();
    signalStore.set(currentRoute, routeSignals);
  }

  // Return existing signal if found
  const existing = routeSignals.get(cacheId);
  if (existing) {
    return existing.signal;
  }

  // Schedule cleanup for new routes
  cleanupOldRoutes(currentRoute);

  let value: T | undefined = undefined;
  let error: { message: string; httpCode?: number } | null = null;
  const listeners = new Set<(value: T | undefined) => void>();

  const notifyListeners = (newValue: T | undefined): void => {
    // Micro-optimization: use while loop for listener iteration
    const listenerIterator = listeners.values();
    let listenerEntry = listenerIterator.next();

    while (!listenerEntry.done) {
      const listener = listenerEntry.value;
      try {
        listener(newValue);
      } catch (e) {
        console.error("Listener error:", e);
      }
      listenerEntry = listenerIterator.next();
    }
  };

  const signal: Signal<T> = {
    get: () => value,
    set: (newValue) => {
      if (newValue instanceof Promise) {
        newValue
          .then((resolvedValue) => {
            value = resolvedValue;
            error = null;
            notifyListeners(value);
          })
          .catch((err) => {
            error = { message: err.message };
            notifyListeners(undefined);
          });
      } else if (typeof newValue === "function") {
        try {
          const result = (newValue as () => Promise<T>)();
          if (result instanceof Promise) {
            result
              .then((resolvedValue) => {
                value = resolvedValue;
                error = null;
                notifyListeners(value);
              })
              .catch((err) => {
                error = { message: err.message };
                notifyListeners(undefined);
              });
          } else {
            value = result as T;
            error = null;
            notifyListeners(value);
          }
        } catch (err: any) {
          error = { message: err.message };
          notifyListeners(undefined);
        }
      } else {
        value = newValue as T;
        error = null;
        notifyListeners(value);
      }
    },
    subscribe: (callback) => {
      listeners.add(callback);

      // Immediately call with current value if available
      if (value !== undefined) {
        try {
          callback(value);
        } catch (e) {
          console.error("Subscription callback error:", e);
        }
      }

      return () => listeners.delete(callback);
    },
    get error() {
      return error;
    },
  };

  const entry: SignalEntry<T> = {
    cacheId,
    route: currentRoute,
    global,
    signal,
    listeners,
  };

  routeSignals.set(cacheId, entry);

  // Handle initial value
  if (initialValue !== undefined) {
    signal.set(initialValue);
  }

  return signal;
};

export const signal = <T>(
  cacheId: string,
  initialValue?: T | Promise<T> | (() => Promise<T>),
  global = false,
  route?: string | number,
): Signal<T> => createSignal<T>(cacheId, initialValue, global, route);
