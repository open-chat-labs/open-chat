# Build brief — OpenChat native app (for Claude Code / the iOS & Android team)

Date: 2026-11-03

## Task
Build the OpenChat iOS and Android apps to the native design. The design is a clickable prototype plus written rules; the visual system (tokens, icons, components) is shared with web.

## Stack
Tauri (Svelte) for iOS and Android, plus mobile web, from the same code. Start from `src/native/NativeApp.svelte` in the `@openchat/ui` export (generated from the prototype; shares `src/lib` and `src/app` with web). Flutter may come later; the design notes are framework-neutral.

## Read first, in this order
1. `docs/Native - Design Notes.md`: the spec. §1 rules (structure, surfaces, sheets/menus/toasts, spacing), §2 Android vs iOS, §3 every screen, §4 data notes, §5 open items.
2. `Native Prototype.dc.html`: the clickable reference. Tweaks: iOS / Android, group role, invite link, empty wallet, signed-out start, theme / accent. Use it to check motion and states, not just layouts.
3. `docs/Native - Component Changes.md`: every library change made for native (props, CSS variables).
4. `lib/tokens.css` and `lib/icons.js`: the source for colours, type, spacing, radii and icons. Map them to platform tokens once; don't hard-code values.
5. Web context only when a screen says "same as web": `docs/Architecture - OpenChat Web UI.md`.

## Before writing code
- Choose the stack (SwiftUI + Compose, or a shared framework) and say how tokens and icons get generated from `tokens.css` / `icons.js`. **Stop and show me.**
- List the screens in §3 and the backend data each needs (agents/canisters already used by web). Mark anything the prototype fakes (see §4).

## Rules
- Five tabs (Chats, Communities, Wallet, Activity, You). Each tab keeps its own push stack; the tab bar hides inside a conversation.
- Pickers and short settings are bottom sheets with the 48px handle, drag to dismiss and a dimmed veil; short value lists use the anchored menu; builders are pushed screens; confirmations are small alerts.
- Long-press opens menus on chats, channels, communities and messages (row lifts in place, screen dims and blurs, menu above or below). No swipe actions on chat rows.
- Scroll ends: tab roots get 48px past the last row above the tab bar; pushed screens without a pinned footer get safe area + 48px; screens with a pinned footer keep 16px above it.
- Lists of selectable rows sit 6px apart; section labels get 16px above.
- Touch targets 44pt (iOS) / 48dp (Android). Every animation has a reduced-motion fallback. Light haptics where the notes say so.
- Sign-in: passkey or recovery phrase only, plus "Link to your account" (6-character code shown on web under Profile → Link a device). No Internet Identity or email sign-in on the app; email is optional recovery only. Permissions are system prompts after account creation.
- CHIT is points, never a token. It never appears in the wallet.
- App-store copy and UI stay chat-first: avoid crypto-forward wording outside the wallet.

## Order of work (one checkpoint each)
1. Tokens, icons, theme (light / dark / system, four accents) and the shell: tab bar, push stacks, sheets, anchored menu, toasts.
2. Sign in and onboarding (§3.1).
3. Chats list and conversation (§3.2–3.3): bubbles, composer with the keyboard-area panels (attach, emoji/GIF), long-press menu, swipe to reply/edit, typing, message info, forward, search.
4. Details, group and community settings (§3.6–3.8), including create group/community and the shared gates, rules and permissions screens.
5. Builders (§3.4): poll, prize, send crypto, swap offer, meme fighter, media and files.
6. Wallet (§3.9): token list, token page, Send, Receive, Swap, PIN sheet.
7. CHIT and the daily puzzle (§3.10), Activity (§3.12), You and settings (§3.11).
8. Calls (§3.5): full screen, picture-in-picture, call pill.

After each step: run on both platforms, compare with the prototype, and list what still uses sample data.

## Watch-outs
- iOS vs Android differences are only the ones in §2 (back affordance, kebab orientation, composer button order, etc.). Don't invent more.
- The prototype fakes timing (quotes, sends, joins, calls). Use real async states with the loading and error states the notes describe.
- Search in the prototype only scans sample messages; the real app must search the message index.
- Interface size (Appearance) is a real setting; wire it to dynamic type / font scale.

- **Late additions (2026-11-03, also in the design notes):**
  - **DMs have no avatars:** received messages start at the left edge. Groups and channels keep avatars and names.
  - **DM typing bubble:** received style, no avatar, 34px tall, small corner top left.
  - **Groups typing:** a 24px strip resting on the composer (overlapping its top padding by 6px), solid chat background, accent text and dots ("Lucy is typing" / "Lucy and Matt are typing" / "3 people are typing"); overlays the messages and takes no row; fades and slides up 8px in, reverses out.
  - **Swipe actions:** the icon sits in the space the bubble frees: reply on the left of received messages, edit on the right of your own. When the action can fire, the circle turns accent and bounces twice.
  - **Edit composer:** keeps the normal border. "Editing" is in accent, the original is clamped to 2 lines, and the gap to the input is tight. Attached images use the same radius as the + tile and don't touch the edge.

## Done when
Every screen in §3 is built on both platforms with real data, light and dark, all accents, reduced motion respected, and no hard-coded colours or sizes.
