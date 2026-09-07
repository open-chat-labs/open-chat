<script lang="ts">
    import { navigate } from "@utils/navigation";
    import {
        contentToInput,
        manualExtractEnabled,
        parseManualExtractionPrompt,
        proposeAndPost,
        proposeAndPostCandidate,
        preflightAiActionForMessage,
        resolveSuggestedAiAction,
        runProposeFlow,
        type AiActionCandidate,
        type ManualExtractionPromptResult,
        type ProposalPhase,
    } from "@utils/aiActionRunner";
    import {
        PROCESS_WITH_AI_AUDIO_PROMPT,
        PROCESS_WITH_AI_IMAGE_PROMPT,
        PROCESS_WITH_AI_TEXT_PROMPT,
        runLocalAiCommand,
    } from "@utils/localAiCommand";
    import { runLocalAiMessageFlow } from "@utils/localAiMessageFlow";
    import { aiActionProposalReadiness } from "@utils/aiActionProposalReadiness";
    import { usesWebInferenceRuntime } from "@utils/onDeviceInference";
    import { browserImageProposalRequiresModelReadiness } from "@src/stores/browserImageActionMode";
    import { createSingleFlight } from "@utils/singleFlight";
    import { webModelStatus } from "@utils/webInference";
    import {
        autoProposeBusyI18nKey,
        autoProposeSuggestions,
        autoProposeSuggestionActionKey,
        autoProposeSuggestionKey,
        autoProposeSuggestionLabel,
        autoProposeSuggestionStillCurrent,
        currentAutoProposeSessionEpoch,
        dismissAutoProposeSuggestion,
        muteAutoProposeInChat,
        type AutoProposeSuggestion,
    } from "@utils/autoPropose";
    import {
        resolveAiAppReconnectTarget,
        type AiAppReconnectCompletion,
        type AiAppReconnectRequest,
    } from "@utils/aiAppReconnect";
    import {
        autoProposeSuggestions as autoProposeEnabled,
        confirmMessageDeletion,
    } from "@src/stores/settings";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { keyboard } from "@stores/keyboard.svelte";
    import { popHistoryStateWithAction, pushDummyHistoryState } from "@utils/history";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import {
        Avatar,
        Body,
        ChatFootnote,
        Column,
        ColourVars,
        Container,
        ListAction,
        MenuTrigger,
        type PanDirection,
        Row,
        Sheet,
        Spinner,
    } from "component-lib";
    import {
        type AiAppRegistration,
        type ChatIdentifier,
        chatListScopeStore,
        type ChatType,
        currentUserIdStore,
        currentUserStore,
        type EnhancedReplyContext,
        localUpdates,
        type Message,
        type MessageContent,
        type MessageReminderCreatedContent,
        OpenChat,
        publish,
        routeForMessage,
        screenWidth,
        ScreenWidth,
        selectedChatBlockedUsersStore,
        type SelectedEmoji,
        type SenderContext,
        translationsStore,
        unconfirmedReadByThem,
        undeletingMessagesStore,
        type UserSummary,
    } from "@client";
    import { chatIdentifierToString } from "@shared";
    import { getContext, onDestroy, onMount, tick } from "svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import ShareOutline from "svelte-material-icons/ShareOutline.svelte";
    import SquareEditOutline from "svelte-material-icons/SquareEditOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { quickReactions } from "../../stores/quickReactions";
    import { scrollStatus } from "../../stores/scroll.svelte";
    import { now } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import { canShareMessage } from "../../utils/share";
    import { removeQueryStringParam } from "../../utils/urls";
    import AreYouSure from "../AreYouSure.svelte";
    import BotMessageContext from "../bots/BotMessageContext.svelte";
    import BotProfile, { type BotProfileProps } from "../bots/BotProfile.svelte";
    import Checkbox from "../Checkbox.svelte";
    import Translatable from "../Translatable.svelte";
    import AiAppLinkSheet from "./AiAppLinkSheet.svelte";
    import AutoProposeChip from "./AutoProposeChip.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import ChatMessageMenu from "./ChatMessageMenu.svelte";
    import ChatMessageOptions from "./ChatMessageOptions.svelte";
    import EmojiPicker from "./EmojiPickerWrapper.svelte";
    import IntersectionObserverComponent from "./IntersectionObserver.svelte";
    import MessageBubble from "./message/MessageBubble.svelte";
    import Reactions from "./message/Reactions.svelte";
    import ThreadSummary from "./message/ThreadSummary.svelte";
    import Tips from "./message/Tips.svelte";
    import ReminderBuilder from "./ReminderBuilder.svelte";
    import RepliesTo from "./RepliesTo.svelte";
    import ReportMessage from "./ReportMessage.svelte";
    import TipBuilder from "./TipBuilder.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: ChatIdentifier;
        chatType: ChatType;
        sender: UserSummary | undefined;
        msg: Message;
        me: boolean;
        eventIndex: number;
        timestamp: bigint;
        expiresAt: number | undefined;
        first: boolean;
        last: boolean;
        accepted: boolean;
        confirmed: boolean;
        failed: boolean;
        readByMe: boolean;
        observer?: IntersectionObserver;
        focused: boolean;
        readonly: boolean;
        pinned: boolean;
        canPin: boolean;
        canBlockUsers: boolean;
        canDelete: boolean;
        canQuoteReply: boolean;
        canReact: boolean;
        publicGroup: boolean;
        canStartThread: boolean;
        senderTyping: boolean;
        dateFormatter?: (date: Date) => string;
        collapsed?: boolean;
        threadRootMessage: Message | undefined;
        isThreadRoot?: boolean;
        senderContext: SenderContext | undefined;
        onExpandMessage?: (() => void) | undefined;
        // this is not to do with permission - some messages (namely thread root messages) will simply not support replying or editing inside a thread
        supportsEdit: boolean;
        supportsReply: boolean;
        disablePan?: boolean;
        onReplyTo?: (replyContext: EnhancedReplyContext) => void;
        onEditMessage?: () => void;
        onCollapseMessage?: () => void;
        onRetrySend?: () => void;
        onDeleteFailedMessage?: () => void;
        onRemovePreview?: (url: string) => void;
        onGoToMessageIndex?: (args: { index: number }) => void;
    }

    let {
        chatId,
        chatType,
        sender,
        msg,
        me,
        eventIndex,
        timestamp,
        expiresAt,
        first,
        last,
        accepted,
        confirmed,
        failed,
        readByMe,
        observer,
        focused,
        readonly,
        pinned,
        canPin,
        canBlockUsers,
        canDelete,
        canQuoteReply,
        canReact,
        publicGroup,
        canStartThread,
        senderTyping,
        collapsed = false,
        threadRootMessage,
        isThreadRoot = false,
        senderContext,
        onExpandMessage = undefined,
        supportsEdit,
        supportsReply,
        disablePan = false,
        onReplyTo,
        onEditMessage,
        onCollapseMessage,
        onRetrySend,
        onDeleteFailedMessage,
        onRemovePreview,
        onGoToMessageIndex,
    }: Props = $props();

    let msgElement: HTMLElement | undefined;
    let msgBubbleElement: HTMLElement | undefined;
    let componentMounted = true;

    let multiUserChat = chatType === "group_chat" || chatType === "channel";
    let showEmojiPicker = $state(false);
    let debug = false;
    let showRemindMe = $state(false);
    let showReport = $state(false);
    let tipping: string | undefined = $state(undefined);
    let percentageExpired = $state(100);
    let botProfile: BotProfileProps | undefined = $state(undefined);
    let localAiMessageStatus:
        | { kind: "processing" | "success" | "error"; message: string }
        | undefined = $state(undefined);
    let localAiMessageStatusTimer: number | undefined;
    let localAiMessageRun = 0;
    let confirmedReadByThem = $derived(client.messageIsReadByThem(chatId, msg.messageIndex));
    let readByThem = $derived(confirmedReadByThem || $unconfirmedReadByThem.has(msg.messageId));
    let contentWidth = $state<number>();

    trackedEffect("read-by-them", () => {
        if (confirmedReadByThem && $unconfirmedReadByThem.has(msg.messageId)) {
            unconfirmedReadByThem.delete(msg.messageId);
        }
    });

    onMount(() => {
        if (!readByMe) {
            tick().then(() => {
                if (observer !== undefined && msgElement !== undefined) {
                    try {
                        observer.observe(msgElement);
                    } catch {}
                }
            });
        }
    });

    $effect(() => {
        if (expiresAt === undefined) return;
        const ttl = expiresAt - Number(timestamp);
        const age = $now - Number(timestamp);
        const expired = age > ttl;
        const percentage = expired ? 100 : (age / ttl) * 100;
        percentageExpired = percentage;
        // if this message is the root of a thread, make sure that we close that thread when the message expires
        if (percentage >= 100 && msg.thread) {
            client.filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
            navigate(removeQueryStringParam("open"));
        }
    });

    onDestroy(() => {
        componentMounted = false;
        localAiMessageRun++;
        if (msgElement) {
            observer?.unobserve(msgElement);
        }
        if (localAiMessageStatusTimer !== undefined) {
            window.clearTimeout(localAiMessageStatusTimer);
        }
    });

    function setLocalAiMessageStatus(
        status: { kind: "processing" | "success" | "error"; message: string } | undefined,
    ) {
        if (localAiMessageStatusTimer !== undefined) {
            window.clearTimeout(localAiMessageStatusTimer);
        }
        localAiMessageStatus = status;
        if (status !== undefined && status.kind !== "processing") {
            localAiMessageStatusTimer = window.setTimeout(
                () => (localAiMessageStatus = undefined),
                status.kind === "success" ? 3_500 : 8_000,
            );
        }
    }

    function createReplyContext(): EnhancedReplyContext {
        return {
            kind: "rehydrated_reply_context",
            senderId: msg.sender,
            eventIndex: eventIndex,
            content: msg.content,
            sender,
            messageId: msg.messageId,
            messageIndex: msg.messageIndex,
            edited: msg.edited,
            isThreadRoot: msg.thread !== undefined,
            sourceContext: messageContext,
        };
    }

    function reply() {
        if (canQuoteReply) {
            onReplyTo?.(createReplyContext());
        }
    }

    function replyPrivately() {
        publish("replyPrivatelyTo", createReplyContext());
    }

    // The raw-JSON extraction prompt is a TEST SEAM only (Issue 1): real users with no on-device
    // model must never see a raw JSON box — they're guided to set one up (runProposeFlow says so). It
    // runs solely when this tab has ?manualExtract=1; the journey uses a temporary tab so the
    // signed-in user's normal tab and persistent profile state remain untouched.
    function promptForExtraction(): ManualExtractionPromptResult {
        if (!manualExtractEnabled()) return undefined;
        const raw = window.prompt(
            "Enter the action's fields as a JSON object, using the field names defined by the app.",
            "{}",
        );
        return parseManualExtractionPrompt(raw, () =>
            toastStore.showFailureToast(i18nKey("Enter a JSON object or an array of JSON objects")),
        );
    }

    // More than one enabled app action applies to this message — the user picks one from a sheet.
    // The sheets below are bridged back to the awaiting flow through their `resolve`: the flow keeps
    // the in-flight extraction, so neither sheet has to carry it, and — the part that matters — a
    // DISMISSED sheet still answers, instead of stranding the propose half-finished.
    let aiActionChooser = $state<{ candidates: AiActionCandidate[] } | undefined>(undefined);
    let chooserResolve: ((candidate: AiActionCandidate | undefined) => void) | undefined;

    function closeChooser(candidate: AiActionCandidate | undefined) {
        aiActionChooser = undefined;
        const resolve = chooserResolve;
        chooserResolve = undefined;
        resolve?.(candidate);
    }

    function chooseCandidate(
        candidates: AiActionCandidate[],
    ): Promise<AiActionCandidate | undefined> {
        return new Promise<AiActionCandidate | undefined>((resolve) => {
            chooserResolve = resolve;
            aiActionChooser = { candidates };
        });
    }

    // A per-user-keys app needs the one-time link-code pairing before its actions can run — the
    // consent sheet is showing; the propose that triggered it resumes when the link completes.
    let aiAppLink = $state<AiAppRegistration | undefined>(undefined);
    let aiAppLinkPurpose = $state<"connect" | "recovery">("connect");
    let aiAppLinkPreviousPublicKey = $state<string | undefined>(undefined);
    let aiAppLinkPreviousKeyVersion = $state<bigint | undefined>(undefined);
    let linkResolve: ((linked: boolean) => void) | undefined;

    function closeAiAppLink(linked: boolean) {
        aiAppLink = undefined;
        aiAppLinkPurpose = "connect";
        aiAppLinkPreviousPublicKey = undefined;
        aiAppLinkPreviousKeyVersion = undefined;
        const resolve = linkResolve;
        linkResolve = undefined;
        resolve?.(linked);
    }

    // The sheet only reports `true` once the key is registered, so the flow can re-propose on the
    // strength of this answer alone.
    function linkApp(app: AiAppRegistration): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            linkResolve = resolve;
            aiAppLinkPurpose = "connect";
            aiAppLinkPreviousPublicKey = undefined;
            aiAppLinkPreviousKeyVersion = undefined;
            aiAppLink = app;
        });
    }

    onDestroy(() => {
        const resolve = linkResolve;
        linkResolve = undefined;
        resolve?.(false);
    });

    // AppUnavailable is deliberately ambiguous. Authoritative app/action/card absence is reported
    // with one privacy-safe message, while a thrown lookup gets a distinct temporary-failure
    // message. An available recovery target never resumes the failed action automatically.
    async function promptReconnect(
        request: AiAppReconnectRequest,
        stillCurrent: () => boolean,
    ): Promise<AiAppReconnectCompletion | undefined> {
        const viewer = $currentUserIdStore;
        try {
            const resolution = await resolveAiAppReconnectTarget(
                client,
                request,
                chatId,
                stillCurrent,
            );
            if (!stillCurrent() || !componentMounted || viewer !== $currentUserIdStore) return;
            if (resolution.kind === "stale") return;
            if (resolution.kind === "app_or_action_unavailable") {
                toastStore.showFailureToast(i18nKey("aiApps.reconnectUnavailable"));
                return;
            }
            const linked = await new Promise<boolean>((resolve) => {
                linkResolve = resolve;
                aiAppLinkPurpose = "recovery";
                aiAppLinkPreviousPublicKey = resolution.previousConnection.publicKey;
                aiAppLinkPreviousKeyVersion = resolution.previousConnection.keyVersion;
                aiAppLink = resolution.app;
            });
            if (!linked || !stillCurrent() || !componentMounted || viewer !== $currentUserIdStore)
                return;
            return {
                retryCoordinates: resolution.retryCoordinates,
                previousKeyVersion: resolution.previousConnection.keyVersion,
            };
        } catch {
            if (!stillCurrent() || !componentMounted || viewer !== $currentUserIdStore) return;
            toastStore.showFailureToast(i18nKey("aiApps.reconnectLookupFailed"));
        }
    }

    // The decisions live in runProposeFlow (utils/aiActionRunner), shared with the classic tree; this
    // component supplies only the surfaces this tree has — the chooser and consent sheets. Both trees
    // used to keep their own copy of the flow, and this one was left with a chooser branch that
    // returned without a word: two candidates and no model meant a button that did nothing.
    let proposing = $state(false);
    let proposalPhase = $state<ProposalPhase | undefined>(undefined);
    let proposalRequiresModelReadiness = $state(true);
    let proposalModelInferenceObserved = $state(false);
    let activeAutoProposeSuggestionKey = $state<string | undefined>(undefined);
    let proposalModelGeneration = $derived.by(() => {
        const generation = $webModelStatus.generation;
        if (generation === undefined || generation.stage === "audio") return undefined;
        return { stage: generation.stage, phase: generation.phase };
    });
    $effect(() => {
        if (proposing && proposalModelGeneration?.phase === "inference") {
            proposalModelInferenceObserved = true;
        }
    });
    let autoProposeBusyResourceKey = $derived(
        i18nKey(
            autoProposeBusyI18nKey(
                $webModelStatus.status,
                usesWebInferenceRuntime(),
                proposalPhase,
                proposalRequiresModelReadiness,
                proposalModelGeneration,
                proposalModelInferenceObserved,
            ),
        ),
    );

    const runAiActionSingleFlight = createSingleFlight(
        ({
            suggested,
            capturedContent,
            requiresModelReadiness,
        }: {
            suggested?: AutoProposeSuggestion;
            capturedContent: MessageContent;
            requiresModelReadiness: boolean;
        }) => {
            const capturedContext = {
                chatId,
                threadRootMessageIndex,
            };
            const capturedChatKey = chatIdentifierToString(chatId);
            const capturedViewer = $currentUserIdStore;
            const capturedSessionEpoch = currentAutoProposeSessionEpoch();
            const capturedMessageId = msg.messageId;
            const stillCurrent = () =>
                componentMounted &&
                $currentUserIdStore === capturedViewer &&
                currentAutoProposeSessionEpoch() === capturedSessionEpoch &&
                (suggested === undefined || autoProposeSuggestionStillCurrent(suggested)) &&
                chatIdentifierToString(chatId) === capturedChatKey &&
                threadRootMessageIndex === capturedContext.threadRootMessageIndex &&
                msg.messageId === capturedMessageId &&
                msg.content === capturedContent;
            const onPhase = (phase: ProposalPhase) => {
                if (stillCurrent()) proposalPhase = phase;
            };
            return runProposeFlow({
                preflight: () => preflightAiActionForMessage(client, capturedContext.chatId),
                canInfer: () => aiActionProposalReadiness(capturedContent.kind === "image_content"),
                requiresModelReadiness: () => requiresModelReadiness,
                promptForExtraction,
                propose: (extraction) =>
                    proposeAndPost(
                        client,
                        capturedContext,
                        capturedContent,
                        extraction,
                        stillCurrent,
                        onPhase,
                        Number(timestamp),
                    ),
                proposeCandidate: (candidate, extraction, source) =>
                    proposeAndPostCandidate(
                        client,
                        capturedContext,
                        capturedContent,
                        candidate,
                        extraction,
                        stillCurrent,
                        onPhase,
                        source,
                        Number(timestamp),
                    ),
                resolveSuggestedCandidate:
                    suggested === undefined
                        ? undefined
                        : () => resolveSuggestedAiAction(client, capturedContext.chatId, suggested),
                stillCurrent,
                chooseCandidate,
                linkApp,
                promptReconnect: (request) => promptReconnect(request, stillCurrent),
                resolveReconnectCandidate: (coordinates) =>
                    resolveSuggestedAiAction(client, capturedContext.chatId, coordinates),
                toast: (message) => toastStore.showFailureToast(i18nKey(message)),
            });
        },
        (busy) => {
            proposing = busy;
            proposalPhase = busy ? "preparing" : undefined;
            if (!busy) proposalModelInferenceObserved = false;
        },
    );

    function runAiActionHandler(suggested?: AutoProposeSuggestion) {
        const capturedContent = msg.content;
        const requiresModelReadiness = browserImageProposalRequiresModelReadiness(
            capturedContent.kind === "image_content",
            !usesWebInferenceRuntime(),
        );
        if (!proposing) proposalRequiresModelReadiness = requiresModelReadiness;
        return runAiActionSingleFlight({ suggested, capturedContent, requiresModelReadiness });
    }

    async function processMessageWithAi() {
        if (localAiMessageStatus?.kind === "processing") return;
        const run = ++localAiMessageRun;
        const capturedViewer = $currentUserIdStore;
        const capturedChatKey = chatIdentifierToString(chatId);
        const capturedContext = { chatId, threadRootMessageIndex };
        const capturedMessageId = msg.messageId;
        const capturedContent = msg.content;
        const capturedAuthor = me
            ? "You"
            : sender?.displayName || sender?.username || "Unknown member";
        const stillCurrent = () =>
            componentMounted &&
            $currentUserIdStore === capturedViewer &&
            chatIdentifierToString(chatId) === capturedChatKey &&
            threadRootMessageIndex === capturedContext.threadRootMessageIndex &&
            msg.messageId === capturedMessageId &&
            msg.content === capturedContent;
        setLocalAiMessageStatus({
            kind: "processing",
            message: "AI is processing this message locally…",
        });
        let terminalStatusSet = false;
        try {
            const result = await runLocalAiMessageFlow({
                readInput: () =>
                    contentToInput(capturedContent, client, undefined, undefined, {
                        includeAudio: true,
                    }),
                unsupportedMessage: () =>
                    capturedContent.kind === "image_content"
                        ? "The displayed image could not be read for local AI processing."
                        : capturedContent.kind === "audio_content"
                          ? "The selected voice message could not be read for local AI processing."
                          : "This message type cannot be processed by the local AI yet.",
                promptFor: (input) =>
                    input.audio !== undefined
                        ? PROCESS_WITH_AI_AUDIO_PROMPT
                        : input.image !== undefined
                          ? PROCESS_WITH_AI_IMAGE_PROMPT
                          : PROCESS_WITH_AI_TEXT_PROMPT,
                contextFor: (input) => [
                    {
                        author: capturedAuthor,
                        text: input.text,
                        hasImage: input.image !== undefined,
                        imageIncluded: input.image !== undefined,
                        hasAudio: input.audio !== undefined,
                        audioIncluded: input.audio !== undefined,
                    },
                ],
                infer: runLocalAiCommand,
                sendReply: (text) =>
                    client.sendMessageWithContent(
                        capturedContext,
                        { kind: "text_content", text },
                        true,
                        [],
                        false,
                    ),
                stillCurrent,
            });
            if (result.kind === "stale") return;
            setLocalAiMessageStatus(result);
            terminalStatusSet = true;
            if (result.kind === "error") toastStore.showFailureToast(i18nKey(result.message));
        } finally {
            if (componentMounted && localAiMessageRun === run && !terminalStatusSet) {
                setLocalAiMessageStatus(undefined);
            }
        }
    }

    function cancelReminder(content: MessageReminderCreatedContent) {
        client
            .cancelMessageReminder(msg.messageId, { ...content, hidden: true })
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("reminders.cancelSuccess"));
                } else {
                    toastStore.showFailureToast(i18nKey("reminders.cancelFailure"));
                }
            });
    }

    function editMessage() {
        if (canEdit) {
            onEditMessage?.();
        }
    }

    function tipMessage(ledger: string) {
        tipping = ledger;
    }

    function selectReaction(selected: SelectedEmoji) {
        if (selected.kind === "native") {
            toggleReaction(false, selected.unicode);
        } else {
            toggleReaction(false, `@CE(${selected.code})`);
        }
    }

    function selectQuickReaction(unicode: string) {
        toggleReaction(true, unicode);
    }

    function toggleReaction(isQuickReaction: boolean, reaction: string) {
        if (canReact) {
            const kind = client.containsReaction($currentUserIdStore, reaction, msg.reactions)
                ? "remove"
                : "add";

            client
                .selectReaction(
                    chatId,
                    $currentUserIdStore,
                    threadRootMessageIndex,
                    msg.messageId,
                    reaction,
                    $currentUserStore.username,
                    $currentUserStore.displayName,
                    kind,
                )
                .then((success) => {
                    if (success && kind === "add") {
                        client.trackEvent("reacted_to_message");

                        if (isQuickReaction) {
                            // Note: Manually selected reactions do not increment
                            // their fav counter by default, so we do it manually.
                            // Also refresh loaded reactions.
                            quickReactions.incrementFavourite(reaction);
                        }

                        quickReactions.reload();
                    }
                });
        }
        showEmojiPicker = false;
        popHistoryStateWithAction("emoji_picker_action");
    }

    function openUserProfile(ev?: Event) {
        if (sender?.kind === "bot") {
            botProfile = {
                botId: sender.userId,
                chatId,
                onClose: () => (botProfile = undefined),
            };
        } else {
            ev?.target?.dispatchEvent(
                new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                    detail: {
                        userId: msg.sender,
                        chatButton: multiUserChat,
                        inGlobalContext: false,
                    },
                    bubbles: true,
                }),
            );
        }
    }

    function onRegisterVote(detail: { answerIndex: number; type: "register" | "delete" }) {
        if (chatId.kind === "direct_chat") return;

        client
            .registerPollVote(
                chatId,
                threadRootMessageIndex,
                msg.messageId,
                msg.messageIndex,
                detail.answerIndex,
                detail.type,
            )
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("poll.voteFailed"));
                }
            });
    }

    function onRespondToActionCard(
        response: "confirm" | "cancel",
        confirmPayloadOverride?: Uint8Array,
        confirmationGrant?: Uint8Array,
    ): Promise<boolean> {
        // Return the round-trip so the card can show a spinner and lock its buttons until the
        // confirm/cancel (and its downstream deposit) resolves. App setup remains an explicit
        // Apps -> Open action instead of interrupting a successful confirmation.
        return client
            .respondToActionCard(
                chatId,
                threadRootMessageIndex,
                msg.messageId,
                response,
                confirmPayloadOverride,
                confirmationGrant,
            )
            .then((success) => {
                if (!success) {
                    // A failed confirm (usually a deposit error) now leaves the card Pending on the
                    // canister rather than committing "confirmed" — surface it so the user can retry.
                    if (response === "confirm") {
                        toastStore.showFailureToast(i18nKey("aiActions.confirmFailed"));
                    }
                }
                return success;
            });
    }

    function reportMessage() {
        showReport = true;
    }

    function remindMe() {
        showRemindMe = true;
    }

    let inert = $derived(
        msg.content.kind === "deleted_content" ||
            msg.content.kind === "blocked_content" ||
            msg.content.kind === "restricted_content" ||
            collapsed,
    );
    let canTip = $derived(!me && confirmed && !inert && !failed);
    let inThread = $derived(threadRootMessage !== undefined);
    let scrollingId = $derived(
        inThread ? "scrollable-list-thread-messages" : "scrollable-list-chat-messages",
    );
    let threadRootMessageIndex = $derived(
        isThreadRoot ? undefined : threadRootMessage?.messageIndex,
    );
    let fill = $derived(client.fillMessage(msg));
    let showAvatar = $derived(
        chatType !== "direct_chat" && !me && $screenWidth !== ScreenWidth.ExtraExtraSmall,
    );
    let translated = $derived($translationsStore.has(msg.messageId));
    let threadSummary = $derived(msg.thread);
    let msgUrl = $derived(
        `${routeForMessage($chatListScopeStore.kind, { chatId }, msg.messageIndex)}?open=true`,
    );
    let isProposal = $derived(msg.content.kind === "proposal_content");
    let isActionCard = $derived(msg.content.kind === "action_card_content");
    let canEdit = $derived(
        me && supportsEdit && !msg.deleted && client.contentTypeSupportsEdit(msg.content.kind),
    );
    let undeleting = $derived($undeletingMessagesStore.has(msg.messageId));
    let deletedByMe = $derived(
        msg.content.kind === "deleted_content" && msg.content.deletedBy == $currentUserIdStore,
    );
    let permanentlyDeleted = $derived(
        deletedByMe &&
            me &&
            msg.content.kind === "deleted_content" &&
            Number(msg.content.timestamp) < $now - 5 * 60 * 1000,
    );
    let canRevealDeleted = $derived(deletedByMe && !undeleting && !permanentlyDeleted);
    let canRevealBlocked = $derived(msg.content.kind === "blocked_content");
    let messageContext = $derived({ chatId, threadRootMessageIndex });
    let ephemeral = $derived(localUpdates.isEphemeral(messageContext, msg.messageId));
    let showChatMenu = $derived(
        (!inert || canRevealDeleted || canRevealBlocked) && !readonly && !ephemeral,
    );
    let canUndelete = $derived(msg.deleted && msg.content.kind !== "deleted_content");
    let tips = $derived(msg.tips ? Object.entries(msg.tips) : []);
    let canBlockUser = $derived(canBlockUsers && !$selectedChatBlockedUsersStore.has(msg.sender));
    let edited = $derived(
        msg.edited && (senderContext?.kind !== "bot" || !senderContext.finalised),
    );
    let canShare = $derived(canShareMessage(msg.content));
    let canForward = $derived(client.canForward(msg.content));
    let canTranslate = $derived((client.getMessageText(msg.content) ?? "").length > 0);
    let canProcessWithAi = $derived(
        msg.content.kind === "text_content" ||
            msg.content.kind === "image_content" ||
            msg.content.kind === "audio_content",
    );
    let canDeleteMessage = $derived(
        (canDelete || me) &&
            !inert &&
            !(msg.content.kind === "video_call_content" && msg.content.ended === undefined),
    );
    let showConfirmDelete = $state(false);

    let longpressCooldown = $derived(scrollStatus.isCooldown);

    // Auto-propose: the matcher (utils/autoPropose.ts) flagged this message as matching a
    // registered action's trigger keywords — render the under-bubble chip. Tapping it re-uses the
    // exact same propose path as the message menu.
    let autoProposeSuggestionList = $derived(
        $autoProposeEnabled && !inert
            ? ($autoProposeSuggestions.get(
                  autoProposeSuggestionKey(
                      $currentUserIdStore,
                      chatId,
                      threadRootMessageIndex,
                      msg.messageId,
                  ),
              ) ?? [])
            : [],
    );
    let activeAutoProposeSuggestionVisible = $derived(
        activeAutoProposeSuggestionKey !== undefined &&
            autoProposeSuggestionList.some(
                (suggestion) =>
                    autoProposeSuggestionActionKey(suggestion) === activeAutoProposeSuggestionKey,
            ),
    );

    async function proposeSuggestedAiAction(suggestion: AutoProposeSuggestion) {
        if (proposing) return;
        const suggestionActionKey = autoProposeSuggestionActionKey(suggestion);
        activeAutoProposeSuggestionKey = suggestionActionKey;
        const capturedViewer = $currentUserIdStore;
        const capturedChatId = chatId;
        const capturedThread = threadRootMessageIndex;
        const capturedMessageId = msg.messageId;
        try {
            const outcome = await runAiActionHandler(suggestion);
            if (outcome === "posted" && autoProposeSuggestionStillCurrent(suggestion)) {
                dismissAutoProposeSuggestion(
                    capturedViewer,
                    capturedChatId,
                    capturedThread,
                    capturedMessageId,
                    suggestion,
                );
            }
        } finally {
            if (activeAutoProposeSuggestionKey === suggestionActionKey) {
                activeAutoProposeSuggestionKey = undefined;
            }
        }
    }

    function muteAutoProposeSuggestions() {
        muteAutoProposeInChat(chatId);
        toastStore.showSuccessToast(i18nKey("aiApps.autoPropose.muted"));
    }

    async function deleteMessage(deletionConfirmed: boolean) {
        if (failed) {
            onDeleteFailedMessage?.();
            return;
        }
        if (!canDeleteMessage) return;

        if (!deletionConfirmed) {
            showConfirmDelete = !showConfirmDelete;
            return;
        }

        showConfirmDelete = false;
        await client.deleteMessage(chatId, threadRootMessageIndex, msg.messageId);
    }

    let isSheetMenuOpen = $state(false);

    function openSheetMenu() {
        isSheetMenuOpen = true;
    }

    let panDirection = $state();
    let panFactor = $state(0);

    function forward() {
        window.setTimeout(() => publish("forward", msg), 250);
    }

    function onPanCommit(direction: PanDirection) {
        if (me && direction === "left") editMessage();
        if (!me && direction === "left") forward();
        else reply();
    }

    function onPanMove(direction: PanDirection, factor: number) {
        panDirection = direction;
        panFactor = factor;
    }

    // Memoised so the action's update() only runs when a field actually changes
    let pan = $derived(
        msg.deleted || disablePan || msg.content.kind === "proposal_content"
            ? undefined
            : {
                  oncommit: onPanCommit,
                  onmove: onPanMove,
                  isScrolling: scrollStatus.isScrolling || scrollStatus.isCooldown,
              },
    );
