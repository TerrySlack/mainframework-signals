# @mainframework/signals

Framework-agnostic signals for the browser, with an optional React hook. Written in TypeScript.

Repository: [github.com/TerrySlack/mainframework-signals](https://github.com/TerrySlack/mainframework-signals)

## Browser only — not for SSR or server

This package requires a **browser** (`window`). When `window` is missing (`typeof window === "undefined"` or `window == null`):

- **`createSignal`**, **`effect`**, **`computed`**, and **`resource`** return **`null`**.
- **`destroySignal`** is a no-op.
- **`useSignal`** returns **`null`**.
- **`domSignal`** and **`useDomSignal`** return **`null`** (hooks still run before that return).

Always check for `null` before use.

**Web Workers** are required for the **10s store janitor** (started on the first **`createSignal()`** or **`domSignal()`** call — including via **`useSignal`** / **`useDomSignal`** — not by **`resource()`** alone) and for **`refetchInterval`**. Environments without `Worker` throw when the janitor starts or when an interval is registered (`assertWorker`).

Signals stay in the store across React unmounts. **Non-global** entries on routes other than the active one are removed on **route change** and on the **10s store janitor** sweep. **`global: true`** entries are kept.

`@mainframework/is-deep-equal` and `@mainframework/timer` are dependencies of this package (installed automatically). You do not import them in application code.

## Installation

```bash
npm install @mainframework/signals
```

```bash
pnpm add @mainframework/signals
```

For **`useSignal`** or **`useDomSignal`**, add peer dependencies in your app: **`react`** and **`react-dom`** (>=17).

## Package exports

| Import | Exports |
|--------|---------|
| `@mainframework/signals` | `createSignal`, `resource`, `effect`, `computed`, `destroySignal`, `isPromiseLike`, and types `CreateSignal`, `Signal`, `Resource`, `SignalOptions`, `SignalInitialValue`, `AsyncSource` |
| `@mainframework/signals/react` | `useSignal`, `UseSignal`, `UseSignalOptions` |
| `@mainframework/signals/dom` | `domSignal`, `destroyDomSignal`, and types `DomSignal`, `DomSignalOptions`, `DomProps`, `DomBacking`, `DomRef` |
| `@mainframework/signals/dom/react` | `useDomSignal`, `UseDomSignalOptions` |
| `@mainframework/signals/dom/internal` | `markDomDirty` only — for compiler-generated code; application code should not import this |

`dist/dom/core.mjs` and `dist/shared/**` ship inside the package and are loaded by relative imports between built files. They are **not** package entry points and are **not** for application imports.

## DOM compile-wiring (build-time)

### Workflows

| Workflow | What you do | Install |
|----------|-------------|---------|
| **A — compile-wired `effect`** | Allowlisted `dom.*` assignments inside `effect`; build-time rewrite via a bundler plugin | `@mainframework/signals` + **one** bundler plugin below |
| **B — `backing` only** | `DomBacking` on `domSignal` / `useDomSignal` | `@mainframework/signals` only |
| **C — mixed** | Avoid same signal in `backing` and compile-wired `effect` on one DOM | A + B packages as needed; still only **one** compile plugin |

### Workflow A quick start

```bash
pnpm add @mainframework/signals @mainframework/dom-signals-unplugin
```

Pick the plugin row for your bundler in the table below (not unplugin if you use Parcel, Metro, or Turbopack). Full configs: each plugin’s npm package page.

### Workflow A bundler plugins

| Package | Bundler | npm |
|---------|---------|-----|
| `@mainframework/dom-signals-unplugin` | Vite, Rollup, Webpack, esbuild, Bun, Rspack, Rsbuild, Rolldown, Farm | https://www.npmjs.com/package/@mainframework/dom-signals-unplugin |
| `@mainframework/parcel-transformer-dom-signals` | Parcel 2 | https://www.npmjs.com/package/@mainframework/parcel-transformer-dom-signals |
| `@mainframework/dom-signals-metro` | Metro | https://www.npmjs.com/package/@mainframework/dom-signals-metro |
| `@mainframework/dom-signals-turbopack` | Next.js Turbopack (`/loader`) | https://www.npmjs.com/package/@mainframework/dom-signals-turbopack |

### Cross-bundler rules

- Register dom compile **once** per app (no Babel dom-compile duplicate on the same files).
- **Vite / Rollup / Rspack / …:** unplugin uses **`enforce: 'pre'`** — see [@mainframework/dom-signals-unplugin](https://www.npmjs.com/package/@mainframework/dom-signals-unplugin).
- **Webpack:** **either** `domCompiler.webpack()` **or** `@mainframework/dom-signals-unplugin/webpack-loader` **last** in `rule.use` (runs first on the file), not both.

### Workflow A end-to-end (sketch)

```tsx
"use client";

import { effect, createSignal } from "@mainframework/signals";
import { useDomSignal } from "@mainframework/signals/dom/react";
import { useRef } from "react";

export const Page = () => {
  const ref = useRef<HTMLHeadingElement>(null);
  const dom = useDomSignal(ref, { cacheId: "page-title" });
  const count = createSignal("page-count", 0);

  if (!dom || !count) return null;

  effect(() => {
    dom.textContent = String(count());
  });

  return <h1 ref={ref} />;
};
```

With a bundler plugin enabled, `dom.textContent = …` inside `effect` is rewritten at build time. See your plugin’s README for setup.

### Troubleshooting

See plugin READMEs (ordering, double registration, silent no-op).

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

## DOM signals (browser)

Import **`domSignal`** / **`destroyDomSignal`** from `@mainframework/signals/dom`, or **`useDomSignal`** from `@mainframework/signals/dom/react`. Same browser and **Web Worker** janitor as **`createSignal`** — one janitor for the shared store; the first **`domSignal`** or **`createSignal`** on the client starts it.

Route purge and lookup follow the same rules as data signals (**`global`**, **`route`**, store maps aligned with **`getStoredSignal`**). **`global: true`** entries are not purged on navigation. Non-global entries on other routes are **`dispose()`**d on route change and on the janitor sweep. Detached entries on the **current** route stay until **`destroyDomSignal`**.

### `domSignal(cacheId, element, options?)`

Returns a cached **`DomSignal`** proxy (or **`null`** when `window` is missing). The second argument is **`HTMLElement | null`**: pass a node to attach it, or **`null`** to clear the element slot.

On each call, if the stored element reference differs from the argument, the instance **`attachElement`**s the new node (or clears the slot for **`null`**). Cache hits ignore new **`backing`** / **`notifyOnWrite`** options — only the first create for that **`cacheId`** / route / **`global`** shape matters.

```ts
import { domSignal, destroyDomSignal } from "@mainframework/signals/dom";

const dom = domSignal("panel-title", document.querySelector("h1"), { global: false });

if (!dom) {
  return;
}

dom.textContent = "Hello";
destroyDomSignal("panel-title");
```

Instance methods:

- **`attachElement(element)`** — Updates the element slot and (re)starts **`backing`** wiring when the node reference changes.
- **`detach()`** — Clears the element slot and stops backing; **keeps** the store entry (React unmount uses this).
- **`dispose()`** — **`detach()`** plus removes the entry from the global map (when global) and the route map for the stored route; clears React bump callbacks for that proxy.
- **`destroyDomSignal(cacheId, options?)`** — Looks up the entry (same **`route`** / **`global`** as create) and calls **`dispose()`** if present.

### `DomSignalOptions`

| Option | Description |
|--------|-------------|
| `global?: boolean` | Keep the dom entry across route purges (global map). Lookup matches data signals: a **`global: true`** hit ignores the route argument. |
| `route?: string \| number` | Override the active route key. |
| `backing?: DomBacking` | Optional one-shot or reactive prop wiring (see below). |
| `notifyOnWrite?: boolean` | Default **`false`**. When **`true`**, proxy sets that actually change an allowlisted IDL prop or **`attr:*`** attribute call **`markDomDirty`** so React can re-render. Compile-wired writes bypass the proxy and do not use this flag. |

### `DomBacking` and workflows

**Workflow A — accessors:** Use the **`DomSignal`** proxy with allowlisted assignments inside **`effect`**. Wire a bundler plugin so the build rewrites those assignments.

**Workflow B — backing only:** Pass **`backing`** so props are applied at runtime (one-shot object or mapped signals/resources). No compile step required.

**Workflow C — mixed:** Do not read the same signal in **`backing`** and in a compile-wired **`effect`** on the same DOM — there is no runtime overlap detector.

Two **`DomBacking`** shapes:

1. **One-shot** — `{ props: DomProps }`. Applied once when wiring starts; values are not read as signals. Re-**`attachElement`** on a different node re-applies the snapshot.
2. **Mapped** — `{ textContent: signal, … }` per key. Each value may be a plain value, a **`Signal`**, or a **`Resource`** (writes follow the same loading/error rules as **`useSignal`** for resources: only the resolved value is written when it is not **`undefined`**).

### `DomProps` (allowlisted proxy keys)

Allowlisted keys use safe **`null`** handling (empty string, **`false`**, or **`removeAttribute("tabindex")`** for **`tabIndex`** — not the string **`"null"`**). **`undefined`** omits a write.

`textContent`, `innerHTML`, `className`, `id`, `value`, `src`, `href`, `alt`, `title`, `placeholder`, `type`, `name`, `htmlFor`, `hidden`, `checked`, `disabled`, `tabIndex`.

**`innerHTML`** is an XSS sink. **`className`** on SVG uses **`SVGAnimatedString`** — the allowlist targets HTML IDL props; SVG styling is outside this list.

### Proxy reads and writes

- Own fields: **`cacheId`**, **`route`**, **`global`**, **`element`**, **`attachElement`**, **`detach`**, **`dispose`** (readonly ids / **`element`** getter tracks the slot).
- Allowlisted keys (above): read/write through **`applyDomProps`** rules when the element is non-null.
- **`attr:<name>`** (for example **`dom["attr:data-id"]`**): **`getAttribute`** / **`setAttribute`** / **`removeAttribute`** for **`null`** / **`undefined`** values. Empty name after **`attr:`** is ignored.
- Other keys present on the element: pass-through get/set; function values are **`bind`**ed to the node (**`focus`**, **`addEventListener`**, etc.).
- Assigning **`dom.element = …`** does not move the node; use **`attachElement`**.

An **`effect`** that reads **`dom.element`** re-runs after **`attachElement`**, including the first client commit while the slot was still **`null`**.

### `useDomSignal(ref, options?)`

Put **`"use client"`** on components that call **`useDomSignal`**. Hooks run unconditionally before the server **`null`** return. Set a stable **`cacheId`** in options when you need a shared instance (omit only when a per-mount id is fine, same idea as **`useSignal`**). **`ref`** must be a ref object (**`{ current }`**); callback refs are not supported.

On the server, layout work uses **`useEffect`** instead of **`useLayoutEffect`** so React does not warn during SSR.

- **Render** — Resolves the cached **`DomSignal`** from the store only; does **not** read **`ref.current`** or attach the node.
- **Layout** — Attaches when **`ref.current`** is non-null and differs from the stored element; **`detach()`** when **`ref.current`** becomes **`null`**.
- **Unmount** — **`detach()`** once (store entry remains).

### Writes, proxy, compile-wiring, and React updates

At runtime, DOM updates go through the **`DomSignal`** proxy unless compile-wired code writes the element directly.

- **Proxy + `notifyOnWrite: true`** — Compare before/after; may **`markDomDirty`** for a React re-render.
- **Compile-wired** — Direct DOM writes plus **`markDomDirty`** from generated **`finally`**; does not double-fire **`notifyOnWrite`**.

At build time, Workflow A plugins rewrite allowlisted assignments inside an inline **`effect`** callback when **`effect`** is imported from **`@mainframework/signals`**. They infer **`const dom = domSignal(...)`** / **`useDomSignal`** bindings; optional plugin options may include a **`bindings`** allowlist. See bundler plugin READMEs for configuration.

React re-render bumps are per **proxy instance** and per registered callback, not a shared route string.

### Lists

Use stable ids (for example **`dom-cell-${id}`**). Row unmount with **`useDomSignal`** calls **`detach()`** only; call **`destroyDomSignal`** when the row should leave the store (vanilla lists often use prefixes like **`dom-row-`**, **`dom-cell-`**).
