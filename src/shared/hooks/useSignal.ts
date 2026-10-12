import { useEffect, useRef, useState } from "react";

import { effect, signal, type SignalInitialValue } from "../core";

const bump = (n: number) => (n === 9 ? 0 : n + 1);

export const useSignal = <T>(initialValue: SignalInitialValue<T>) => {
  const idRef = useRef("");
  const [, setTrigger] = useState(0);

  if (idRef.current.length === 0) {
    idRef.current =
      typeof window !== "undefined" && "crypto" in window
        ? crypto.randomUUID()
        : `sid_${Date.now()}_${Math.random().toString(36).slice(2)}`; //Add a random string
  }

  const sig = signal(idRef.current, initialValue);

  useEffect(() => {
    return effect(() => {
      sig();
      setTrigger(bump);
    });
  }, [sig]);

  return {
    value: sig(),
    set: sig.set,
  };
};
