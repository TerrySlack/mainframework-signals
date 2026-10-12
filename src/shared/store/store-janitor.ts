import { createWorker, type TimerWorkerMessage } from "@mainframework/timer";

import { assertWorker } from "../utils/assert-browser";

import { getCurrentRoute } from "./signal-store";
import { runStoreCleanup } from "./store-cleanup";

const JANITOR_CACHE_ID = "__signals_store_janitor__";
const JANITOR_ROUTE_KEY = "__signals_store_janitor_route__";
const JANITOR_SECONDS = 10;

let started = false;

export const ensureStoreJanitor = () => {
  if (started) {
    return;
  }

  started = true;
  assertWorker();

  const worker = createWorker();
  const id = JANITOR_CACHE_ID;

  const handleMessage = (event: MessageEvent<TimerWorkerMessage>) => {
    const message = event.data;

    if (!message || message.id !== id) {
      return;
    }

    if (message.type === "expired") {
      void runStoreCleanup(getCurrentRoute(), "janitor");

      worker.postMessage({
        type: "register",
        routeKey: JANITOR_ROUTE_KEY,
        id,
        mode: "down",
        durationSeconds: JANITOR_SECONDS,
      });
    }
  };

  worker.addEventListener("message", handleMessage);

  worker.postMessage({
    type: "register",
    routeKey: JANITOR_ROUTE_KEY,
    id,
    mode: "down",
    durationSeconds: JANITOR_SECONDS,
  });
};
