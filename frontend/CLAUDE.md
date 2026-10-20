# Frontend principles

These rules exist to keep the frontend's architecture intact as many people and sessions change it. Follow the existing pattern named here, not the nearest file you happen to read: plenty of code predates these rules. If a task needs a pattern this file doesn't cover, propose it and ask before building it.

Rules marked (lint) fail `npm run lint`. The rest are checked in review.

## Packages and layering

The packages are `app` (Svelte website), `openchat-client` (`@client`), `openchat-worker` (`@worker`), `openchat-agent` (`@agent`), `openchat-shared` (`@shared`) and `component-lib`. They resolve through path aliases from one root `package.json`.

- The app imports `@client` and `@shared`, top level only. Never `@agent`, `@worker` or a deep `@client/...` path. Specs may reach inside `@client` to build its internal state. (lint)
- Only `openchat-agent` talks to canisters or IndexedDB. Any exception goes on a named allowlist with a reason.
- Only config modules read `import.meta.env`. Everything else takes config as a value.

## The client

`OpenChat` (`openchat-client/src/openchat.ts`) is the gateway to the worker and agent. It is a thin wrapper that handles errors and maps responses. Logic lives in pure functions in other modules, which the client calls; that keeps the logic testable. The file's size is not the concern. Its public surface is.

- Keep the public surface small. A method belongs on `OpenChat` only if it calls the worker or changes client state. Reading state, including the current user, is not a reason: components read the global stores directly.
- Pure functions are imported from `@client`, not exposed on the instance. Don't add fields like `formatTokens = formatTokens` or one-line methods that forward to a pure function; remove existing ones when you touch them.
- The client owns an operation end to end. Every step that doesn't need the user goes in one client method that returns an outcome union, e.g. `joinGroup(group, gateCheck?)` returning `success | login_required | needs_gate_evaluation | gate_check_failed | blocked | failed`. Avoid one method that hands data out and another that takes the same data back while the logic sits in the component. Flows still built the old way are listed on umbrella issue #9884; don't copy them. Example to avoid: `CreateOrUpdateGroup.svelte` computes permission diffs and dirty flags with client helpers, then passes them back to `updateGroup`.
- A failure outcome the user should see carries a `ResourceKey`, built by a pure mapping function exported from `@client`. The app decides whether it becomes a toast, an inline error or nothing. Keep separate `kind`s only for outcomes the caller branches on.
- Passing back a price the user agreed to is fine. `payForDiamondMembership(expectedPriceE8s)` and `swapTokens(minAmountOut)` take the value the user saw so it can't change underneath them.
- Return only what the caller needs. If the user can't do anything about the failure reason, return a boolean. Return a `kind` union only when the caller branches on the reason. Log the detailed cause either way.
- The client never shows UI. Toasts and modals belong to the app.

## Components

The desktop tree is `app/src/components/` and the mobile tree is `app/src/components_mobile/`. The long-term direction is that most components live in `app/src/components_shared/`, and only genuinely different ones stay platform-specific. Differences between the two theming systems currently stop many components from moving; that is being fixed.

The mobile tree shows the preferred way to build components. An app component composes components from `component-lib` and has little or no custom CSS of its own. `component-lib` holds the pure UI pieces with no business logic. Many desktop components don't work this way yet, but that's the direction for them too. Example: `components_mobile/home/wallet/EditRecipient.svelte`.

- In the mobile tree, build app components from `component-lib`. If a UI piece is missing, add it to `component-lib` instead of styling it locally in the app component.
- Keep custom CSS in app components to a minimum. Layout belongs to `component-lib` containers.
- The desktop tree can't use `component-lib` yet because the theme systems are incompatible. Until that's fixed, desktop code keeps using the desktop primitives (`components/Button.svelte`, `ModalContent`, `Overlay`) and the desktop theme variables. Don't start migrating desktop components to `component-lib` ahead of the theming work.
- A new component that would be identical in both trees, or could be made identical with a prop, goes in `components_shared/`.
- Never create a new byte-identical copy across the trees. The one exception is a file whose relative imports pull in platform-specific components (e.g. the timeline events that render `home/NonMessageEvent.svelte`): the text is the same but each copy renders differently.
- Import shared components with the `@shared_components/` alias.
- Use theme tokens, not hard-coded colours: the `component-lib` tokens in the mobile tree, the desktop theme variables in the desktop tree.
- Show translated text with `<Translatable resourceKey={i18nKey(...)} />`. Use `$_` or `interpolate` only where a component can't go, such as an attribute or a string handed to non-Svelte code.
- Components get the client with `getContext<OpenChat>("client")`.
- Navigate with `navigate()`, never page.js directly. (lint)
- No Svelte component tests. Logic that needs a test moves out of the component into a `.ts` module.

