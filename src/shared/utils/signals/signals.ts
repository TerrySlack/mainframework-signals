import { isEqual } from "../equalityCheck";

export type Signal<T> = {
  get: () => T;
  set: (newValue: Partial<T> | T | Promise<T> | (() => Promise<T>)) => void;
  subscribe: (callback: (value: Partial<T> | T | Promise<T> | (() => Promise<T>)) => void) => () => void;
};

export type SignalEntry<T> = {
  cacheId: string;
  signal: Signal<T>;
};

export const destroySignal = (id: string) => {
  //Remove the siganl from the store to be garbage collected
  delete signalStore[id];
};

export const signalStore: Record<string, SignalEntry<any>> = {};

const getSignal = (id: string) => {
  if (!id || (id && id.length === 0)) {
    throw new Error("In order to create a signal, you need to pass in an id");
  }

  const signal = signalStore[id];
  return signal;
};

const createSyncSignal = <T>(initialValue: T, cacheId: string): Signal<T> => {
  const existingSignal = getSignal(cacheId) as SignalEntry<T> | undefined;
  //Do an early return if the signal exists
  if (existingSignal) return existingSignal.signal;

  let value = initialValue;
  let listeners: ((value: T) => void)[] = [];

  const signal: Signal<T> = {
    get: () => value,
    set: (newValue: Partial<T> | T | Promise<T> | (() => Promise<T>)) => {
      //This is a sync signal, for primities.  The typings are there to use the Signal type for both a sync and async signal
      if (!isEqual(value, newValue)) {
        if (newValue && (Array.isArray(newValue) || typeof newValue === "object")) {
          // Handle object or array (shallow merge)
          value = Array.isArray(newValue)
            ? ([...(value as unknown as any[]), ...newValue] as T)
            : ({ ...(value as Record<string, unknown>), ...newValue } as T);
        } else {
          // Handle primitive types (number, string, boolean, etc.)
          value = newValue as T;
        }
      }
      //Push the value out to the subscribers
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

const createAsyncSignal = <T>(
  promiseOrFunction: Promise<T> | (() => Promise<T>),
  cacheId: string,
): Signal<T | undefined> => {
  let value: T | undefined;
  let listeners: ((value: T | undefined) => void)[] = [];
  let settled = false;

  const existingSignal = getSignal(cacheId) as SignalEntry<T | undefined> | undefined;
  //Do an early return if the signal exists
  if (existingSignal) return existingSignal.signal;

  function* generator(functionOrPromise: Promise<T> | (() => Promise<T>)) {
    try {
      let result: T;
      let newValue: T | undefined;

      if (typeof functionOrPromise === "function") {
        result = yield functionOrPromise();
      } else {
        result = yield functionOrPromise;
      }

      // Check for Fetch API Response object
      if (result && typeof (result as unknown as Response).json === "function") {
        newValue = yield (result as unknown as Response).json();
      }
      // Check for Axios or SuperAgent response with `data` property
      else if (result && (result as unknown as { data: T }).data) {
        newValue = yield (result as unknown as { data: T }).data;
      }
      // Check for a response with a `text()` method (like some other libraries). Handles xml as well
      else if (result && typeof (result as unknown as { text: () => Promise<string> }).text === "function") {
        newValue = yield (result as unknown as { text: () => Promise<string> }).text();
      }
      // Check for a response with a `body` property
      else if (result && (result as unknown as { body: T }).body) {
        newValue = (result as unknown as { body: T }).body;
      }
      // Check for an object that could be a plain response or result
      else if (result && typeof result === "object" && result !== null) {
        newValue = result as T;
      }
      // Default case where result is returned directly
      else {
        newValue = result;
      }

      if (!isEqual(value, newValue)) {
        value = newValue;
      }

      settled = true;
      listeners.forEach((listener) => listener(value));
    } catch (error) {
      console.error("Error in async signal:", error);
    }
  }

  const runGenerator = (generatorPromiseOrFunction: Promise<T> | (() => Promise<T>)) => {
    const iterator = generator(generatorPromiseOrFunction);
    handleNext(iterator); // Start the generator
  };

  runGenerator(promiseOrFunction);

  /*
      does the signal exist?
      just return it
    */

  //Doesn't exist, create a new signal
  const signal: Signal<T | undefined> = {
    get: () => value, // Return undefined if not yet resolved
    set: (
      newValue:
        | T //This is here to satisfy typescript
        | Partial<T | undefined>
        | Promise<T | undefined>
        | (() => Promise<T | undefined>),
    ) => {
      if (newValue instanceof Promise || typeof newValue === "function") {
        // Re-trigger generator for new async value
        //It will only be a promise or a function, so we can safely cast it
        runGenerator(newValue as Promise<T> | (() => Promise<T>));
      }
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

//Note createAsyncSignal and createSyncSignal will return existing signals

export const signal = <T>(
  initialValue: T | Promise<T> | (() => Promise<T>),
  cacheId: string,
): Signal<T | undefined> | Signal<T> =>
  initialValue instanceof Promise || typeof initialValue === "function"
    ? createAsyncSignal(initialValue as Promise<T> | (() => Promise<T>), cacheId)
    : createSyncSignal<T>(initialValue as T, cacheId);
