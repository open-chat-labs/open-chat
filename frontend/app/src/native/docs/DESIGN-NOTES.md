# OpenChat native — design notes

Last updated: 2026-11-03 · Prototype: `Native Prototype.dc.html` (iOS / Android switch, tweaks for role, invite, empty wallet, signed-out start) · Frozen decision canvases: `options/Native - *.dc.html` · Visual system: same tokens, icons and library components as web (`lib/`). Library changes made for native: `docs/Native - Component Changes.md`.

iOS is designed first; Android differs only where listed in §2. Each locked decision names the options canvas it came from.

---

## 1. Rules

### Structure
1. **Rail → tab bar.** Five tabs: Chats, Communities, Wallet, Activity, You. Icon-only, 20px icons in 44px targets, 10px top padding plus safe area. Unread count on Chats, dot on Activity, accessible label on each. The You tab shows the user's avatar (26px; selected = 2px accent ring with a gap) when they have a photo. Tapping an icon bounces it (0.78 → 1.16 → 1, 600ms; off with reduced motion; light haptic on device).
2. **Columns → push stack.** Chat list → conversation → details. The tab bar hides inside a conversation. Each tab keeps its own stack.
3. **Right sidebar → pushed page.** Chat details, threads and members push full screen with the web panel's content and order.
4. **Dialogs → screens or sheets.** Builders (poll, prize, swap offer, meme fighter, create group/community) are pushed screens. Pickers and short settings are bottom sheets. Value lists of a few items use the anchored menu. Confirmations stay small alerts.
5. **Hover → touch.** Long-press opens menus on chats, channels, communities and messages. Chat rows have no swipe actions; swipe is only on bubbles (reply; edit for your own). Nothing is hover-only.
6. **Touch targets.** 44pt iOS, 48dp Android.

