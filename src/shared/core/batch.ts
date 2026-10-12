import { isBrowser } from "../utils/assert-browser";

let depth = 0;

const queue = new Set<() => void>();

export const batch = (callback: () => void) => {
  if (!isBrowser()) {
    return;
  }

  depth++;

  try {
    callback();
  } finally {
    depth--;

    if (depth === 0) {
      queue.forEach((job) => job());
      queue.clear();
    }
  }
};

export const enqueue = (job: () => void) => {
  if (!isBrowser()) {
    return;
  }

  if (depth > 0) {
    queue.add(job);
  } else {
    job();
  }
};
