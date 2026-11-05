# The native tree: what's left, and in what order

The iOS and Android apps (Tauri) and narrow mobile web, built to the native design: a tree of their
own, `app/src/native` (beside `src/web`), on the shell kit in `@openchat/ui/src/native`. It's the
epic [#10363](https://github.com/open-chat-labs/open-chat/issues/10363); each workstream below is an
issue under it, linked from its id. It replaces `components_mobile` at cutover (N15).

- **The design:** `docs/` here: the Build Brief, the Design Notes (the spec: §1 rules, §2 iOS vs
  Android, §3 every screen) and the Component Changes (what the library changed for native), as the
  design export of 2026-11-03 has them, unedited (a later export replaces them whole). The
  clickable reference is the export's `src/native/NativeApp.svelte`: one generated file with sample
  data, checked against, never pasted from and never committed.
- **The rules:** `frontend/CLAUDE.md`, `src/web/README.md`'s rules and the web epic's (A1–A4) apply
  here too. Logic the native tree needs is never copied from a legacy component or from `src/web`:
  it's extracted to the shared layer (the client, `@client`, `app/src/logic`, `app/src/core`, a
  shared util) in the PR that needs it, and used by both. `README.md` says how the tree is put
  together.
- **Order:** the Build Brief's checkpoints. Each issue says what it needs; anything whose needs
  have landed can be taken by whoever is free. After each checkpoint: run on both platforms, compare
  with the prototype, and list what still uses sample data.
- **What's missing** (from the app, the library or the design) goes in `src/web/GAPS.md`, under
  "Native", until the native tree has enough of its own to need a separate file.

## Where we are

- **Done:** N1 platform tokens, theme and safe areas
  ([#10364](https://github.com/open-chat-labs/open-chat/issues/10364)); N2 the shell kit in
  `@openchat/ui/src/native` ([#10365](https://github.com/open-chat-labs/open-chat/issues/10365)).
- **In progress:** N3 the app tree, push stacks and entry
  ([#10366](https://github.com/open-chat-labs/open-chat/issues/10366)).

## Workstreams

Foundations:

| Id | What | Needs |
|---|---|---|
| [N1](https://github.com/open-chat-labs/open-chat/issues/10364) | Platform tokens, theme and safe areas | done |
| [N2](https://github.com/open-chat-labs/open-chat/issues/10365) | Shell kit in `@openchat/ui/src/native` | done |
| [N3](https://github.com/open-chat-labs/open-chat/issues/10366) | App tree, push stacks and entry | N1, N2 |

Screens:

| Id | What | Needs |
|---|---|---|
| [N4](https://github.com/open-chat-labs/open-chat/issues/10367) | Sign in and onboarding | N3 |
| [N5a](https://github.com/open-chat-labs/open-chat/issues/10368) | Chats list, search and New chat | N3 |
| [N5b](https://github.com/open-chat-labs/open-chat/issues/10369) | Conversation | N5a |
| [N5c](https://github.com/open-chat-labs/open-chat/issues/10370) | Composer and keyboard-area panels | N5b |
| [N5d](https://github.com/open-chat-labs/open-chat/issues/10371) | Message long-press menu, message info and forward | N5b |
| [N6](https://github.com/open-chat-labs/open-chat/issues/10372) | DM and group details, members and roles | N5b |
| [N7](https://github.com/open-chat-labs/open-chat/issues/10373) | Group and community settings screens | N6 |
| [N8a](https://github.com/open-chat-labs/open-chat/issues/10374) | Communities tab: switcher, channels and threads | N6 |
| [N8b](https://github.com/open-chat-labs/open-chat/issues/10375) | Explore, preview, join and create community | N8a, N7 |
| [N9](https://github.com/open-chat-labs/open-chat/issues/10376) | Builders: poll, prize, send crypto, swap offer, meme fighter, file | N5c, N10b |
| [N10a](https://github.com/open-chat-labs/open-chat/issues/10377) | Wallet root and token page | N3 |
| [N10b](https://github.com/open-chat-labs/open-chat/issues/10378) | Wallet flows: Send, Receive, Swap and the PIN sheet | N10a |
| [N11](https://github.com/open-chat-labs/open-chat/issues/10379) | CHIT, the daily puzzle, streak insurance and claim history | N3 |
| [N12](https://github.com/open-chat-labs/open-chat/issues/10380) | You tab and settings | N3 |
| [N13](https://github.com/open-chat-labs/open-chat/issues/10381) | Activity | N3 |
| [N14](https://github.com/open-chat-labs/open-chat/issues/10382) | Calls: full screen, picture-in-picture and call pill | N5b, web 7a |

Last:

| Id | What | Needs |
|---|---|---|
| [N15](https://github.com/open-chat-labs/open-chat/issues/10383) | Cutover: Tauri and mobile web switch to the native tree | all |

## Invariants

1. Logic the native tree needs is never copied from a legacy component or from `src/web`. It's
   extracted to the shared layer and used by both.
2. `@openchat/ui` never imports `@client` or the app.
3. Until cutover, a build without the native flag leaves the current native UI
   (`components_mobile`) as it was.
4. No hard-coded colours or sizes: tokens only (`tokens.css`, `icons.js`).
5. Every animation has a reduced-motion fallback.