### Surfaces and theme
- **One page colour.** Every screen sits on `--surface-0`. Raised elements (`--surface-1`+) are sheets, menus, popovers. In-page panels and inputs use `--overlay-1`.
- **Light theme.** Native light uses white pages: `--surface-0` and `--surface-1` #FFFFFF, `--surface-2` and `--field` #F4F3EF. Apply as `[data-platform="native"][data-mode="light"]`; web tokens unchanged.
- **Accent hero cards** (CHIT, Diamond…) blend the accent into `--hero-base` (dark #14141a, light #FFFFFF); rows and pills inside use `--tint-row` and `--tint-pill`.
- **Calls stay dark** in both themes (screen #050507, light status-bar glyphs), including the minimised call. The in-chat live pill and header call strip follow the theme.

### Sheets, menus, toasts
- **Sheets:** 48 × 4px handle (2px radius, `--overlay-3`), `surface-1`, 22px top radius, dim veil. Slide up 320ms ease-out; close slides down 280ms. Handle and header drag: past 30% of the height or a downward flick closes, otherwise springs back; pulling up rubber-bands 24px. Sheets that change content (search → results → confirm) keep one fixed height.
- **Anchored menu:** surface-2, 16px radius, 48px rows with icon + label, scales in from the anchor corner, opens below (above near the bottom). Submenus replace the content in place with a back row.
- **Long-press row menus:** screen dims and blurs, a copy of the row lifts in place (original hides), haptic, menu below or above.
- **Toasts** sit above the tab bar and over the FAB. Destructive actions (leave, delete, archive, clear, block, remove) show Undo.

### Spacing
- **Scroll end padding:** the scrolling list itself gets the big end padding (48px above a tab bar; safe area + 48px on pushed screens) so its last row scrolls clear of the bottom. A pinned footer only needs the safe area.
- **Picker rows** (tokens, people, chats, languages) sit **6px** apart, 60–64px tall, 12–14px radius, in the same 16px gutter as the search field above them. A section label inside a list has 16px above it (8px when it's first under search).
- **Settings cards:** grouped rows with full-width 1px dividers; rows carry the 16px padding. Section labels get 4px left padding.
- **Switch help text** describes what the setting is and never changes with the switch state.
- **"View all"** is the one label for section links to a full list (optionally "View all · 24"); 44px hit area.

## 2. Android vs iOS

Same screens and content, with our own components and font.

| | iOS | Android |
|---|---|---|
| Back | chevron, edge swipe | arrow; system back also closes sheets/menus first |
| Kebab | horizontal dots | vertical dots |
| Composer order | + · input · emoji · mic/send | emoji · input · + · mic/send |
| Touch target | 44pt | 48dp |
| Press feedback | highlight | ripple |
| System bars | status bar + home indicator | edge-to-edge status + gesture bar |

## 3. Screens

### 3.1 Sign in and onboarding
- **Welcome headline:** "Fully featured." in primary ink, "Fully yours." in accent.
- **No Explore and no guest mode** in the app. No crypto, tokens or wallet on welcome or onboarding (negative associations, harder App Store review). Lead with "a chat app owned by the people who use it".
- **Welcome** (`Welcome Options` 1k, top row revised 2026-11-02): top row = OpenChat lockup (24px logo, "OpenChat" 20px) on the left; one split pill on the far right: Appearance (theme icon + accent dot + chevron) | language (globe + ISO code + chevron), with a 1px divider; each half opens its own menu / sheet. Language pill (ISO code only → language sheet with search; rows keep the flag, native name, English name, code) and one Appearance pill (theme icon + accent dot → menu: Theme Light / Dark / System, Accent swatches; both live). Headline 40px/800 "Fully featured." (secondary ink) / "Fully yours." (accent), static, 28px above the cards, aligned with the first card's text. Three straight floating proof cards (community vote, a community to join, the chat reacting when it ships) with 4px cut-out borders, lower card in front, 28px above the buttons. Create account (passkey icon) and I already have an account, 12px apart, then Terms.
- **Pick a username** (`Pick Username Options` 2a): back to Welcome; 148px tappable avatar (initial until a photo; camera badge), "What should we call you?", @ field with live check, optional Recovery email (recovery only, never shown; invalid blocks Continue). Bottom: the inviter card when opened from a link, otherwise the referrer row; then Continue. The real app shows the OS passkey prompt on Create account; the prototype skips it.
- **Referrer** (not invited): an outlined 52px row "Did someone refer you? · Optional" opens a sheet (`Referrer Sheet Options` 2d): warm header (you + them joined by an accent heart, "Who told you about OpenChat?"), library search field, and before typing one card with Scan their QR code · Paste their invite link. Results: avatar, name, @handle, Select. Picking goes to the confirm step (`Referrer Confirm Options` 3c): header leaves, 112px avatar with a heart badge, name, handle, a "From their invite link / QR code" pill when relevant, one line on what happens, "That's them" / "Pick someone else". The row becomes "Referred by Lucy · You'll start in a chat with Lucy" with ×. Same sheet height throughout. On Continue the referrer gets credit and becomes the first chat, exactly like an invite.
- **Welcome back** (`Welcome Back Options` 1a): a pushed page. Three cards 14px apart: Sign in with passkey (accent, "Fastest"), Recover with phrase, Link with existing account; "New to OpenChat? Create an account" below. No Internet Identity or email sign-in in the app.
- **Recover account** (`Recover Options` 3a): key icon in a ring that fills per word; 3×4 tiles that turn accent as words land (tap to edit from there); one input with Paste and suggestions from the recovery word list (unique match fills after 3 letters; non-list words refused); checksum message; "Your phrase never leaves this phone."; button counts down to "Recover account".
- **Link to your account** (`Link Account Options` 4d): "ON YOUR COMPUTER" card (Open oc.app · Go to Profile → Link a device; code changes every few minutes), then "ON THIS PHONE": six 68px tiles for a 6-character code (not case sensitive, one-time-code autofill), hint + Paste. Sections 34px apart. Button counts down → "Link this phone" → "Linking…". Web needs the matching Profile → Link a device.
- **Small phones (375 × 667, checked 2026-11-02):** Welcome scales the proof cards to 78% and the headline to 32px (still aligned with the first card's text); Pick a username shrinks the avatar to 104px with an 18px gap, so the recovery email stays visible above the invite card. Prototype tweak: "Small phone (375 × 667)".
- **Split pill tap areas:** both halves have 44px tap areas while the pill stays 36px.
- **Transitions:** going deeper, the new screen slides in from the right while the old one slides out left; going back reverses it (.34s). First Welcome appears without animation.
- **After sign-in:** the system notifications dialog, then Chats.
- **Getting started card** (new accounts only), top of Chats: progress bar, "1 of 4 done", steps Add a profile photo · Say hi to {inviter} (or Start your first chat) · Claim your first CHIT · Back up your recovery phrase. Ticks when done; "You're all set" with close when finished.
- **Recovery phrase:** its own screen (from the checklist and You → Account → Recovery). 12 words in a 3-column grid, blurred until tapped; Copy phrase once revealed (clipboard clears after a minute); never-share warning; pinned "I've written it down".

### 3.2 Chats
- **Header:** "Chats" 21px extra-bold (all tab titles), CHIT button (bolt, CHIT colour, dot when claimable), kebab → menu: New group, Mark all as read.
- **Search:** tapping the field lifts it into a search screen (field slides into the title row, Cancel slides in, results fade in; Cancel reverses). Empty: "Search for: Chats · People · Messages". Results: Chats, People (not yet a chat), Messages (newest first, snippet around the match, match in bold), 3 / 3 / 5 with Show all. A message result opens the chat in search mode on it.
- **List:** compact filter (`SegmentedTabs` 40px), 14px gap, pinned first (accent pin). Row icons for favourite, muted; forward icon before the preview when the last message was forwarded. Live call → "Voice call in progress".
- **FAB:** Chats root only; 56px, 18px radius, accent +; 16px from the edge above the tab bar; fades out on scroll down and when anything covers it. List bottom padding 104px. Opens **New chat**: user search, New group row, Frequently contacted (or empty state). Picking someone opens the chat and the New chat screen drops out of the stack.
- **Row long-press:** Pin, Favourite, Mute (1 hour / 8 hours / 1 week / ever), Mark read/unread, Archive; red Leave group / Delete chat.

### 3.3 Conversation
- **Header:** white chevron, avatar, name + status, video, voice, kebab (Search in chat, details, Mute, Favourite, Disappearing messages; Clear history; Leave group / Block).
- **Messages:** received avatar top-aligned on the first of a run; 6px within a sender, 16px between senders; sent bubbles right with mirrored corners. Swipe right to reply (your own: edit).
- **In-chat search:** header becomes a search bar ("2 of 5", up = older, down = newer); the current match is highlighted and scrolled to the upper third.
- **Long-press menu:** bubble stays put; a copy sits over it above the dimmed, blurred chat. Reactions bar and action card align to the bubble's start (received) or end (sent) edge, 12px from screen edges. Placement order: reactions above + menu below → menu above + reactions below → both above → both below. Everything fades together on close. Items include Reply, Forward, Copy, Info, Edit, Delete, Report (divider only above destructive). No hover bar on native.
- **Message info:** the message on a chat-coloured panel, then Status (DM), Read by / Delivered to (groups), Forwarded, Edit history, Reactions.
- **Forward:** sheet with the message preview, chat search, multi-select rows, optional note, "Forward to 3 chats"; copies are marked Forwarded.
- **Composer:** `MessageComposer` as a pill (`--composer-radius` 30px, `--composer-btn` 44px round, `--composer-min-h` 52px, `--composer-pad` 4px). Mic becomes Send when there's text.
- **Keyboard-area panels** (locked 2026-10-23): keyboard, emoji and attach panels share one slot; + and emoji toggle (× / keyboard glyph).
  - **Attach:** gallery strip (Camera, last 100 photos/videos, All photos), 3×2 actions (File, Poll, Prize, Send crypto, Swap, Meme fighter). Selected media gets a 3px accent border and a numbered corner tab (max 10); "Attach N". Dragging the handle grows it into the Recents grid (3 columns), stopping below the status bar.
  - **Emoji:** Emoji / GIF switch + search, 8-column grid, category bar, backspace. Searching expands it so the keyboard never covers results. GIF taps send.
  - **Mobile web:** no gallery strip; centred 4-column actions. Desktop web keeps popovers.
- **Call items:** live calls are a compact centred two-line pill ("Voice call in progress" / "12:45 · 3 people", Join or Leave) in web's live colours; ended and missed calls use `CallEvent`. The header "call in progress" strip only shows while the live item is off screen.

- **No avatars in DMs (2026-11-03):** received messages in one-to-one chats have no avatar column and start at the left edge; groups and channels keep avatars. Native only (web keeps them).
- **Typing (2026-11-03):** DMs show a received-style typing bubble (three dots, no avatar) at the end of the chat. groups and channels show a 24px strip resting on the composer (overlapping its top padding by 6px), solid chat background, accent text and dots ("Lucy is typing" / "Lucy and Matt are typing" / "3 people are typing"); overlays the messages and takes no row; fades and slides up 8px in, reverses out.
- **Media viewer (2026-11-03):** tapping a photo, video or album opens the library MediaViewer full screen (same as web): sender + time, Download / Reply / Forward / Close, drag left/right between items: the item follows the finger, release past ~22% or flick to slide the next one in, otherwise it springs back (dots + "2 / 5" under the reactions, no arrows), caption, quick reactions + emoji picker, pinch / double-tap zoom (no zoom buttons) with pan only where the image overflows and a rubber-band edge. All chrome, header included, fades after 3s; a single tap on the photo shows or hides it (double-tap still zooms). Download saves to Photos.

### 3.4 Builders (attach panel)
- **Shared:** pushed screens; the pinned 52px button says exactly what attaches or why it can't. Attaching returns to the chat with a chip for a caption (Edit reopens). Transfer, prize and swap offer ask for the PIN before posting.
- **Poll:** question (autogrow), answers (`SortableInputList`, new row added automatically), Ends after (six durations, 3×2 pill chips). Pinned Settings row (opens the settings sheet: Public votes, Multiple answers, Lock votes, Hide results) above Publish poll.
- **Send crypto:** To (fixed in a DM; member sheet in groups), Token sheet, amount with ≈ value and 25 / 50 / 75 / Max, fee + total.
- **Prize:** Token, total, Winners stepper, Ends after, Who can claim chips (all must be met), fees inline.
- **Swap offer:** You offer → You want, Offer expires, rate vs market, escrow note.
- **Meme fighter:** template grid → editor with live preview → attaches as an image.
- **File:** system picker.

### 3.5 Calls
- **Starting:** video and voice in chat headers. DMs ring first; a group with a live call shows Join.
- **Screen:** full screen, slides up. Minimise, name + timer, people count. Video: up to 3 people stacked with your camera as a draggable floating tile (snaps to six spots); 4+ people in a 2-column grid. Active speaker gets a green ring. Camera-on tiles show a person silhouette placeholder. Voice: centred avatars with speaking rings.
- **Controls:** 52px round buttons with labels, spread evenly. Video: Mute, Camera, Speaker, Leave; flip camera is a 32px button on your own tile. Voice: Mute, Speaker, Video, Leave. Speaker is a toggle; with headphones it opens an output menu. In video calls the controls hide after 4s and the video grows by half their height; tap to show.
- **Minimised:** draggable, snaps to six spots; video tile or voice pill; tap to reopen. System picture-in-picture on device.

### 3.6 Details
- **DM details:** cover with back, favourite and kebab as solid round buttons; 88px avatar with a 4px cut-out ring; tiles Call / Search / Mute; About (bio, Member since, CHIT earned); This chat (Disappearing messages, Read receipts); Block.
- **Group details:** cover, 88px avatar, "Private · 48 members"; tiles Mute / Search / Invite; About (description, Created, History); Members (avatar stack → Members screen with role sections and a ⋯ to change roles or remove); This chat; Rules read-only for members; Manage for owners/admins (Access gates, Rules, Permissions, Bots and webhooks, Stats); Leave / Delete group.
- **Roles:** the ⋯ on a member below you offers any role up to your own (several owners allowed). Role items only appear if your role meets the "Change member roles" permission, and Remove only if it meets "Remove / block members"; with neither, the ⋯ says so in a toast.

### 3.7 Group and community settings (shared screens)
- **Create group:** Members (search, placeholder row "No one invited yet" that wrapping chips replace, divider, checkbox list) → Details (photo, name, description, Settings card: Public group, Message history, Disappearing messages, Access gates, Rules, Permissions; all optional).
- **Access gates:** intro, Gates card, then a Gate settings card. Simple gates (Unique person, Diamond, Lifetime Diamond) are switch rows. Gates with setup (Payment, Minimum token balance, Neuron holder, Minimum CHIT) are chevron rows that open a two-step sheet (pick token / nervous system, then set the value; multiple entries, any one satisfies); Remove gate with Undo. Gate settings: Members must meet (All gates / Any one gate) and Re-check members (Never / Weekly / Monthly / Quarterly), always visible, dimmed until they apply. No NFT or credential gates; no presets.
- **Rules:** Enable switch, template cards, auto-growing text.
- **Permissions:** Members and Moderation rows with role on the right (accent when changed) → role menu; Messages card with "Customise per message type" (rows appear under the switch); Threads card with "Separate thread permissions"; Reset to defaults.

### 3.8 Communities
- **Header:** 42px rounded-square avatar, name (17px bold), "Public · N members", kebab (Invite people, Mute all channels, Mark all as read, Manage, Leave). Tapping opens community details.
- **List:** Threads row (no background, aligned to channels) → thread list grouped by channel (All / Unread) → ThreadPanel. Channels as `ChatRow kind="channel"` (lock for private; "Not joined · tap to read" for channels you're not in). All avatars on this screen are 42px from the same 18px edge.
- **Switcher strip ↔ sheet:** one surface driven by `f` = (height − collapsed) ÷ (max − collapsed). Strip row fades out over f 0 → 0.4; search, list and Explore / Create fade in over 0.4 → 0.8; fill, radius, dim follow f. Follows the finger; release decides by flick (> 0.45 px/ms), quick drag (> 56px in 260ms), else f > 0.5. Strip fades in place when switching to the tab. Sheet rows 58px, 12px apart, drag to reorder.
- **Explore** (from the sheet and the strip's compass): search + language button (opens a multi-select language sheet; chosen languages show as pills). Featured 300px cards; shelves Popular, Fastest growing, Most active, Recently added (3 rows per column, swiped; hidden under 3); View all pushes the ranked list. Thin languages fall back to one plain list. Member counts as people icon + "12.9k".
- **Preview:** cover, avatar, about, Requirements card with your status per gate, Channels (tap to read a channel with a join bar instead of the composer). Join sheet checklist; "Pay 3 ICP and join". After joining you land in the community.
- **Community details:** members see read-only Channels, Rules and Access gates. Owners/admins get Manage: Channels (reorder with the drag grip, edit, add), User groups (members picked from the community), Invite and share (link switch, copy, share, reset), Access gates, Rules, Permissions, Bots and webhooks, Stats.
- **Create community** (Diamond only; upsell otherwise): 1 Details (banner, avatar, name check, description, language sheet) · 2 Channels · 3 Settings · 4 Invite. Opens the new community with its strip collapsed.

### 3.9 Wallet
- **Root:** "Wallet" with All activity and settings icons. Total (tap cycles display currency), hide eye after it, "today" pill. Send and Receive 56px, Swap 56px square icon. Token rows without background: symbol + price pill over name; amount over value; share bar. 26px total → buttons, 34px buttons → tokens.
- **Below the tokens:** Small balances row (coins icon circle, "3 small balances", total, expands into a compact list) and Supported tokens row (search icon circle, "11 you can receive" → Supported tokens sheet), one divider between them.
- **Empty wallet:** $0.00; Receive primary, Send/Swap disabled ("Add funds first"); welcome card with @username; Supported tokens with "View all · N".
- **Token page:** symbol + price pill in the header, kebab (Send / Receive / Swap, Copy ledger ID). Avatar beside a 28px amount with symbol in secondary ink, hide eye, value; share of wallet; Send / Receive / Swap [token]; filtered day-grouped activity. 30px from header to balance.
- **Flows:** Send / Receive / Swap from Wallet ask for the token first (sheet); from a token page it's filled. Receive: QR card, address (middle dimmed), network chip, warning, Copy / Share. Send: token, recipient sheet, amount, message, fee, PIN, receipt. Swap: You pay / You get cards, slippage, Get quote (best of all exchanges, named), PIN, Deposit → Swap → Withdraw. Done lands on the sent / received token's page.
- **PIN sheet** (`PIN Sheet Options` 1a): no header label; "Enter your PIN" and a chip "Send **25 ICP** to Julian"; dots; keypad.

### 3.10 CHIT and daily puzzle
- **You tab CHIT card** (`You CHIT Options` 1a): accent hero; 44px bolt tile, balance + "CHIT", streak pill; footer rows Daily claim (confetti inside the screen) and Daily puzzle (only when opted in).
- **CHIT screen:** hero (balance, lifetime, streak, 7-day strip, 52px Claim, insurance row, puzzle row) → Streak milestones → Achievements (4 latest, View all → Achievements screen) → Claim history calendar (always six weeks; Local / UTC toggle on the card). Gear → CHIT settings screen.
- **Streak insurance:** screen with 7-slot holding, stepper, price ladder, pinned "Buy N days · X CHAT".
- **Daily puzzle:** its own screen (PuzzleDialog `layout="screen"`). Tutorial: dots centred, text Back / Next, inline Start on the last step. Play: board centred, Undo / Reset / Hint at the bottom. Solving plays the "Challenge solved" banner first (tap to skip), then the solved screen (160px trophy, time, next puzzle countdown, tiles, Share to chat + Done).

### 3.11 You and settings
- **You tab:** cover (Share, Edit), 88px avatar, name + Diamond pill, CHIT card, About (bio, copyable User ID, Member since), Account and Settings lists, Sign out.
- **Settings screens** share one row kit: switch with help, value (anchored menu), link, copy, segmented, swatches, meter, action. Screens: Edit profile (live username check, Save only when changed), Diamond, Appearance (Mode, Accent, Chat text size), Notifications (master switch locks the rest), Chats, Communities (per-community names), Storage (meters, clear cache with Undo), Bots (copyable connection details), Account (Recovery phrase, sign-in methods, Report an issue, Delete account), CHIT.

### 3.12 Activity
- Title, "Mark all read" (fades, never shifts the layout), All / Mentions / Payments with badges only for unread, day-grouped `ActivityRow`s (dot marks unread, no tint).

## 4. Data notes
- **Per-token daily change** isn't tracked, so it isn't shown. **Total "today"** is computed on the device from hourly snapshots in the display currency; hidden until 24 hours exist.
- **Price pill** hidden on the token that matches the display currency.
- **Swap quotes** ask every supported exchange and show the best.
- **Referrals** come from the invite link or QR code, or the user's pick in the referrer sheet.

## 5. Open
- **Library:** compact `SegmentedTabs` size option (replaces the per-screen override); shared native tab bar, page header, sheet and anchored menu components.
- **Web catch-up:** done 2026-11-02 (referrer on web sign-up; Link a device already existed on web; recovery phrase stays native-only).
- **States still to check:** keyboard-up on every builder, loading skeletons, and a small-phone pass beyond sign-in.
- **Re-export** the library components changed for native (see the component changes doc).
