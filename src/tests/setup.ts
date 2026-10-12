import { vi } from "vitest";

type TimerListener = (event: MessageEvent) => void;

export type FakeTimerWorker = {
  addEventListener: (type: string, listener: TimerListener) => void;
  removeEventListener: (type: string, listener: TimerListener) => void;
  postMessage: (message: unknown) => void;
  emitMessage: (data: unknown) => void;
};

export const fakeTimerWorkers: FakeTimerWorker[] = [];

export const emitTimerExpired = (worker: FakeTimerWorker, id: string) => {
  worker.emitMessage({ type: "expired", id });
};

const FakeWorker = class Worker {
  constructor() {}
};

vi.stubGlobal("Worker", FakeWorker);

export const restoreAfterWindowStub = () => {
  vi.unstubAllGlobals();
  vi.stubGlobal("Worker", FakeWorker);
};

vi.mock("@mainframework/timer", () => ({
  createWorker: () => {
    const listeners: TimerListener[] = [];

    const worker: FakeTimerWorker = {
      addEventListener: (_type, listener) => {
        listeners.push(listener);
      },
      removeEventListener: (_type, listener) => {
        const index = listeners.indexOf(listener);

        if (index >= 0) {
          listeners.splice(index, 1);
        }
      },
      postMessage: () => {},
      emitMessage: (data) => {
        const event = { data } as MessageEvent;

        listeners.forEach((listener) => listener(event));
      },
    };

    fakeTimerWorkers.push(worker);

    return worker;
  },
}));
