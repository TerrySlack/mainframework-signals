import { createWorker, type TimerWorkerMessage } from "@mainframework/timer";

import { assertWorker } from "../utils/assert-browser";

type TimerRegistration = {
  id: string;
  routeKey: string;
  durationSeconds: number;
  onInterval: () => void;
  handleMessage: (event: MessageEvent<TimerWorkerMessage>) => void;
};

const timers = new Map<string, TimerRegistration>();

const getWorker = () => {
  assertWorker();

  return createWorker();
};

export const startResourceInterval = (
  cacheId: string,
  routeKey: string,
  refetchIntervalMs: number,
  onInterval: () => void,
) => {
  stopResourceInterval(cacheId);

  const worker = getWorker();
  const id = crypto.randomUUID();
  const durationSeconds = Math.max(1, Math.ceil(refetchIntervalMs / 1000));

  const handleMessage = (event: MessageEvent<TimerWorkerMessage>) => {
    const message = event.data;

    if (!message || message.id !== id) {
      return;
    }

    if (message.type === "expired") {
      onInterval();

      worker.postMessage({
        type: "register",
        routeKey,
        id,
        mode: "down",
        durationSeconds,
      });
    }
  };

  worker.addEventListener("message", handleMessage);

  worker.postMessage({
    type: "register",
    routeKey,
    id,
    mode: "down",
    durationSeconds,
  });

  timers.set(cacheId, { id, routeKey, durationSeconds, onInterval, handleMessage });

  onInterval();
};

export const stopResourceInterval = (cacheId: string) => {
  const registration = timers.get(cacheId);

  if (!registration) {
    return;
  }

  const worker = getWorker();

  worker.removeEventListener("message", registration.handleMessage);
  worker.postMessage({ type: "unregister", routeKey: registration.routeKey, id: registration.id });

  timers.delete(cacheId);
};

export const stopResourceIntervalsForRoute = (routeKey: string) => {
  for (const [cacheId, registration] of timers.entries()) {
    if (registration.routeKey === routeKey) {
      stopResourceInterval(cacheId);
    }
  }
};
