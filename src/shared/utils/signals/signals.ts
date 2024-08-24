export type Signal<T> = {
  get: () => T;
  set: (newValue: Partial<T> | T | Promise<T> | (() => Promise<T>)) => void;
  subscribe: (callback: (value: Partial<T> | T | Promise<T> | (() => Promise<T>)) => void) => () => void;
};

export type SignalEntry<T> = {
  cacheId: string;
  signal: Signal<T>;
};

const signalStore: Record<string, SignalEntry<any>> = {};

const createSyncSignal = <T>(initialValue: T, cacheId: string): Signal<T> => {
  let value = initialValue;
  let listeners: ((value: T) => void)[] = [];

  const signal: Signal<T> = {
    get: () => value,
    set: (newValue: Partial<T> | T | Promise<T> | (() => Promise<T>)) => {
      if ((Array.isArray(newValue) || typeof newValue === "object") && newValue !== null) {
        // Handle object or array (shallow merge)
        value = Array.isArray(newValue)
          ? ([...(value as unknown as any[]), ...newValue] as T)
          : ({ ...(value as Record<string, unknown>), ...newValue } as T);
      } else {
        // Handle primitive types (number, string, boolean, etc.)
        value = newValue as T;
      }
      listeners.forEach((listener) => listener(value));
    },
    subscribe: (callback: (value: T) => void) => {
      listeners.push(callback);
      return () => {
        // Remove the callback from the listeners
        listeners = listeners.filter((listener) => listener !== callback);
      };
    },
  };

  // Store the newly created signal
  signalStore[cacheId] = { cacheId, signal };

  return signal;
};

//const handleNext = (iterator: Iterator<any>, value?: any) => {
const handleNext = <T>(iterator: Iterator<T | Promise<T>, T, unknown>, value?: T) => {
  const { value: nextValue, done } = iterator.next(value);
  if (!done) {
    if (nextValue instanceof Promise) {
      nextValue.then(
        (resolvedValue) => handleNext(iterator, resolvedValue),
        (error) => iterator.throw && iterator.throw(error),
      );
    } else {
      handleNext(iterator, nextValue);
    }
  }
};

export const destroySignal = (id: string) => {
  //Remove the siganl from the store to be garbage collected
  delete signalStore[id];
};

const createAsyncSignal = <T>(
  promiseOrFunction: Promise<T> | (() => Promise<T>),
  cacheId: string,
): Signal<T | undefined> => {
  let value: T | undefined;
  let listeners: ((value: T | undefined) => void)[] = [];
  let settled = false;

  function* generator() {
    try {
      let result: T;

      if (typeof promiseOrFunction === "function") {
        result = yield promiseOrFunction();
      } else {
        result = yield promiseOrFunction;
      }

      // Check for Fetch API Response object
      if (result && typeof (result as unknown as Response).json === "function") {
        value = yield (result as unknown as Response).json();
      }
      // Check for Axios or SuperAgent response with `data` property
      else if (result && (result as unknown as { data: T }).data) {
        value = yield (result as unknown as { data: T }).data;
      }
      // Check for a response with a `text()` method (like some other libraries). Handles xml as well
      else if (result && typeof (result as unknown as { text: () => Promise<string> }).text === "function") {
        value = yield (result as unknown as { text: () => Promise<string> }).text();
      }
      // Check for a response with a `body` property
      else if (result && (result as unknown as { body: T }).body) {
        value = (result as unknown as { body: T }).body;
      }
      // Check for an object that could be a plain response or result
      else if (result && typeof result === "object" && result !== null) {
        value = result as T;
      }
      // Default case where result is returned directly
      else {
        value = result;
      }

      settled = true;
      listeners.forEach((listener) => listener(value));
    } catch (error) {
      console.error("Error in async signal:", error);
    }
  }

  const runGenerator = () => {
    const iterator = generator();
    handleNext(iterator); // Start the generator
  };

  runGenerator();

  const signal: Signal<T | undefined> = {
    get: () => value, // Return undefined if not yet resolved
    set: (newValue: T | Partial<T | undefined> | Promise<T | undefined> | (() => Promise<T | undefined>)) => {
      value = newValue as T;
      settled = true;
      listeners.forEach((listener) => listener(value));
    },
    subscribe: (callback: (value: T | undefined) => void) => {
      listeners.push(callback);
      if (settled) {
        callback(value);
      }
      return () => {
        listeners = listeners.filter((listener) => listener !== callback);
      };
    },
  };

  signalStore[cacheId] = { cacheId, signal };
  return signal;
};

export const createSignal = <T>(
  initialValue: T | Promise<T> | (() => Promise<T>),
  cacheId: string,
): Signal<T | undefined> | Signal<T> => {
  //If the signal exists, then return it
  if (signalStore[cacheId]) {
    return signalStore[cacheId].signal;
  }

  return initialValue instanceof Promise || typeof initialValue === "function"
    ? createAsyncSignal(initialValue as Promise<T> | (() => Promise<T>), cacheId)
    : createSyncSignal<T>(initialValue as T, cacheId);
};
