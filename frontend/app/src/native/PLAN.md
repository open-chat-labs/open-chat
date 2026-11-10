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
  `@openchat/ui/src/native` ([#10365](https://github.com/open-chat-labs/open-chat/issues/10365));
  N3 the app tree, push stacks and entry
  ([#10366](https://github.com/open-chat-labs/open-chat/issues/10366)): `src/native` behind
  `OC_NATIVE_LAYOUT=v4`, with a placeholder for every screen (`features/app/screens.ts`). What it
  left is in GAPS.md ("Native app tree").
- **Done:** N4 sign in and onboarding
  ([#10367](https://github.com/open-chat-labs/open-chat/issues/10367), #10429): the signed-out
  start (`features/start`), on the client's `signIn` (passkey, linking code) and `signUp`, and
  Android's back before sign-in. What it left (the recovery phrase, which the backend doesn't
  have; the Getting started card, for N5a's Chats root) is in GAPS.md ("Native sign in and
  onboarding").
- **Built:** N5a the Chats tab, its search and New chat
  ([#10368](https://github.com/open-chat-labs/open-chat/issues/10368)), and local pushes for
  screens without a URL. What it left is in GAPS.md ("Native Chats tab").
- **Built:** N12 the You tab and its settings
  ([#10380](https://github.com/open-chat-labs/open-chat/issues/10380)): the You tab with its CHIT
  card and Sign out, Edit profile, Diamond (`?diamond`), and the settings pages (Appearance on the
  same stored theme and accent as Welcome's menu, Notifications, Chats, Communities, Storage, Bots,
  Account, CHIT's at `?profile=chit`), on `logic/profile` shared with the web's profile, and the
  kit's new `NativeAlert`. What it left (buying Diamond, the apps' notifications switch, the
  recovery phrase …) is in GAPS.md ("Native You tab").
- **Built:** N5b the conversation
  ([#10369](https://github.com/open-chat-labs/open-chat/issues/10369)): the header and its menu,
  search in the chat, the messages (the web's mapping, moved to `logic/conversation`), the swipes,
  typing, call items and the media viewer. What it left is in GAPS.md ("Native conversation").
- **Built:** N5c the composer and its keyboard-area panels
  ([#10370](https://github.com/open-chat-labs/open-chat/issues/10370)), to the plan's 05, 06 and
  07: the library's composer as the design's pill, in the platform's order, on the web composer's
  operations (moved to `logic/composer` and `logic/conversation/draftActions`); the slot under it
  that the keyboard, the emoji and GIF panel (Recent, every emoji by category, the emoji search's
  strip on the keyboard, the GIF search grown, GIFs sent as tapped) and the attach panel (the
  phone's recent photos and videos picked straight into the composer, up to ten, the Recents grid,
  the actions) share, each a sheet (06 "Sheet behaviour": 90% grown, the backdrop, the handle's and
  the content's drags). What it left (photos sent a message each, the builders, which are N9's …) is in GAPS.md
  ("Native composer").
- **Built:** N5d a message's long-press menu
  ([#10371](https://github.com/open-chat-labs/open-chat/issues/10371)): the kit's
  `MessageLongPressMenu` (quick reactions and the emoji sheet, Reply, Forward, Copy, Info, Edit,
  Delete with Undo, Report …, on the shared `logic/conversation/messageAction`, which the web's
  menu now runs too), Message info (a pushed screen), the forward sheet (several chats at once,
  with a note: the client's `forwardMessageToChats`), the report sheet, and removing a link's
  preview after a native confirm. What it left is in GAPS.md ("Native conversation").
- **Built:** N6 DM and group details, members and roles
  ([#10372](https://github.com/open-chat-labs/open-chat/issues/10372)), to the plan's 10: a DM's
  details (Call / Search / Mute, About, disappearing messages as a switch, Block) and a group's or
  channel's (Mute / Search / Invite, About, Members, This chat, the rules, Manage for owners and
  admins, Leave and Delete), pushed from the conversation's header; the Members screen with role
  sections, the ⋯'s role changes, Remove and Block as your role allows, and a member's profile
  sheet. On the web panel's logic (`logic/members`, `logic/groupOrCommunity/detailsPermissions`,
  `logic/profile`'s profile card) and the DM settings moved to `logic/chats`. Manage's pages and
  Invite are N7's, pushed as placeholders. What it left is in GAPS.md ("Native details").
- **Next:** the screens. N10a, N11 and N13 need only N3; N7 (group settings) and N8a
  (communities) can start now that N6 is in; N9 (the builders) needs N10b too.

## Workstreams

Foundations:

| Id | What | Needs |
|---|---|---|
| [N1](https://github.com/open-chat-labs/open-chat/issues/10364) | Platform tokens, theme and safe areas | done |
| [N2](https://github.com/open-chat-labs/open-chat/issues/10365) | Shell kit in `@openchat/ui/src/native` | done |
| [N3](https://github.com/open-chat-labs/open-chat/issues/10366) | App tree, push stacks and entry | done |

Screens:

| Id | What | Needs |
|---|---|---|
| [N4](https://github.com/open-chat-labs/open-chat/issues/10367) | Sign in and onboarding | N3 |
| [N5a](https://github.com/open-chat-labs/open-chat/issues/10368) | Chats list, search and New chat | N3 |
| [N5b](https://github.com/open-chat-labs/open-chat/issues/10369) | Conversation | N5a |
| [N5c](https://github.com/open-chat-labs/open-chat/issues/10370) | Composer and keyboard-area panels | N5b |
| [N5d](https://github.com/open-chat-labs/open-chat/issues/10371) | Message long-press menu, message info and forward | N5b |
| [N6](https://github.com/open-chat-labs/open-chat/issues/10372) | DM and group details, members and roles; a DM's disappearing messages as a switch there (not in the conversation's menu) | N5b |
| [N7](https://github.com/open-chat-labs/open-chat/issues/10373) | Group and community settings screens | N6 |
| [N8a](https://github.com/open-chat-labs/open-chat/issues/10374) | Communities tab: switcher, channels and threads; a message's thread: the replies link under messages (hidden until then, `threads: false`) and the thread screen (replies, composer, follow) | N6, N5c |
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

After everything else (decided 2026-11-07):

| What | Why it waits |
|---|---|
| The recovery phrase: Recover account (Welcome back's "Recover with phrase"), the Recovery phrase screen in You → Account, and the Getting started card's backup step | The backend has no recovery phrase yet (none is made at sign-up, nothing signs in with one). The native tree is finished and cut over without it; the design's screens wait for the backend (GAPS.md, "Native sign in and onboarding", "Native You tab") |
| Clear history in a conversation's menu (the prototype has it) | The backend can't clear a chat's history; dropped from N5b's menu until it can (decided 2026-11-07) |

## Invariants

1. Logic the native tree needs is never copied from a legacy component or from `src/web`. It's
   extracted to the shared layer and used by both.
2. `@openchat/ui` never imports `@client` or the app.
3. Until cutover, a build without the native flag leaves the current native UI
   (`components_mobile`) as it was.
4. No hard-coded colours or sizes: tokens only (`tokens.css`, `icons.js`).
5. Every animation has a reduced-motion fallback.
