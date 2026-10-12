# @mainframework/signals

Framework-agnostic signals for the browser, with an optional React hook. Written in TypeScript.

Repository: [github.com/TerrySlack/mainframework-signals](https://github.com/TerrySlack/mainframework-signals)

## Browser only — not for SSR or server

This package requires a **browser** (`window`). When `window` is missing (`typeof window === "undefined"` or `window == null`):

- **`createSignal`**, **`effect`**, **`computed`**, and **`resource`** return **`null`**.
- **`destroySignal`** is a no-op.
- **`useSignal`** returns **`null`**.

Always check for `null` before use.

**Web Workers** are required for the **10s store janitor** (started on the first **`createSignal()`** call — including via **`useSignal`** — not by **`resource()`** alone) and for **`refetchInterval`**. Environments without `Worker` throw when the janitor starts or when an interval is registered (`assertWorker`).

Signals stay in the store across React unmounts. **Non-global** entries on routes other than the active one are removed on **route change** and on the **10s store janitor** sweep. **`global: true`** entries are kept.

`@mainframework/is-deep-equal` and `@mainframework/timer` are dependencies of this package (installed automatically). You do not import them in application code.

## Installation

```bash
npm install @mainframework/signals
```

```bash
pnpm add @mainframework/signals
```

For **`useSignal`**, add peer dependencies in your app: **`react`** and **`react-dom`** (>=17).

## Package exports

| Import | Exports |
|--------|---------|
| `@mainframework/signals` | `createSignal`, `resource`, `effect`, `computed`, `destroySignal`, `isPromiseLike`, and types `CreateSignal`, `Signal`, `Resource`, `SignalOptions`, `SignalInitialValue`, `AsyncSource` |
| `@mainframework/signals/react` | `useSignal`, `UseSignal`, `UseSignalOptions` |

## Concepts

- **`cacheId`** — Stable string key. The same `cacheId` on the same route returns the same instance (sync or async). Omit **`cacheId`** only in **`useSignal`** to get an auto-generated id per hook instance.
- **Active route** — `window.location.pathname + window.location.search`, unless you pass **`route`** in options (string or number).
- **Stale routes** — Other route keys in the store. Purged when you create a signal on a new route (immediate) and on the **10s janitor** sweep. Only one janitor cleanup promise runs at a time; a route change cancels stale scheduled janitor work.
- **`destroySignal(cacheId, options?)`** — Removes the store entry, resource sub-keys (`:value`, `:loading`, `:error`), and any interval for that `cacheId`. Pass the same **`route`** / **`global`** you used when creating the signal.
- **`.set`** — Replaces the value (functional updates `set((previous) => …)` are supported). There is no object merge helper.
- **Deep equality** — Sync **`.set`** and **`computed`** skip downstream work when the new value is deep-equal to the previous (`@mainframework/is-deep-equal`).

## `SignalOptions`

| Option | Description |
|--------|-------------|
| `global?: boolean` | Keep the signal across route purges (global map). |
| `route?: string \| number` | Override the active route key. |
| `refetchInterval?: number` | Refetch interval in **milliseconds** (Web Worker timer). The worker rounds up to whole seconds (minimum **1s**). The source runs **once immediately**, then on each tick. |

## When is the initial value async?

Inside **`createSignal()`** or **`useSignal()`**, a **thenable** (`isPromiseLike`) or a **function** becomes a **`Resource`**. Plain values (including objects without a `then` method) become a sync **`Signal`**.

| Initial value | Result |
|---------------|--------|
| `Promise` / thenable | **`Resource`** — fetch on create (or on each `refetchInterval` tick when set) |
| `() => Promise<T>` | **`Resource`** — `reload()` calls the function again |
| Anything else | Sync **`Signal`** |

Async sources must return a **`Promise`**. A function initial value is always treated as an async source, not as a lazy sync factory; the function **must** return a **`Promise`** (a synchronous return is not supported).

**`reload()`** on a cached resource reuses the **original** fetcher from the first create (later `createSignal()` / `useSignal()` calls with the same `cacheId` ignore a new initial value). In-flight requests are ignored if a newer `reload()` or fetch started afterward.

Resolved values are stored as-is (for example, parse JSON in your promise before it resolves).

## Types at a glance

```ts
type Signal<T> = {
  (): T;
  set: (value: T | ((previous: T) => T)) => void;
};

type Resource<T> = {
  (): T | undefined;
  loading: Signal<boolean>;
  error: Signal<Error | null>;
  reload: () => void;
};

type AsyncSource<T> = Promise<T> | (() => Promise<T>);
type SignalInitialValue<T> = T | AsyncSource<T>;
```

Discriminate sync vs async signals with **`"reload" in signal`**.

## Vanilla (no React)

Import from `@mainframework/signals`: `createSignal`, `resource`, `effect`, `computed`, `destroySignal`, `isPromiseLike`.

Prefer **`createSignal(cacheId, …)`** when you want a single cached **`Resource`** per `cacheId`. Calling **`resource()`** directly still stores `:value`, `:loading`, and `:error` under the hood (repeated calls with the same `cacheId` reuse those store slots), but each **`resource()`** invocation starts a new fetch cycle; use **`createSignal()`** to reuse one resource instance.

### Sync `createSignal`

```ts
import { createSignal } from "@mainframework/signals";

const count = createSignal("my-count", 0);

if (!count) {
  return;
}

count(); // read
count.set(1);
count.set((previous) => previous + 1);
```

Reusing the same `cacheId` on the same route returns the same instance (the initial value is ignored after the first create).

### Async `createSignal` and `resource`

A **`Resource<T>`** is callable for the value. **`loading`** and **`error`** are full **`Signal`** instances (call them to read; use in **`effect`** / **`computed`** like any other signal).

- `resource()` — `T | undefined`
- `resource.loading()` — `boolean`
- `resource.error()` — `Error | null`
- `resource.reload()` — trigger a fetch

```ts
import { createSignal, resource, destroySignal } from "@mainframework/signals";

const posts = createSignal("posts-1", () => fetch("/api/posts/1").then((r) => r.json()), {
  global: true,
});

if (!posts) {
  return;
}

posts();
posts.loading();
posts.error();
posts.reload();

destroySignal("posts-1", { global: true });

// One-off or custom lifecycle (each call runs a fetch):
const user = resource("user-1", () => fetch("/api/me").then((r) => r.json()), {
  route: "/app",
});

if (!user) {
  return;
}
```

### `refetchInterval`

```ts
const live = createSignal(
  "metrics",
  () => fetch("/api/metrics").then((r) => r.json()),
  { refetchInterval: 5000, global: true },
);

if (!live) {
  return;
}

// First fetch runs immediately, then about every 5s (worker granularity is whole seconds).
```

### `computed` and `effect`

`computed` and `effect` track reads of **`createSignal()`** / **`Resource`** values (and other signals in the same reactive graph). Deep equality from `@mainframework/is-deep-equal` avoids redundant updates when values are structurally equal. Updates are batched and flushed on a microtask.

```ts
import { createSignal, computed, effect } from "@mainframework/signals";

const count = createSignal("count", 0);

if (!count) {
  return;
}

const doubled = computed(() => count() * 2);

if (!doubled) {
  return;
}

const stop = effect(() => {
  console.log("count", count(), "doubled", doubled());
});

count.set((n) => n + 1);

stop?.(); // dispose — no further runs
```

### `isPromiseLike`

```ts
import { isPromiseLike } from "@mainframework/signals";

if (isPromiseLike(maybePromise)) {
  // treated as async when passed to createSignal() / useSignal()
}
```

## React (optional)

Import **`useSignal`** from `@mainframework/signals/react`. The package does **not** ship `"use client"`; put **`"use client"`** on your own components that call **`useSignal`**. On the server (`window` missing), **`useSignal`** returns **`null`** and implicit route resolution uses **`""`**.

`useSignal(initialValue, options?)` delegates to **`createSignal(cacheId, …)`** in the store and returns the same **`Signal<T>`** or **`Resource<T>`** instance from the store. An internal **`effect`** subscribes to that signal so the component re-renders when values change. Store entries **persist after unmount**; remounting with the same **`cacheId`** and **`route`** reads the cached value (async resources keep the original fetcher for **`reload()`**).

`UseSignalOptions` is **`SignalOptions`** plus optional **`cacheId`**. Return type matches **`createSignal`**: sync **`Signal<T> | null`** or async **`Resource<T> | null`** ( **`null`** only when `window` is missing). Failed fetches set **`resource.error()`**; read **`asyncSignal.error()?.message`** in UI.

```tsx
"use client";

import { useSignal } from "@mainframework/signals/react";

export const App = () => {
  const numberSignal = useSignal(0);
  const asyncSignal = useSignal(
    () => fetch("https://jsonplaceholder.typicode.com/posts/1").then((r) => r.json()),
    { cacheId: "posts-1", global: true },
  );
  const fromPromise = useSignal(Promise.resolve({ id: 1 }), {
    cacheId: "async-run-once",
  });
  const polled = useSignal(
    () => fetch("/api/live").then((r) => r.json()),
    { cacheId: "live", refetchInterval: 10_000 },
  );

  if (
    numberSignal === null ||
    asyncSignal === null ||
    fromPromise === null ||
    polled === null
  ) {
    return null;
  }

  const increment = () => {
    numberSignal.set((n) => n + 1);
  };

  const onReload = () => {
    if ("reload" in asyncSignal) {
      asyncSignal.reload();
    }
  };

  return (
    <>
      <div>number: {numberSignal()}</div>
      <button type="button" onClick={increment}>+1</button>
      {asyncSignal.loading() ? (
        <div>Loading…</div>
      ) : asyncSignal.error() ? (
        <div>{asyncSignal.error()?.message}</div>
      ) : (
        <div>{JSON.stringify(asyncSignal())}</div>
      )}
      <button type="button" onClick={onReload}>Reload posts</button>
      {polled.loading() ? null : <div>live: {JSON.stringify(polled())}</div>}
    </>
  );
};
```

Shared store entry with the same `cacheId`:

```tsx
const a = useSignal(0, { cacheId: "shared" });
const b = useSignal(0, { cacheId: "shared" });
// a.set(7) updates both a() and b()
```

Custom route (for example, tests or non-URL routing):

```tsx
useSignal(1, { cacheId: "panel", route: "/app/settings", global: false });
```
