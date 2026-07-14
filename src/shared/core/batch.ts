let depth = 0;

const queue = new Set<() => void>();

export const batch = (callback: () => void) => {
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
  if (depth > 0) {
    queue.add(job);
  } else {
    job();
  }
};