</script>

{#if botProfile !== undefined}
    <BotProfile {...botProfile} />
{/if}

{#if tipping !== undefined}
    <TipBuilder ledger={tipping} onClose={() => (tipping = undefined)} {msg} {messageContext} />
{/if}

{#if showConfirmDelete}
    <AreYouSure action={deleteMessage} dismiss={() => (showConfirmDelete = false)}>
        <Container gap={"lg"} direction={"vertical"}>
            <Translatable resourceKey={i18nKey("deleteMessageConfirm")}></Translatable>
            <Checkbox
                id="dont_show"
                label={i18nKey("install.dontShow")}
                checked={!$confirmMessageDeletion}
                onChange={confirmMessageDeletion.toggle}
            ></Checkbox>
        </Container>
    </AreYouSure>
{/if}

{#if showEmojiPicker && canReact}
    <Sheet
        onDismiss={() => {
            showEmojiPicker = false;
            popHistoryStateWithAction("emoji_picker_action");
        }}
    >
        <div
            class="emoji_picker_wrapper"
            style:padding-bottom={keyboard.visible ? `${keyboard.currentHeight - 64}px` : "0"}
        >
            <Column height="fill" overflow="auto" minHeight={keyboard.visible ? "35vh" : "50vh"}>
                <EmojiPicker
                    onEmojiSelected={selectReaction}
                    onSkintoneChanged={(tone) => quickReactions.reload(tone)}
                    supportCustom={true}
                    mode={"reaction"}
                />
            </Column>
        </div>
    </Sheet>
{/if}

{#if isSheetMenuOpen}
    <Sheet onDismiss={() => (isSheetMenuOpen = false)}>
        <Column gap="sm" padding={["lg", "lg", "xxl", "lg"]} maxHeight="70vh">
            <ChatMessageOptions
                menuType="menu_items"
                {chatId}
                {isProposal}
                {inert}
                {publicGroup}
                {confirmed}
                {failed}
                {canShare}
                {me}
                {canPin}
                {canTip}
                {pinned}
                {supportsReply}
                {canQuoteReply}
                {canStartThread}
                {multiUserChat}
                {threadRootMessage}
                {isThreadRoot}
                {msg}
                {canForward}
                {canBlockUser}
                {canEdit}
                {canDelete}
                {canUndelete}
                {canRevealDeleted}
                {canRevealBlocked}
                translatable={canTranslate}
                {translated}
                {onCollapseMessage}
                onReply={reply}
                {onRetrySend}
                onReplyPrivately={replyPrivately}
                onEditMessage={editMessage}
                onTipMessage={tipMessage}
                onReportMessage={reportMessage}
                onCancelReminder={cancelReminder}
                onDeleteMessage={deleteMessage}
                onRemindMe={remindMe}
                onRunAiAction={runAiActionHandler}
                onProcessWithAi={canProcessWithAi ? processMessageWithAi : undefined}
                {onDeleteFailedMessage}
                onOptionSelected={() => (isSheetMenuOpen = false)}
            />
        </Column>
    </Sheet>
{/if}

{#if aiActionChooser !== undefined}
    <Sheet onDismiss={() => closeChooser(undefined)}>
        <Column gap="md" padding={["lg", "lg", "xxl", "lg"]} maxHeight="70vh">
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("aiApps.chooseAction")} />
            </Body>
            {#each aiActionChooser.candidates as candidate (`${candidate.app.id}-${candidate.action.name}`)}
                <ListAction onClick={() => closeChooser(candidate)}>
                    {#snippet icon(color)}
                        <Robot {color} />
                    {/snippet}
                    {candidate.app.manifest.name} — {candidate.action.name}
                </ListAction>
            {/each}
        </Column>
    </Sheet>
{/if}

{#if aiAppLink !== undefined}
    <AiAppLinkSheet
        app={aiAppLink}
        purpose={aiAppLinkPurpose}
        previousPublicKey={aiAppLinkPreviousPublicKey}
        previousKeyVersion={aiAppLinkPreviousKeyVersion}
        onDismiss={() => closeAiAppLink(false)}
        onLinked={() => closeAiAppLink(true)}
    />
{/if}

{#if showRemindMe}
    <ReminderBuilder
        {chatId}
        {eventIndex}
        {threadRootMessageIndex}
        onClose={() => (showRemindMe = false)}
    />
{/if}

{#if showReport}
    <ReportMessage
        {threadRootMessageIndex}
        messageId={msg.messageId}
        {chatId}
        {canDelete}
        onClose={() => (showReport = false)}
    />
{/if}

{#if debug}
    <pre>Sender: {msg.sender}</pre>
    <pre>EventIdx: {eventIndex}</pre>
    <pre>MsgIdx: {msg.messageIndex}</pre>
    <pre>MsgId: {msg.messageId}</pre>
    <pre>Confirmed: {confirmed}</pre>
    <pre>ReadByThem: {readByThem}</pre>
    <pre>ReadByUs: {readByMe}</pre>
    <pre>Pinned: {pinned}</pre>
    <pre>edited: {msg.edited}</pre>
    <pre>failed: {failed}</pre>
    <pre>timestamp: {timestamp}</pre>
    <pre>expiresAt: {expiresAt}</pre>
    <pre>thread: {JSON.stringify(msg.thread, null, 4)}</pre>
    <pre>senderContext: {JSON.stringify(senderContext, null, 4)}</pre>
    <pre>inert: {inert}</pre>
    <pre>canRevealDeleted: {canRevealDeleted}</pre>
    <pre>canlRevealBlocked: {canRevealBlocked}</pre>
    <pre>readonly: {readonly}</pre>
    <pre>showChatMenu: {showChatMenu}</pre>
    <pre>ephemeral: {ephemeral}</pre>
{/if}

{#if expiresAt === undefined || percentageExpired < 100}
    <IntersectionObserverComponent>
        {#snippet children(intersecting)}
            <Container
                data_index={failed ? "" : `${msg.messageIndex}`}
                data_id={failed ? "" : `${msg.messageId}`}
                id={failed ? "" : `event-${eventIndex}`}
                bind:ref={msgElement}
                padding={last ? ["zero", "zero", "sm", "zero"] : "zero"}
                gap={"sm"}
                overflow={"visible"}
                mainAxisAlignment={me ? "end" : "start"}
                {pan}
            >
                {#if showAvatar && !isActionCard}
                    <div class:first class="avatar">
                        <Avatar
                            onClick={openUserProfile}
                            url={client.userAvatarUrl(sender)}
                            size={"sm"}
                        ></Avatar>
                    </div>
                {/if}
                {@const hasThread = threadSummary !== undefined && !inThread}
                {@const hasReactions = msg.reactions.length > 0}
                {@const hasTips = tips.length > 0}
                <Container
                    supplementalClass={`message_bubble_wrapper${isActionCard ? " action_card_message" : ""}`}
                    overflow={"visible"}
                    crossAxisAlignment={me ? "end" : "start"}
                    width={isActionCard ? "fill" : "hug"}
                    maxWidth={isActionCard
                        ? "100%"
                        : chatId.kind === "direct_chat"
                          ? "78vw"
                          : "75vw"}
                    gap={"xxs"}
                    minWidth={isActionCard ? "0" : "6rem"}
                    direction={"vertical"}
                >
                    {#if panDirection && panFactor > 0}
                        <div
                            class={`pan-action ${panDirection}`}
                            class:active={panFactor >= 1}
                            style:opacity={panFactor}
                        >
                            {#if me && canEdit && panDirection === "left"}
                                <SquareEditOutline size="1.5rem" />
                            {:else if !me && canShare && panDirection === "left"}
                                <ShareOutline size="1.5rem" />
                            {:else}
                                <Reply size="1.5rem" />
                            {/if}
                        </div>
                    {/if}
                    <MenuTrigger
                        constrainMask={scrollingId}
                        maskUI
                        disabled={!showChatMenu || !intersecting}
                        mobileMode="longpress"
                        longpressAnimation="scale"
                        position="bottom"
                        customContent={true}
                        {longpressCooldown}
                    >
                        {#snippet menuItems()}
                            {#if showChatMenu && intersecting}
                                <ChatMessageMenu
                                    menuType="icon_buttons"
                                    {chatId}
                                    {isProposal}
                                    {inert}
                                    {publicGroup}
                                    {confirmed}
                                    {failed}
                                    {canShare}
                                    deleted={msg.deleted}
                                    {me}
                                    {canReact}
                                    {canPin}
                                    {canTip}
                                    {pinned}
                                    {supportsReply}
                                    {canQuoteReply}
                                    {canStartThread}
                                    {multiUserChat}
                                    {threadRootMessage}
                                    {isThreadRoot}
                                    {msg}
                                    {canForward}
                                    {canBlockUser}
                                    {canEdit}
                                    {selectQuickReaction}
                                    {canDelete}
                                    {canUndelete}
                                    {canRevealDeleted}
                                    {canRevealBlocked}
                                    translatable={canTranslate}
                                    {translated}
                                    {onCollapseMessage}
                                    showEmojiPicker={() => {
                                        showEmojiPicker = true;
                                        pushDummyHistoryState("emoji_picker_action");
                                    }}
                                    onReply={reply}
                                    {onRetrySend}
                                    onReplyPrivately={replyPrivately}
                                    onEditMessage={editMessage}
                                    onTipMessage={tipMessage}
                                    onReportMessage={reportMessage}
                                    onCancelReminder={cancelReminder}
                                    onDeleteMessage={deleteMessage}
                                    onRemindMe={remindMe}
                                    onRunAiAction={runAiActionHandler}
                                    onProcessWithAi={canProcessWithAi
                                        ? processMessageWithAi
                                        : undefined}
                                    onOpenSheetMenu={openSheetMenu}
                                    {onDeleteFailedMessage}
                                />
                            {/if}
                        {/snippet}
                        <MessageBubble
                            {chatId}
                            {focused}
                            {senderTyping}
                            {senderContext}
                            {sender}
                            bind:ref={msgBubbleElement}
                            onOpenUserProfile={openUserProfile}
                            {msg}
                            {fill}
                            {first}
                            {last}
                            {hasThread}
                            time={Number(timestamp)}
                            {pinned}
                            {expiresAt}
                            {percentageExpired}
                            bot={sender?.kind === "bot"}
                            {accepted}
                            {failed}
                            {undeleting}
                            {readByThem}
                            {readByMe}
                            {onGoToMessageIndex}
                            {chatType}
                        >
                            {#snippet repliesTo(reply)}
                                <RepliesTo
                                    {contentWidth}
                                    {readonly}
                                    {chatId}
                                    {intersecting}
                                    repliesTo={reply}
                                />
                            {/snippet}

                            {#snippet messageContent(me)}
                                <ChatMessageContent
                                    bind:contentWidth
                                    senderId={msg.sender}
                                    {readonly}
                                    {fill}
                                    {me}
                                    {messageContext}
                                    {collapsed}
                                    {undeleting}
                                    {intersecting}
                                    {failed}
                                    reconciliationTrigger={confirmed}
                                    {timestamp}
                                    messageIndex={msg.messageIndex}
                                    messageId={msg.messageId}
                                    content={msg.content}
                                    {edited}
                                    blockLevelMarkdown={msg.blockLevelMarkdown}
                                    {onRemovePreview}
                                    {onRegisterVote}
                                    {onRespondToActionCard}
                                    {onExpandMessage}
                                    ogPreviews={msg.ogPreviews}
                                    messagePreviews={msg.messagePreviews}
                                />
                            {/snippet}
                        </MessageBubble>
                    </MenuTrigger>
                    {#if hasThread}
                        <ThreadSummary
                            url={msgUrl}
                            {threadSummary}
                            {chatId}
                            threadRootMessageIndex={msg.messageIndex}
                            {me}
                        />
                    {/if}
                    {#if hasReactions}
                        <Reactions
                            {me}
                            onClick={({ reaction }) => toggleReaction(false, reaction)}
                            {intersecting}
                            reactions={msg.reactions}
                            offset={!hasThread}
                        ></Reactions>
                    {/if}
                    {#if hasTips && !inert}
                        <Tips
                            {me}
                            tips={msg.tips}
                            onClick={tipMessage}
                            {canTip}
                            offset={!hasThread}
                        />
                    {/if}
                    {#if autoProposeSuggestionList.length > 0}
                        {#each autoProposeSuggestionList as suggestion, index (autoProposeSuggestionActionKey(suggestion))}
                            <AutoProposeChip
                                {me}
                                title={autoProposeSuggestionLabel(
                                    suggestion,
                                    autoProposeSuggestionList,
                                )}
                                offset={index === 0 && !hasThread && !hasReactions && !hasTips}
                                busy={proposing &&
                                    activeAutoProposeSuggestionKey ===
                                        autoProposeSuggestionActionKey(suggestion)}
                                disabled={proposing}
                                busyResourceKey={autoProposeBusyResourceKey}
                                onPropose={() => proposeSuggestedAiAction(suggestion)}
                                onDismiss={() =>
                                    dismissAutoProposeSuggestion(
                                        $currentUserIdStore,
                                        chatId,
                                        threadRootMessageIndex,
                                        msg.messageId,
                                        suggestion,
                                    )}
                                onMute={muteAutoProposeSuggestions}
                            />
                        {/each}
                    {/if}
                    {#if localAiMessageStatus !== undefined}
                        <div
                            class={`local-ai-message-status ${localAiMessageStatus.kind}`}
                            class:me
                            role="status"
                            aria-live="polite"
                            data-testid="message-local-ai-status"
                        >
                            <span class="pill">
                                {#if localAiMessageStatus.kind === "processing"}
                                    <Spinner
                                        size="1rem"
                                        foregroundColour="var(--primary)"
                                        backgroundColour="var(--text-on-disabled-surface)"
                                    />
                                {/if}
                                {localAiMessageStatus.message}
                            </span>
                        </div>
                    {/if}
                    {#if proposing && !activeAutoProposeSuggestionVisible}
                        <Row
                            supplementalClass={"auto-propose-working"}
                            width={"hug"}
                            height={"hug"}
                            padding={["xxs", "sm"]}
                            background={ColourVars.surface2}
                            crossAxisAlignment={"center"}
                            mainAxisAlignment={"center"}
                            gap={"xs"}
                            borderRadius={"circle"}
                            borderWidth={"thick"}
                            borderColour={ColourVars.surface0}
                        >
                            <Spinner
                                size={"1rem"}
                                foregroundColour={"var(--primary)"}
                                backgroundColour={"var(--text-on-disabled-surface)"}
                            />
                            <ChatFootnote>
                                <Translatable resourceKey={autoProposeBusyResourceKey} />
                            </ChatFootnote>
                        </Row>
                    {/if}
                </Container>
            </Container>
        {/snippet}
    </IntersectionObserverComponent>
    {#if senderContext?.kind === "bot" && senderContext.command !== undefined}
        <div class="bot-context">
            <BotMessageContext
                botName={"cockpiss"}
                botCommand={senderContext.command}
                finalised={senderContext.finalised}
            />
        </div>
    {/if}
{/if}

<style lang="scss">
    $avatar-width-mob: 2.5rem;

    .local-ai-message-status {
        display: flex;
        justify-content: flex-start;
        width: 100%;
        margin-top: 2px;

        &.me {
            justify-content: flex-end;
        }

        .pill {
            display: inline-flex;
            align-items: center;
            gap: var(--sp-xs);
            padding: 2px 10px;
            border-radius: 999px;
            background-color: var(--surface-2);
            border: var(--bw-thick) solid var(--surface-0);
            color: var(--text-secondary);
            font-size: 0.75rem;
        }

        &.error .pill {
            color: var(--validation-error);
        }

        &.success .pill {
            color: var(--validation-success);
        }
    }

    :global(.container.message_bubble_wrapper .menu-trigger) {
        width: 100%;
    }

    :global(.container.message_bubble_wrapper.action_card_message),
    :global(.container.message_bubble_wrapper.action_card_message .menu-trigger) {
        box-sizing: border-box;
        min-width: 0;
        max-width: 100%;
    }

    .avatar:not(.first) {
        visibility: hidden;
    }

    // TODO is this used at all?
    .emoji-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: $sp3 $sp4;
        background-color: var(--section-bg);
    }

    .bot-context {
        display: flex;
        margin-inline-start: $avatar-width-mob;
        margin-bottom: $sp2;
        margin-top: $sp2;
    }

    :global(.pan-action svg) {
        transition: scale 200ms ease-out;
    }

    :global(.pan-action.active svg) {
        scale: 1.25;
    }

    :global(.pan-action path) {
        fill: var(--text-secondary);
        transition: fill 200ms ease-out;
    }

    :global(.pan-action.active path) {
        fill: var(--primary-accent);
    }

    .pan-action {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 3rem;
        height: 3rem;
        display: flex;
        align-items: center;
        justify-content: center;

        &.right {
            left: -4rem;
        }

        &.left {
            right: -4rem;
        }
    }

    .emoji_picker_wrapper {
        flex: 1;
        width: 100%;
        display: flex;
        overflow: hidden;
        flex-direction: column;
    }
</style>
