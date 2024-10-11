import { isEqual } from "../equalityCheck";

export type Signal<T> = {
  get: () => T | Partial<T | undefined> | undefined | null;
  set: (newValue: Partial<T> | T | Promise<T> | (() => Promise<T>)) => void;
  subscribe: (
    callback: (value: null | undefined | Partial<T> | T | Promise<T> | (() => Promise<T>)) => void,
  ) => () => void;
};

export type SignalEntry<T> = {
  cacheId: string;
  signal: Signal<T>;
};

export const destroySignal = (id: string) => {
  //Remove the siganl from the store to be garbage collected
  delete signalStore[id];
};

//The signal store
export const signalStore: Record<string, SignalEntry<any>> = {};

//Retreive an existing signal
const getSignal = (id: string) => {
  if (!id || (id && id.length === 0)) {
    throw new Error("In order to create a signal, you need to pass in an id");
  }

  const signal = signalStore[id];
  return signal;
};

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

const createSignal = <T>(
  promiseOrFunction: Promise<T> | (() => Promise<T> | null | undefined),
  cacheId: string,
): Signal<T | undefined> => {
  let value: T | Partial<T | undefined> | undefined | null;
  let listeners: ((value: T | Partial<T | undefined> | undefined | null) => void)[] = [];
  let settled = false;

  const existingSignal = getSignal(cacheId) as SignalEntry<T | undefined> | undefined;

  //Do an early return if the signal exists
  if (existingSignal) return existingSignal.signal;

  function* generator(
    functionOrPromise:
      | T //This is here to satisfy typescript
      | Partial<T | undefined>
      | Promise<T | undefined>
      | (() => Promise<T | undefined>)
      | undefined
      | null,
  ) {
    try {
      let result: T;
      let newValue: T | Partial<T | undefined> | undefined | null;
      if (functionOrPromise instanceof Promise || typeof functionOrPromise === "function") {
        if (typeof functionOrPromise === "function") {
          result = yield (functionOrPromise as () => Promise<T | undefined>)();
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
      } else newValue = functionOrPromise as T | undefined | null; //Set the value here if it's not a promise or a method that returns a promise.

      //Update the value if the newValue isn't the same
      if (!isEqual(value, newValue)) {
        value = newValue;
      }

      settled = true;

      //Pass to the new value to any subscribers
      listeners.forEach((listener) => {
        listener(value);
      });
    } catch (error) {
      //TODO:  Look at adding error handling here.
      throw new Error(`Error in async signal, ${error}`);
    }
  }

  const runGenerator = (
    generatorPromiseOrFunction:
      | T //This is here to satisfy typescript
      | null
      | undefined
      | Partial<T | undefined>
      | Promise<T | undefined>
      | (() => Promise<T | undefined>),
  ) => {
    const iterator = generator(generatorPromiseOrFunction);
    handleNext(iterator); // Start the generator
  };

  //If it's a promise or function, then run the code.  Otherwise, go straigh to the signal and return it.
  if (promiseOrFunction) {
    runGenerator(promiseOrFunction as Promise<T> | (() => Promise<T>));
  }

  //promiseOrFunction is null or undefined.
  else
    value = promiseOrFunction as
      | T //This is here to satisfy typescript
      | Partial<T | undefined>
      | undefined
      | null;

  //Doesn't exist, create a new signal
  const signal: Signal<T | undefined> = {
    get: () => value, // Return undefined if not yet resolved
    set: (
      newValue:
        | T //This is here to satisfy typescript
        | null
        | undefined
        | Partial<T | undefined>
        | Promise<T | undefined>
        | (() => Promise<T | undefined>),
    ) => {
      runGenerator(newValue);
    },
    subscribe: (callback: (value: T | Partial<T | undefined> | undefined | null) => void) => {
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

//Note createSignalwill return existing signals
export const signal = <T>(
  cacheId: string,
  initialValue?: T | Promise<T> | (() => Promise<T>),
): Signal<T | undefined> | Signal<T> => createSignal(initialValue as Promise<T> | (() => Promise<T>), cacheId);
