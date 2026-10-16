# New web UI (`src/web`)

The new OpenChat web UI, built from `@openchat/ui` (`frontend/openchat-ui`). It replaces the view
layer of `src/components` only: routes, stores, the `OpenChat` client and every backend call stay
as they are.

## Running it

It is opt-in per build with `OC_WEB_LAYOUT=v3`. That's a build-time flag: a build without it leaves
this tree and `@openchat/ui` out of the bundle altogether.

- dev: `npm run dev:web` (from `frontend/`)
- build: `OC_WEB_LAYOUT=v3 npm run build:prod_test` (or any other web build script)

Native builds leave it out for now (see `GAPS.md`).

`selectLayout` (`utils/layout.ts`) mounts it on viewports of 768px and up. Narrower viewports keep
getting the existing apps until the narrow layouts are designed.

## Layout

```
web/
  App.svelte     root: styles, behaviours, i18n bridge, theme on <html>, the client
  i18n.ts        @openchat/ui's copy merged into svelte-i18n, and the translator it is given
  shell/         nav rail, the three columns and the breakpoints, overlays
  features/      one folder per screen/feature (chats, conversation, wallet, …):
    XScreen.svelte   reads stores / the client, renders @openchat/ui components, calls the client
    x.adapter.ts     pure mapping from client data to component props, with a spec
```

## Rules

- Only `XScreen` components touch the client or the stores. `@openchat/ui` components get data
  through props and report actions through callbacks.
- Import library components by file (`@openchat/ui/src/lib/components/Button.svelte`), not from the
  package entry, so a build only pulls in what it uses.
- Don't edit `@openchat/ui` to fit the app.
  A change the library needs goes back to the design export; note it in `GAPS.md`.
- From the existing app, only `Container`, `Row`, `Column` (component-lib) and `VirtualList`
  (`components_shared`) are reused, for layout. Nothing else from `src/components`.
- Colours and font sizes come from the library's tokens only. No hex.
- The URL holds the selected chat / community / channel, the message deep link, the open thread,
  the wallet view and token, and the explore query. Everything else is local UI state.
- Where the design has nothing yet, keep the existing app's behaviour and leave a
  `TODO(design)` comment.
