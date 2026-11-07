<!-- A conversation (native design notes §3.3): pushed over the Chats (or a community's) root, with the
     whole window. The header (back, the avatar, name and status, video and voice, the kebab: Search
     in chat, details, Mute, Favourite, Leave group / Block / Delete),
     which turns into the in-chat search bar; the live call strip while the live call's item is off
     screen; the messages (core/ChatEventList: paging, deep links, read marking, keeping the scroll),
     received ones with their sender's avatar on a run's first in groups and none in DMs, sent ones
     on the right; swipe right to reply, left to edit your own; call items; who is typing (a bubble
     in DMs, a strip resting on the composer in groups); and the media viewer. The composer is N5c's,
     the message long-press menu N5d's, the details N6's. -->
<script lang="ts">
    import {
        allUsersStore,
        blockedUsersStore,
        botState,
        bridgedUsersStore,
        chatListScopeStore,
        byContext as typersByContext,
        chatIdentifiersEqual,
        chatIdentifierToString,
        chatsInitialisedStore,
        chitStateStore,
        communitiesStore,
        cryptoLookup,
        currentUserIdStore,
        eventIndexesLoadedStore,
        eventsStore,
        exchangeRatesLookupStore,
        failedMessagesStore,
        favouritesStore,
        formatClock,
        isDiamondStore,
        isLifetimeDiamondStore,
        isPreviewingOrLapsed,
        isPrivateCommunityPreview,
        lastOnlineStatus,
        messageIndexStore,
        messagesRead,
        prizeClaimCustomData,
        selectedChatBlockedUsersStore,
        selectedChatDraftMessageStore,
        selectedChatExpandedDeletedMessageStore,
        selectedChatIdStore,
        selectedChatPinnedMessagesStore,
        selectedChatSummaryStore,
        selectedChatWebhooksStore,
        selectedCommunitySummaryStore,
        selectedServerChatStore,
        TimelineGrouper,
        translationsStore,
        unconfirmedReadByThem,
        unconfirmedStore,
        undeletingMessagesStore,
        webhookUserIdsStore,
        type ChatEvent,
        type ChatSummary,
        type EventWrapper,
        type FileContent,
        type LeaveOrDelete,
        type Message,
        type MessageMenu,
        type OpenChat,
        type PollContent,
        type VideoCallContent,
    } from "@client";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import CallEvent from "@openchat/ui/src/lib/components/CallEvent.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import MessageGroup from "@openchat/ui/src/lib/components/MessageGroup.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import UnreadDivider from "@openchat/ui/src/lib/components/UnreadDivider.svelte";
    import type { GroupMessage } from "@openchat/ui/src/lib/types";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import ChatEventList, { type ChatEventListArgs } from "@src/core/ChatEventList.svelte";
    import { TimelineFlattener, type FlatChatItem } from "@src/core/flatChatItems";
    import HumanCheckFrame from "@src/core/HumanCheckFrame.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import MediaViewer from "@src/core/MediaViewer.svelte";
    import { observeRead } from "@src/core/observeRead";
    import { chatMenuActions } from "@src/logic/chats/chatMenu";
    import { callLength, callMedia, callState, isLiveCall } from "@src/logic/conversation/callItem";
    import { ChatSearch } from "@src/logic/conversation/chatSearch.svelte";
    import { directChatStatus } from "@src/logic/conversation/chatStatus";
    import { editMessage, replyToMessage } from "@src/logic/conversation/draftActions";
    import {
        quoteFor,
        quoteTarget,
        retryFor,
        textAsMarkdown,
        withHandlers,
        type MessageHandlers,
        type QuoteTarget,
    } from "@src/logic/conversation/messageHandlers";
    import { messageOffer } from "@src/logic/conversation/messageOffer";
    import {
        conversationContext,
        isMedia,
        mediaHeld,
        messageStatus,
        readByThem,
        senderColor,
        untilNextDay,
        withFields,
        type ConversationContext,
        type MediaContent,
        type MessageRow,
    } from "@src/logic/conversation/messageRow";
    import { votePoll } from "@src/logic/conversation/pollVote";
    import { toggleReaction } from "@src/logic/conversation/reaction";
    import { RowCache } from "@src/logic/conversation/rowCache";
    import {
        aggregateEventText,
        isTextEvent,
        timelineEventText,
        type EventTextContext,
    } from "@src/logic/conversation/timelineEventText";
    import { FirstUnread, MessageLink, othersTyping } from "@src/logic/conversation/timeline";
    import { VoicePlayer } from "@src/logic/conversation/voicePlayer.svelte";
    import { HumanChecks } from "@src/logic/prize/humanCheck.svelte";
    import { claimPrizeWithHumanCheck } from "@src/logic/prize/prizeClaim";
    import { lowBandwidth } from "@src/stores/settings";
    import { now, now500 } from "@src/stores/time";
    import { toastStore } from "@src/stores/toast";
    import { disableTipsFeature } from "@src/utils/features";
    import { getProxyAdjustedBlobUrl, saveFile } from "@src/utils/media";
    import { navigate } from "@src/utils/navigation";
    import { nativeMessageSwipes } from "@src/utils/messageSwipe";
    import { buildDisplayName } from "@src/utils/user";
    import { getContext, onDestroy, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import { blockWithToast, favouriteWithToast, muteWithToast } from "../chats/chatToasts";
    import { removeWithUndo } from "../chats/removeWithUndo";
    import {
        callEventProps,
        headerMenuItems,
        listWaiting,
        type HeaderMenuAction,
    } from "./conversation.adapter";
    import { HeldWhileLeaving } from "./heldWhileLeaving";
    import SearchBar from "./SearchBar.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "conversation" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    // the shell's, the same for the screen's life
    const overlays = untrack(() => context.overlays);

    // whether the route's chat is the one the client has selected (RouteEffects: setSelectedChat).
    // It isn't before it's first selected (a link opening the app, a community still loading), and
    // isn't again from when Back changes the URL, while the screen slides away: what the screen
    // showed of it is held until it's gone then (HeldWhileLeaving), never another chat's
    const selected = $derived(
        $selectedChatSummaryStore !== undefined &&
            chatIdentifiersEqual($selectedChatSummaryStore.id, screen.route.chatId),
    );
    const heldChat = new HeldWhileLeaving<ChatSummary | undefined>(undefined);
    const chat = $derived(heldChat.of(selected, $selectedChatSummaryStore));
    const me = $derived($currentUserIdStore);
    const direct = $derived(chat?.kind === "direct_chat");
    const chatKey = $derived(chat && chatIdentifierToString(chat.id));

    // the day, which changes at midnight, so "Today" and "Yesterday" are worked out again then
    let day = $state(new Date().toDateString());
    $effect(() => {
        void day;
        const timer = setTimeout(
            () => (day = new Date().toDateString()),
            untilNextDay(new Date()) + 1000,
        );
        return () => clearTimeout(timer);
    });

    // ---- the rows' context, as the web's conversation makes it (logic/conversation/messageRow)

    // what a prize's requirements ask of the reader; rows are made again when it changes
    const claimant = $derived({
        previewingOrLapsed: chat !== undefined && isPreviewingOrLapsed(chat, $communitiesStore),
        diamond: $isDiamondStore,
        lifetimeDiamond: $isLifetimeDiamondStore,
        streak: $chitStateStore.streak,
        chitEarned: $chitStateStore.totalChitEarned,
    });

    // the exchange rates load after the first rows; once they do, rows are made again
    const ratesLoaded = $derived($exchangeRatesLookupStore.size > 0);

    // what the reader asked to see full size in low bandwidth, and what's open in the viewer
    const revealed = new Set<bigint>();
    let viewing = $state<MediaContent>();
    // bumped when a revealed image needs its row redone
    let rowsVersion = $state(0);

    const heldCtx = new HeldWhileLeaving<ConversationContext | undefined>(undefined);
    const ctx = $derived.by((): ConversationContext => {
        void day;
        void rowsVersion;
        void ratesLoaded;
        const live = conversationContext({
            client,
            chat,
            me,
            formatter: $_,
            users: $allUsersStore,
            webhooks: $selectedChatWebhooksStore,
            webhookIds: $webhookUserIdsStore,
            detailsLoaded: $selectedServerChatStore !== undefined,
            lowBandwidth: $lowBandwidth,
            revealed: (messageId) => revealed.has(messageId),
            claimant,
            tokens: $cryptoLookup,
            rates: () => exchangeRatesLookupStore.value,
        });
        // the chat's webhooks and details go with the selection
        return heldCtx.of(selected, live) ?? live;
    });

    const level = $derived(chat?.kind === "channel" ? "channel" : "group");
    const eventCtx = $derived.by((): EventTextContext => {
        const users = $allUsersStore;
        return {
            formatter: $_,
            me,
            users,
            displayName: (userId, kind) => buildDisplayName(users, userId, kind),
            level,
            canInvite: chat !== undefined && client.canInviteUsers(chat.id),
            botName: (botId) => botState.externalBots.get(botId)?.name,
        };
    });

    // ---- the header

    const them = $derived(chat?.kind === "direct_chat" ? $allUsersStore.get(chat.them.userId) : undefined);
    const title = $derived(
        chat === undefined
            ? ""
            : chat.kind === "direct_chat"
              ? client.displayName(them)
              : chat.name,
    );
    const favourite = $derived(chat !== undefined && $favouritesStore.has(chat.id));
    const readonly = $derived(chat !== undefined && client.isChatReadOnly(chat.id));

    // a DM: when they were last online (a suspended account says so; a bot, nothing)
    const dmStatus = $derived(directChatStatus(them));
    const dmUserId = $derived(chat?.kind === "direct_chat" ? chat.them.userId : undefined);
    let lastOnline = $state<number>();
    $effect(() => {
        const userId = dmUserId;
        lastOnline = undefined;
        if (userId === undefined || dmStatus !== "last_online") return;
        let current = true;
        void client.getLastOnlineDate(userId, Date.now()).then((at) => {
            if (current) lastOnline = at;
        });
        return () => {
            current = false;
        };
    });
    const online = $derived(lastOnlineStatus($_, $now, lastOnline));

    const sub = $derived.by(() => {
        if (chat === undefined) return "";
        if (chat.kind !== "direct_chat") {
            return $_("native.conversation.members", {
                values: {
                    visibility: $_(chat.public ? "access.public" : "access.private"),
                    count: chat.memberCount,
                },
            });
        }
        if (dmStatus === "suspended") return $_("accountSuspended");
        return dmStatus === "last_online" ? online[0] : "";
    });

    const avatarColor = $derived(
        chat === undefined
            ? "violet"
            : senderColor(
                  chat.kind === "direct_chat" ? chat.them.userId : chatIdentifierToString(chat.id),
              ),
    );

    // calls are N14's: the header's buttons and a call item's Join say so for now
    const canCall = $derived(chat !== undefined && !readonly && client.canStartVideoCalls(chat.id));

    function callsLater() {
        context.toast($_("native.conversation.callsLater"));
    }

    const headerActions = $derived(
        canCall
            ? [
                  { icon: "video", label: $_("native.conversation.videoCall"), onClick: callsLater },
                  { icon: "phone", label: $_("native.conversation.voiceCall"), onClick: callsLater },
              ]
            : [],
    );

    function openDetails() {
        if (chat !== undefined) context.push({ kind: "chat_details", chatId: chat.id });
    }

    // ---- the header's menu

    let menuAnchor = $state<HTMLElement | null>(null);
    useOverlay(
        overlays,
        () => menuAnchor !== null,
        () => (menuAnchor = null),
    );

    const isBot = $derived(them?.kind === "bot");
    const menuActions = $derived(
        chat === undefined
            ? []
            : chatMenuActions(chat, {
                  canLeave: chat.kind !== "direct_chat" && client.canLeaveGroup(chat.id),
                  blocked: chat.kind === "direct_chat" && $blockedUsersStore.has(chat.them.userId),
                  isBot,
              }),
    );

    const menuItems = $derived(
        chat === undefined
            ? []
            : headerMenuItems(
                  {
                      kind:
                          chat.kind === "direct_chat"
                              ? "user"
                              : chat.kind === "group_chat"
                                ? "group"
                                : "channel",
                      muted: chat.membership.notificationsMuted,
                      favourite,
                      isBot,
                      actions: menuActions,
                  },
                  menuLabel,
              ),
    );

    function menuLabel(id: HeaderMenuAction): string {
        switch (id) {
            case "details":
                return $_(
                    chat?.kind === "direct_chat"
                        ? "native.conversation.menu.contactDetails"
                        : chat?.kind === "channel"
                          ? "native.conversation.menu.channelDetails"
                          : "native.conversation.menu.groupDetails",
                );
            case "leave":
                return $_(
                    chat?.kind === "channel"
                        ? "native.conversation.menu.leaveChannel"
                        : "native.conversation.menu.leaveGroup",
                );
            case "block":
                return $_("native.conversation.menu.block", {
                    values: { name: title },
                });
            default:
                return $_(`native.conversation.menu.${id}`);
        }
    }

    function onMenu(id: string) {
        const current = chat;
        if (current === undefined) return;
        switch (id) {
            case "search":
                openSearch();
                break;
            case "details":
                openDetails();
                break;
            case "mute":
            case "unmute": {
                const muting = id === "mute";
                void muteWithToast(
                    client,
                    context,
                    current.id,
                    muting,
                    $_(muting ? "native.chats.toast.muted" : "native.chats.toast.unmuted"),
                    $_,
                );
                break;
            }
            case "favourite":
            case "unfavourite": {
                const adding = id === "favourite";
                void favouriteWithToast(
                    client,
                    context,
                    current.id,
                    adding,
                    $_(adding ? "native.chats.toast.favourited" : "native.chats.toast.unfavourited"),
                );
                break;
            }
            case "leave":
                if (current.kind !== "direct_chat") {
                    leaveOrDelete(
                        current,
                        { kind: "leave", chatId: current.id },
                        $_("native.chats.toast.left", { values: { name: title } }),
                    );
                }
                break;
            case "delete":
                if (current.kind === "direct_chat") {
                    leaveOrDelete(
                        current,
                        { kind: "delete_direct_chat", chatId: current.id, blockUser: false },
                        $_("native.chats.toast.deleted"),
                    );
                }
                break;
            case "block":
            case "unblock":
                if (current.kind === "direct_chat") {
                    const blocking = id === "block";
                    void blockWithToast(
                        client,
                        context,
                        current.them.userId,
                        blocking,
                        $_(
                            blocking
                                ? "native.conversation.toast.blocked"
                                : "native.conversation.toast.unblocked",
                            { values: { name: title } },
                        ),
                    );
                }
                break;
        }
    }

    // leaving or deleting goes back to the list, where the chat has gone, with Undo
    function leaveOrDelete(
        current: ChatSummary,
        action: LeaveOrDelete,
        message: string,
    ) {
        context.back?.();
        removeWithUndo(client, context, chatIdentifierToString(current.id), action, message);
    }

    // ---- search in the chat (logic/conversation/chatSearch): the header becomes a search bar;
    // the match shown is kept marked (ChatEventList's focus) and scrolled to

    let searchOpen = $state(false);
    let query = $state("");
    let list: ChatEventList | undefined = $state();

    const search = new ChatSearch({
        search: async (term, mentions) => {
            const current = chat;
            if (current === undefined) return undefined;
            const response = await client.searchChat(current.id, term, mentions, 200);
            return response.kind === "success" ? response.matches : undefined;
        },
        get group() {
            return chat !== undefined && chat.kind !== "direct_chat";
        },
        lookup: (name) => {
            const found = client.lookupUserForMention(name, true);
            return found === undefined ? undefined : (client.userOrUserGroupId(found) ?? "");
        },
        onGoTo: (index) => {
            const current = chat;
            if (current !== undefined) {
                void list?.scrollToMessageIndex({ chatId: current.id }, index, index >= 0);
            }
        },
    });
    onDestroy(() => search.dispose());

    useOverlay(
        overlays,
        () => searchOpen,
        () => closeSearch(),
    );

    function openSearch() {
        query = "";
        searchOpen = true;
    }

    function closeSearch() {
        searchOpen = false;
        query = "";
        search.dispose();
    }

    function onQuery(next: string) {
        query = next;
        search.typed(next);
    }

    const searchCount = $derived.by(() => {
        if (search.searching || query.trim().length === 0 || !search.searched(query)) return "";
        const total = search.matches.length;
        return total === 0
            ? $_("native.conversation.search.none")
            : $_("native.conversation.search.count", {
                  values: { current: search.current + 1, total },
              });
    });

    // ---- the live call: its item in the timeline, and the header's strip while that's off screen

    const liveCall = $derived(chat?.videoCallInProgress);
    let liveItemShown = $state(false);

    function watchShown(node: HTMLElement) {
        const io = new IntersectionObserver(
            (entries) => (liveItemShown = entries.some((e) => e.isIntersecting)),
            { root: node.closest(".vcl-viewport") },
        );
        io.observe(node);
        return {
            destroy: () => {
                io.disconnect();
                liveItemShown = false;
            },
        };
    }

    function liveSub(content: VideoCallContent, started: bigint): string {
        return $_("native.conversation.live.sub", {
            values: {
                elapsed: formatClock((callLength(content, started, $now500) ?? 0) / 1000),
                count: content.participants.length,
            },
        });
    }

    // ---- who is typing: a received-style bubble at the end of a DM, a strip resting on the
    // composer in a group or channel (kept while it fades out)

    const typingNames = $derived(
        chat === undefined
            ? []
            : othersTyping($typersByContext.get({ chatId: chat.id }), me, (userId) =>
                  client.displayName($allUsersStore.get(userId)),
              ),
    );
    let stripNames = $state<string[]>([]);
    $effect(() => {
        if (typingNames.length > 0) stripNames = typingNames;
    });
    const typingText = $derived(
        stripNames.length === 0
            ? ""
            : $_("ui.typingIndicator.typing", {
                  values: {
                      count: stripNames.length,
                      name: stripNames[0],
                      second: stripNames[1] ?? "",
                  },
              }),
    );

    // ---- the timeline

    // a private chat or community that isn't joined shows no messages (as the old UI)
    const privatePreview = $derived(
        chat !== undefined &&
            (isPrivateCommunityPreview($selectedCommunitySummaryStore) ||
                client.maskChatMessages(chat)),
    );
    const levelText = $derived($_(`level.${level}`).toLowerCase());

    const grouper = new TimelineGrouper();
    const flattener = new TimelineFlattener();
    const heldItems = new HeldWhileLeaving<FlatChatItem[]>([]);
    const items = $derived.by((): FlatChatItem[] => {
        if (!selected || chat === undefined) return heldItems.of(false, []);
        const timeline = grouper.group(
            $eventsStore,
            me,
            chat.kind === "channel" && chat.public,
            $selectedChatExpandedDeletedMessageStore,
            undefined,
            true,
        );
        return heldItems.of(true, flattener.flatten(timeline));
    });
    // the ranges of events loaded, which the list splits its items by: held with them
    const heldLoaded = new HeldWhileLeaving($eventIndexesLoadedStore);
    const loaded = $derived(heldLoaded.of(selected, $eventIndexesLoadedStore));

    // the unread divider stays above the first message unread when the chat opened
    const firstUnreadMarker = new FirstUnread();
    const firstUnread = $derived.by(() => {
        const current = chat;
        if (current === undefined) return undefined;
        return firstUnreadMarker.of(current.id, () =>
            untrack(() =>
                messagesRead.getFirstUnreadMessageIndex(
                    current.id,
                    current.latestMessage?.event.messageIndex,
                ),
            ),
        );
    });

    // a new chat's list starts uninitialised, as the old UI's did, unless it has nothing to load
    let initialised = $state(false);
    // a small spinner at the top of the list (never one in the middle of the screen) while its
    // first messages are on their way (not in the cache); in its place while the chat is selected
    const waiting = $derived(listWaiting({ initialised, items: items.length }));
    let initialisedFor: string | undefined;
    $effect.pre(() => {
        const key = chatKey;
        if (key === initialisedFor) return;
        initialisedFor = key;
        initialised = untrack(() => chat !== undefined && chat.latestEventIndex <= 0);
    });

    // the route's message (a deep link): gone to when it changes, and when the chat does
    const messageLink = new MessageLink();
    $effect(() => {
        const idx = $messageIndexStore;
        const chatId = $selectedChatIdStore;
        const current = list;
        if (current === undefined || !chatIdentifiersEqual(chatId, screen.route.chatId)) return;
        const to = messageLink.next(chatId, idx, $chatsInitialisedStore);
        if (chatId !== undefined && to !== undefined) {
            untrack(() => current.scrollToMessageIndex({ chatId }, to, false));
        }
    });

    function status(evt: EventWrapper<Message>, args: ChatEventListArgs, failed: boolean) {
        return messageStatus({
            failed,
            accepted: args.isAccepted($unconfirmedStore, evt),
            readByThem:
                chat !== undefined && readByThem(client, chat, evt.event, $unconfirmedReadByThem),
        });
    }

    // rows kept per event (RowCache), and their messages with them, so user and other chat
    // updates don't redo every bubble; started again for a new chat, wording or day
    const rows = new RowCache();
    const groupMessages = new WeakMap<MessageRow, { offers: string; messages: GroupMessage[] }>();
    $effect.pre(() => {
        void chatKey;
        void $_;
        void day;
        void $lowBandwidth;
        void $cryptoLookup;
        void ratesLoaded;
        void claimant;
        rows.clear();
    });

    // the day of the messages at the top of the list, pinned there while it scrolls through that
    // day (the list says which: VirtualChatList's sticky date), as the old app's; the day's own pill
    // takes over as it passes under it
    let stickyEl = $state<HTMLElement>();
    let stickyTop = $state<number>();
    let stickyDate = $state<bigint>();
    $effect(() => {
        const el = stickyEl;
        const area = el?.parentElement;
        if (el === undefined || area == null) return;
        // where it is on the screen, again whenever what's above the list changes (the search bar,
        // the live call's strip)
        const measure = () => (stickyTop = el.getBoundingClientRect().top);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(area);
        return () => observer.disconnect();
    });

    function dateLabel(timestamp: bigint): string {
        void day;
        return client.formatMessageDate(timestamp, $_("today"), $_("yesterday"));
    }

    // what a message offers (messageOffer), which says what its swipes and Retry do
    function offeredFor(
        current: ChatSummary,
        evt: EventWrapper<Message>,
        failed: boolean,
        confirmed: boolean,
    ): MessageMenu {
        return messageOffer(client, current, evt, {
            me,
            bridgedUsers: $bridgedUsersStore,
            failed,
            confirmed,
            readonly,
            pinned: $selectedChatPinnedMessagesStore,
            translated: $translationsStore,
            undeleting: $undeletingMessagesStore,
            blocked: $selectedChatBlockedUsersStore,
            tipsEnabled: !disableTipsFeature,
        });
    }

    type RowOffers = {
        swipes: ReturnType<typeof nativeMessageSwipes>;
        retry: (() => void) | undefined;
    };

    function rowOffers(evt: EventWrapper<Message>, offered: MessageMenu): RowOffers {
        return {
            swipes: nativeMessageSwipes(evt.event.sender === me, offered.actions),
            retry: offered.actions.has("retry") ? () => retry(evt) : undefined,
        };
    }

    function messagesFor(
        row: MessageRow,
        withBody: boolean,
        body: import("svelte").Snippet,
        evt: EventWrapper<Message>,
        offers: RowOffers,
    ): GroupMessage[] {
        const key = `${offers.swipes.left}|${offers.retry !== undefined}`;
        const kept = groupMessages.get(row);
        if (kept?.offers === key) return kept.messages;
        const message = withBody
            ? ({ ...row.message, body } as GroupMessage)
            : withHandlers(row, evt.event, handlers, $cryptoLookup);
        // kept between renders, so composed without reading a voice message's live fields
        const quoted = chat === undefined ? undefined : quoteTarget(evt.event, chat.id, $chatListScopeStore.kind);
        const messages = [
            withFields(message, {
                ...retryFor(row.message, offers.retry),
                ...quoteFor(row.message, quoted, goToQuote),
                // the long-press menu is N5d's
                menu: true,
                swipeLeft: offers.swipes.left,
            }),
        ];
        groupMessages.set(row, { offers: key, messages });
        return messages;
    }

    // ---- what's done with a message

    const QUOTED_MARK_MS = 1600;

    // a reply's quote, tapped: its message in this chat (loaded first if it's outside what's
    // loaded), tinted in the accent for a moment once it's there, or the chat or thread it's quoted
    // from
    let quotedIndex = $state<number>();
    let quotedTimer: ReturnType<typeof setTimeout> | undefined;
    onDestroy(() => clearTimeout(quotedTimer));

    async function goToQuote(target: QuoteTarget) {
        if (target.kind === "elsewhere") {
            navigate(target.url);
            return;
        }
        if (chat === undefined || list === undefined) return;
        await list.scrollToMessageIndex({ chatId: chat.id }, target.messageIndex, false);
        clearTimeout(quotedTimer);
        quotedIndex = target.messageIndex;
        quotedTimer = setTimeout(() => (quotedIndex = undefined), QUOTED_MARK_MS);
    }

    function reply(evt: EventWrapper<Message>) {
        if (chat !== undefined) replyToMessage(chat.id, evt, $allUsersStore);
    }

    function edit(evt: EventWrapper<Message>) {
        if (chat !== undefined) editMessage(chat.id, evt, $allUsersStore);
    }

    function retry(evt: EventWrapper<Message>) {
        if (chat !== undefined) void client.retrySendMessage({ chatId: chat.id }, evt);
    }

    function react(evt: EventWrapper<Message>, emoji: string) {
        if (chat !== undefined) void toggleReaction(client, chat.id, evt.event, emoji);
    }

    // the message replied to or edited (the chat's draft, which the composer shows), marked
    const draft = $derived($selectedChatDraftMessageStore);
    const composingId = $derived(
        draft?.editingEvent?.event.messageId ?? draft?.replyingTo?.messageId,
    );

    function openMedia(msg: Message) {
        if (!isMedia(msg.content)) return;
        if (mediaHeld(msg.content, msg.messageId, ctx.media)) {
            // the first tap shows it in the bubble; the next opens it
            revealed.add(msg.messageId);
            rows.clear();
            rowsVersion += 1;
        } else {
            viewing = msg.content;
        }
    }

    function download(content: FileContent) {
        const url = getProxyAdjustedBlobUrl(content.blobUrl);
        if (url !== undefined) void saveFile(url, content.name);
    }

    async function vote(msg: Message, content: PollContent, next: number[]) {
        if (chat === undefined) return;
        if ((await votePoll(client, chat, me, msg, content, next)) === "failed") {
            context.toast($_("poll.voteFailed"));
        }
    }

    // each prize's human check, which a claim starts (HumanCheckFrame, under its card)
    const humanChecks = new HumanChecks();

    async function claim(msg: Message, e: MouseEvent) {
        if (chat === undefined || chat.kind === "direct_chat") return;
        const failure = await claimPrizeWithHumanCheck(
            client,
            humanChecks.for(msg.messageId),
            chat.id,
            msg.messageId,
            e,
        );
        if (failure !== undefined) toastStore.showFailureToast(failure);
    }

    // one voice message plays at a time, and none once the chat is left
    const voice = new VoicePlayer();
    onDestroy(() => voice.stop());

    // a swap offer's Accept and Cancel need the confirm alert the native kit doesn't have yet
    // (GAPS.md, Native conversation): no swap handler, so the card has no button
    const handlers: MessageHandlers = {
        openMedia,
        openUrl: (url) => window.open(url, "_blank", "noopener"),
        claim,
        vote,
        download,
        voice,
    };

    function isMessage(evt: EventWrapper<ChatEvent>): evt is EventWrapper<Message> {
        return evt.event.kind === "message";
    }

    function isCall(msg: Message): msg is Message<VideoCallContent> {
        return msg.content.kind === "video_call_content";
    }
</script>

<div class="conversation">
    {#if searchOpen}
        <SearchBar
            {query}
            count={searchCount}
            none={searchCount !== "" && search.matches.length === 0}
            searching={search.searching}
            canOlder={search.hasOlder}
            canNewer={search.hasNewer}
            text={{
                placeholder: $_("native.conversation.search.placeholder"),
                close: $_("native.conversation.search.close"),
                older: $_("native.conversation.search.older"),
                newer: $_("native.conversation.search.newer"),
            }}
            {onQuery}
            onSubmit={() => void search.search(query)}
            onOlder={() => search.older(false)}
            onNewer={() => search.newer(false)}
            onClose={closeSearch} />
    {:else}
        <NativePageHeader
            {title}
            {sub}
            onBack={context.back}
            onTitleClick={chat === undefined ? undefined : openDetails}
            titleLabel={chat === undefined ? "" : menuLabel("details")}
            actions={headerActions}
            onMore={chat === undefined ? undefined : (anchor) => (menuAnchor = anchor)}
            moreLabel={$_("native.conversation.options")}
            divider>
            {#snippet avatar()}
                <Avatar
                    size={36}
                    color={avatarColor}
                    online={chat?.kind === "direct_chat" && online[1]} />
            {/snippet}
        </NativePageHeader>
    {/if}

    {#if chat !== undefined && liveCall !== undefined && !liveItemShown}
        <button type="button" class="live-strip" onclick={callsLater}>
            <span class="live-dot"></span>
            <span class="live-text">
                <span class="live-title">
                    {$_(
                        liveCall.callType === "audio"
                            ? "native.conversation.live.voice"
                            : "native.conversation.live.video",
                    )}
                </span>
                <span class="live-sub">{$_("native.conversation.live.tapToJoin")}</span>
            </span>
            <span class="join">{$_("ui.callEvent.join")}</span>
        </button>
    {/if}

    {#if privatePreview}
        <div class="state">
            <EmptyState
                preset="no-conversations"
                title={$_("group.privateGroup", { values: { level: levelText } })}
                body={$_("group.privateGroupInfo", { values: { level: levelText } })}
                actionLabel="" />
        </div>
    {:else if chat === undefined}
        <div class="messages"><div class="waiting"><Spinner size={20} /></div></div>
    {:else}
        <div class="messages" style:--group-gap="8px">
            <div class="sticky-date" class:shown={stickyDate !== undefined} bind:this={stickyEl}>
                {#if stickyDate !== undefined}
                    <span class="pill">{dateLabel(stickyDate)}</span>
                {/if}
            </div>
            {#if waiting}
                <div class="waiting"><Spinner size={20} /></div>
            {/if}
            <ChatEventList
                bind:this={list}
                rootSelector="native-conversation"
                {chat}
                threadRootEvent={undefined}
                {items}
                {readonly}
                loadedRange={loaded}
                maintainScroll
                visible
                bind:initialised
                stickyDateElTop={stickyTop}
                bind:stickyDateTimestamp={stickyDate}
                viewportClass="native-conversation-list">
                {#snippet row(item, args)}
                    {#if item.kind === "timeline_date"}
                        <div class="date"><span class="pill">{dateLabel(item.timestamp)}</span></div>
                    {:else if item.kind === "event"}
                        {@const evt = item.event}
                        {#if isMessage(evt)}
                            {@const msg = evt.event}
                            {@const failed = args.isFailed($failedMessagesStore, evt)}
                            {#if isCall(msg)}
                                {@const call = callState(msg.content, me)}
                                {@const media = callMedia(msg.content)}
                                <div
                                    class="call"
                                    data-index={failed ? "" : msg.messageIndex}
                                    data-id={failed ? "" : msg.messageId}
                                    use:observeRead={{
                                        observer: args.messageObserver,
                                        read: args.isReadByMe($messagesRead, evt),
                                    }}>
                                    {#if call === "live" && isLiveCall(liveCall, msg.messageIndex)}
                                        <div class="live-pill" use:watchShown>
                                            <span
                                                class="live-icon"
                                                style:mask="var(--icon-{media === 'voice'
                                                    ? 'phone'
                                                    : 'video'}) center/contain no-repeat"></span>
                                            <span class="live-text">
                                                <span class="live-title">
                                                    {$_(
                                                        media === "voice"
                                                            ? "native.conversation.live.voice"
                                                            : "native.conversation.live.video",
                                                    )}
                                                </span>
                                                <span class="live-sub mono">
                                                    {liveSub(msg.content, evt.timestamp)}
                                                </span>
                                            </span>
                                            <button type="button" class="join" onclick={callsLater}>
                                                {$_("ui.callEvent.join")}
                                            </button>
                                        </div>
                                    {:else if call !== "live"}
                                        <CallEvent
                                            {...callEventProps(
                                                call,
                                                media,
                                                msg.sender === me
                                                    ? { mine: true }
                                                    : { mine: false, name: ctx.userName(msg.sender) },
                                                formatClock(
                                                    (callLength(msg.content, evt.timestamp, 0) ?? 0) /
                                                        1000,
                                                ),
                                                ctx.time(evt.timestamp),
                                            )}
                                            onCallBack={callsLater} />
                                    {/if}
                                </div>
                            {:else}
                                {@const row = rows.row(item.key, evt, status(evt, args, failed), ctx)}
                                {@const content = msg.content}
                                {@const confirmed = args.isConfirmed($unconfirmedStore, evt)}
                                {@const offered = offeredFor(chat, evt, failed, confirmed)}
                                {@const offers = rowOffers(evt, offered)}
                                {@const received = row.side === "received"}
                                {@const searchMatch =
                                    searchOpen && args.focusIndex === msg.messageIndex && !failed}
                                {@const quoted = quotedIndex === msg.messageIndex && !failed}
                                <!-- a text message's text as the old UI renders it: markdown, mentions,
                                     links, custom emoji (a lone emoji is the bubble's own, large) -->
                                {#snippet body()}
                                    {#if content.kind === "text_content"}
                                        <Markdown
                                            text={content.text}
                                            inline={!msg.blockLevelMarkdown} />
                                    {/if}
                                {/snippet}
                                <div
                                    class="row"
                                    class:starts={item.first}
                                    class:received
                                    class:avatars={!direct}
                                    class:search-match={searchMatch || quoted}
                                    data-index={failed ? "" : msg.messageIndex}
                                    data-id={failed ? "" : msg.messageId}
                                    use:observeRead={{
                                        observer: args.messageObserver,
                                        read: args.isReadByMe($messagesRead, evt),
                                    }}>
                                    {#if firstUnread === msg.messageIndex && msg.sender !== me}
                                        <div class="unread"><UnreadDivider /></div>
                                    {/if}
                                    <MessageGroup
                                        side={row.side}
                                        senderName={row.senderName}
                                        color={row.color}
                                        showAvatar={!direct && received && item.first}
                                        showName={!direct && received && item.first}
                                        avatarSpace={!direct && received}
                                        avatarSize={28}
                                        endsRun={item.last}
                                        mirror
                                        swipeStyle="inset"
                                        marked={searchMatch ||
                                        quoted ||
                                        (args.focusIndex === msg.messageIndex && !failed) ||
                                        composingId === msg.messageId
                                            ? 0
                                            : -1}
                                        onMessageMenu={() => {
                                            // TODO(N5d): the message's long-press menu
                                        }}
                                        onReact={offered.react
                                            ? (_, emoji) => react(evt, emoji)
                                            : undefined}
                                        onReply={offers.swipes.right === undefined
                                            ? undefined
                                            : () => reply(evt)}
                                        onSwipeLeft={offers.swipes.left === undefined
                                            ? undefined
                                            : () => edit(evt)}
                                        messages={messagesFor(
                                            row,
                                            content.kind === "text_content" &&
                                                textAsMarkdown(content.text),
                                            body,
                                            evt,
                                            offers,
                                        )} />
                                    <!-- kept while a claim's check runs, even if the prize runs out meanwhile -->
                                    {#if row.message.kind === "prize" && (row.message.canClaim || humanChecks.running(msg.messageId))}
                                        <HumanCheckFrame
                                            check={humanChecks.for(msg.messageId)}
                                            customData={prizeClaimCustomData(me, msg.messageId)} />
                                    {/if}
                                </div>
                            {/if}
                        {:else if evt.event.kind === "aggregate_common_events"}
                            {@const text = aggregateEventText(evt.event, eventCtx)}
                            {@const deleted = evt.event.messagesDeleted}
                            {#if text.joined !== undefined || text.deleted !== undefined || text.rolesChanged.length > 0}
                                <div
                                    class="event"
                                    data-index={deleted.length > 0 ? deleted.join(" ") : undefined}
                                    use:observeRead={{
                                        observer: args.messageObserver,
                                        read:
                                            deleted.length === 0 ||
                                            args.isReadByMe($messagesRead, evt),
                                    }}>
                                    {#if text.joined !== undefined}
                                        <p class="event-line">
                                            <Markdown oneLine suppressLinks text={text.joined} />
                                        </p>
                                    {/if}
                                    {#if text.deleted !== undefined}
                                        <p class="event-line">
                                            <button
                                                type="button"
                                                class="expand"
                                                onclick={() =>
                                                    client.expandDeletedMessages(new Set(deleted))}>
                                                {text.deleted}
                                            </button>
                                        </p>
                                    {/if}
                                    {#each text.rolesChanged as line}
                                        <p class="event-line">
                                            <Markdown suppressLinks text={line} />
                                        </p>
                                    {/each}
                                </div>
                            {/if}
                        {:else if isTextEvent(evt.event)}
                            {@const text = timelineEventText(evt.event, eventCtx)}
                            {#if text !== undefined}
                                <div class="event">
                                    <p class="event-line">
                                        <Markdown suppressLinks {text} />
                                    </p>
                                </div>
                            {/if}
                        {/if}
                    {/if}
                {/snippet}
                {#snippet fabs({ showGoToBottom, scrollToLast })}
                    {#if showGoToBottom}
                        <div class="to-bottom">
                            <IconButton
                                icon="arrow-down"
                                label={$_("goToLatestMessage")}
                                onClick={scrollToLast} />
                        </div>
                    {/if}
                {/snippet}
            </ChatEventList>
        </div>

        {#if direct && typingNames.length > 0}
            <div class="typing-bubble" role="status" aria-label={typingText}>
                <span class="dots"><span></span><span></span><span></span></span>
            </div>
        {/if}

        <footer class="composer">
            {#if !direct}
                <div
                    class="typing-strip"
                    class:shown={typingNames.length > 0}
                    aria-live="polite"
                    aria-hidden={typingNames.length === 0}>
                    <span class="dots small"><span></span><span></span><span></span></span>
                    <span class="typing-text">{typingText}</span>
                </div>
            {/if}
            <!-- TODO(N5c): the composer and its keyboard-area panels. Development text only -->
            <div class="composer-placeholder">Composer (N5c)</div>
        </footer>
    {/if}
</div>

<AnchoredMenu
    anchor={menuAnchor}
    items={menuItems}
    label={$_("native.conversation.options")}
    onSelect={onMenu}
    onClose={() => (menuAnchor = null)} />

{#if viewing !== undefined}
    <MediaViewer content={viewing} onClose={() => (viewing = undefined)} />
{/if}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .conversation {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .state {
        flex: 1;
        display: grid;
        place-items: center;
        padding: var(--space-24) var(--space-16);
    }

    .messages {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    // over the top of the list, after a moment: a load from the cache is in before it shows
    .waiting {
        position: absolute;
        z-index: 1;
        inset-block-start: var(--space-12);
        inset-inline: 0;
        display: flex;
        justify-content: center;
        pointer-events: none;
        animation: oc-veil-in 200ms 400ms both;

        @media (prefers-reduced-motion: reduce) {
            animation-duration: 1ms;
        }
    }

    :global(.vcl-viewport.native-conversation-list) {
        flex: auto;
        padding: 0 var(--space-12) var(--space-10);
        overflow-x: hidden;
        overscroll-behavior-y: contain;
        scrollbar-width: none;
    }

    // 6px within a sender's run, 16px between runs, a date or an event line
    .row {
        padding-block-start: var(--space-6);
        // a marked message (the search's match, the one replied to or edited) is tinted in a
        // rounded box 6px outside the row, as the prototype's: each mark reaches past its message
        // to the row's edges
        --message-mark-radius: 14px;
        --group-ring: transparent;

        // received messages leave room on the end side, sent ones on the start side
        padding-inline-start: 60px;
        --message-mark-start: -66px;
        --message-mark-end: -6px;

        &.received {
            padding-inline-start: 0;
            padding-inline-end: 44px;
            --message-mark-start: -6px;
            --message-mark-end: -50px;
        }

        // past the avatar's column (28px and its 8px gap) in groups
        &.received.avatars {
            --message-mark-start: -42px;
        }

        // the search's current match, and a quote's message gone to, accent-tinted
        &.search-match {
            --message-mark: color-mix(in oklch, var(--accent) 16%, transparent);
        }
    }

    .row.starts,
    .event,
    .date,
    .call {
        padding-block-start: var(--space-16);
    }

    /* the old UI's markdown, inside the bubble's own text: no outer spacing */
    .row :global(.markdown-wrapper > p:first-child),
    .row :global(.markdown-wrapper > ul:first-child),
    .row :global(.markdown-wrapper > ol:first-child) {
        margin-block-start: 0;
    }

    .row :global(.markdown-wrapper > :last-child) {
        margin-block-end: 0;
    }

    .unread {
        padding-block-end: var(--space-12);
    }

    // a day's pill
    .date {
        display: flex;
        justify-content: center;
    }

    // the day pinned at the top: where a day's own pill sits in its row (16px down), over the
    // messages
    .sticky-date {
        position: absolute;
        z-index: 2;
        inset-block-start: var(--space-16);
        inset-inline: 0;
        display: flex;
        justify-content: center;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease;

        &.shown {
            opacity: 1;
        }

        // the same look as a day's own pill, but opaque over the messages
        .pill {
            background:
                linear-gradient(var(--overlay-1), var(--overlay-1)),
                var(--surface-0);
        }
    }

    .pill {
        padding: var(--space-6) var(--space-12);
        border-radius: var(--radius-pill);
        background: var(--overlay-1);
        font: var(--weight-semibold) text-size(11.5px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    .event-line {
        margin: 0;
        text-align: center;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);
    }

    .expand {
        all: unset;
        cursor: pointer;
    }

    .call {
        display: flex;
        justify-content: center;
    }

    // the live call: a compact two-line pill in the live colours, Join on the end
    .live-pill,
    .live-strip {
        box-sizing: border-box;
        max-width: 100%;
        display: flex;
        align-items: center;
        gap: var(--space-10);
        padding-block: 5px;
        padding-inline: var(--space-14) 5px;
        border: 0;
        border-radius: var(--radius-pill);
        background: color-mix(in oklch, var(--status-online) 10%, var(--surface-2));
        box-shadow: inset 0 0 0 1.5px color-mix(in oklch, var(--status-online) 45%, transparent);
        color: var(--ink);
        text-align: start;
    }

    .live-strip {
        flex: none;
        align-self: center;
        max-width: calc(100% - 2 * var(--space-16));
        margin: var(--space-10) 0 var(--space-6);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .live-icon {
        flex: none;
        width: 16px;
        height: 16px;
        background: var(--status-online);
    }

    .live-dot {
        flex: none;
        width: 8px;
        height: 8px;
        border-radius: var(--radius-circle);
        background: var(--status-online);
        box-shadow: 0 0 0 4px color-mix(in oklch, var(--status-online) 25%, transparent);
    }

    .live-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding-inline-end: var(--space-4);
    }

    .live-title {
        font: var(--weight-semibold) text-size(13.5px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .live-sub {
        font: var(--weight-medium) text-size(12px) / 1 var(--font-sans);
        color: var(--ink-3);
        @include truncate;

        &.mono {
            font-family: var(--font-mono);
            color: var(--status-online);
        }
    }

    .join {
        flex: none;
        height: 34px;
        padding: 0 var(--space-16);
        display: flex;
        align-items: center;
        border: 0;
        border-radius: 17px;
        background: var(--accent);
        color: var(--on-accent);
        font: var(--weight-bold) text-size(13.5px) / 1 var(--font-sans);
        cursor: pointer;
    }

    .to-bottom {
        position: absolute;
        inset-block-end: var(--space-12);
        inset-inline-end: var(--space-16);
    }

    // a DM's typing bubble: received style, no avatar, 34px tall, small corner top left
    .typing-bubble {
        flex: none;
        display: flex;
        padding: var(--space-4) var(--space-12) var(--space-6);
        animation: typing-in 0.2s ease-out;
    }

    .typing-bubble .dots {
        height: 34px;
        padding: 0 13px;
        border-radius: 5px 16px 16px 16px;
        background: var(--bubble-recv-bg);
        box-shadow: inset 0 0 0 1px var(--line-1);

        &:dir(rtl) {
            border-radius: 16px 5px 16px 16px;
        }
    }

    .dots {
        display: flex;
        align-items: center;
        gap: 4px;

        span {
            width: 6px;
            height: 6px;
            border-radius: var(--radius-circle);
            background: var(--ink-3);
            animation: oc-typing 1.2s infinite;

            &:nth-child(2) {
                animation-delay: 0.15s;
            }

            &:nth-child(3) {
                animation-delay: 0.3s;
            }
        }

        &.small {
            flex: none;
            gap: 3px;
            height: 16px;

            span {
                width: 4px;
                height: 4px;
                background: currentColor;
            }
        }
    }

    .composer {
        position: relative;
        flex: none;
        padding: var(--space-8) 10px max(var(--safe-bottom), var(--space-12));
    }

    // who is typing in a group: a 24px strip resting on the composer (over its top padding by 6px),
    // over the messages, taking no row; it fades and rises 8px in, and goes the same way
    .typing-strip {
        position: absolute;
        inset-inline: 0;
        bottom: calc(100% - 6px);
        z-index: 3;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: var(--space-8);
        height: 24px;
        padding: 0 var(--space-16);
        background: var(--surface-0);
        color: var(--accent-bright);
        font: var(--weight-medium) text-size(12px) / 16px var(--font-sans);
        pointer-events: none;
        opacity: 0;
        transform: translateY(8px);
        transition:
            opacity 0.2s ease,
            transform 0.26s var(--ease-out);

        &.shown {
            opacity: 1;
            transform: none;
        }
    }

    .typing-text {
        min-width: 0;
        @include truncate;
    }

    .composer-placeholder {
        display: flex;
        align-items: center;
        min-height: 52px;
        padding: 0 var(--space-16);
        border-radius: 30px;
        background: var(--overlay-1);
        color: var(--ink-4);
        font: var(--weight-medium) text-size(14px) / 1 var(--font-sans);
    }

    @keyframes typing-in {
        from {
            opacity: 0;
            transform: translateY(4px);
        }
    }

    @include reduced-motion {
        .typing-strip {
            transition: none;
            transform: none;
        }

        .typing-bubble {
            animation: none;
        }

        .dots span {
            animation: none;
        }
    }
</style>