## State

- Always write Svelte 5 syntax: runes (`$state`, `$derived`, `$props`), `onclick` not `on:click`, snippets not `<slot>`. Svelte picks the mode per component, so a component with no runes silently compiles as Svelte 4, where a plain `let` is reactive and `x = x` forces a re-render. Never rely on that.
- Where state lives depends on its lifespan. App-global state, including anything that must outlive the component that set it, is a custom store. Transient UI state is runes. Operations are client methods: they keep nothing on the `OpenChat` instance, but may write global stores, the way `voteOnProposal` writes `proposalVotesStore` and `registerPollVote` writes `localUpdates`. Don't put a global-lifespan rune class in `components_shared/` to hold state a client operation writes.
- Component-local state uses runes.
- State scoped to a screen or feature, shared between that feature's components, goes in a rune class in a `.svelte.ts` file. Example: `components_mobile/home/wallet/walletState.svelte.ts`.
- A user flow with multi-step UI state (gate approvals, dirty flags, form validation, call state) gets one such module in `components_shared/`, used by both trees. It never calls `navigate`, `toastStore` or `publish`: it returns outcomes and the component reacts. Never implement a flow inside a component or copy it per tree. When consolidating a flow that exists in both trees, start from the mobile version.
- App-global or performance-sensitive state uses the custom stores in `openchat-client/src/utils/stores.ts`. Runes can be slow at that scale.
- A custom store's `.value` is a snapshot of its current value, deliberately not reactive. Code that needs to react subscribes: `$store` in a component, `createSubscriber` (`svelte/reactivity`) in a rune class, as `TokenState` and `GateEvaluation` do. Reading `.value` inside `$derived` computes once and never updates.
- A function a derived store calls takes everything it reads as arguments, and the derived store lists each one as an input. Never read another store's `.value` from inside it: the derived store won't recompute when that store changes. Some older merge helpers in `openchat-client/src/utils/chat.ts` still do this; it was judged harmless and left alone, so don't copy them.
- No new `svelte/store` imports; type-only imports are fine. Files that already use it are on an allowlist in `eslint.config.mjs`: move one to runes or custom stores when you touch it and take it off the list. Never add to it. (lint)
- Use `$effect` as little as possible; it fires more often than you expect. Prefer `$derived`, an event handler, or a method on a state class.
- Mutations the user sees should update optimistically through `localUpdates` and the undo it returns, not a hand-written inverse. The next sync corrects the cache.

## Types

Types matter here more than anywhere else in the codebase.

- No `any` (lint). No `unknown` unless it's unavoidable, such as at a parse boundary. No `as unknown as`.
- Get the cardinality right. If some field combinations are impossible, use a sum type, not a product type with optional fields. `RemoteData` in `app/src/utils/remoteData.ts` is the model:
  ```ts
  // not this: four optional fields allow 16 states, most of them nonsense
  type Load<T> = { loading: boolean; data?: T; error?: string };
  // this: exactly the four real states
  type RemoteData<T, E> = Idle | Loading | Error<E> | Success<T>;
  ```
- Discriminate unions with a `kind` field and string-literal values. Prefer string-literal unions to enums.
- Prefer explicit types to inference: annotate exported functions' parameters and return types, public client methods, and non-trivial `$state`.
- Domain types live in `openchat-shared`. Search there before defining a type, and don't define the same concept twice.
- `@ts-expect-error` with a reason, never `@ts-ignore`.

## Code hygiene

- New code uses `await`, not `.then` chains.
- Search for an existing util before writing one. `list.ts` and `url.ts` already exist in more than one package and have drifted apart; don't add a third copy.
- Only errors someone can act on go to Rollbar (through the logger or `client.logError`). Use `console` for everything else: sending everything to Rollbar buries the errors that matter.
- File size is not a reason to split a file.
- Tests are co-located `*.spec.ts` files run from the root vitest config.
