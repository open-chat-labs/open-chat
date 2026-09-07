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
    import Typing from "@shared_components/Typing.svelte";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import {
        type AiAppRegistration,
        AvatarSize,
        type ChatIdentifier,
        chatListScopeStore,
        type ChatType,
        currentUserIdStore,
        currentUserStore,
        type EnhancedReplyContext,
        iconSize,
        localUpdates,
        type Message,
        type MessageContent,
        type MessageReminderCreatedContent,
        mobileWidth,
        OpenChat,
        publish,
        routeForMessage,
        routeStore,
        screenWidth,
        ScreenWidth,
        selectedChatBlockedUsersStore,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        type SelectedEmoji,
        type SenderContext,
        translationsStore,
        unconfirmedReadByThem,
        undeletingMessagesStore,
        type UserSummary,
    } from "@client";
    import { chatIdentifierToString } from "@shared";
    import { getContext, onDestroy, onMount, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import EmoticonOutline from "svelte-material-icons/EmoticonOutline.svelte";
    import ForwardIcon from "svelte-material-icons/Share.svelte";
    import { fade } from "svelte/transition";
    import { longpress } from "../../actions/longpress";
    import { i18nKey } from "../../i18n/i18n";
    import { quickReactions } from "../../stores/quickReactions";
    import { rtlStore } from "../../stores/rtl";
    import {
        autoProposeSuggestions as autoProposeEnabled,
        dclickReply,
    } from "../../stores/settings";
    import { now } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import { isTouchOnlyDevice } from "../../utils/devices";
    import { reservedMediaWidth } from "../../utils/media";
    import { canShareMessage } from "../../utils/share";
    import { removeQueryStringParam } from "../../utils/urls";
    import Avatar from "../Avatar.svelte";
    import Button from "../Button.svelte";
    import BotMessageContext from "../bots/BotMessageContext.svelte";
    import BotProfile, { type BotProfileProps } from "../bots/BotProfile.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Link from "../Link.svelte";
    import ModalContent from "../ModalContent.svelte";
    import AiAppLinkModal from "./AiAppLinkModal.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "../Translatable.svelte";
    import AutoProposeChip from "./AutoProposeChip.svelte";
    import Spinner from "../icons/Spinner.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import ChatMessageMenu from "./ChatMessageMenu.svelte";
    import EmojiPicker from "./EmojiPickerWrapper.svelte";
    import EphemeralNote from "./EphemeralNote.svelte";
    import IntersectionObserverComponent from "./IntersectionObserver.svelte";
    import MessageReaction from "./MessageReaction.svelte";
    import Badges from "./profile/Badges.svelte";
    import BotBadge from "./profile/BotBadge.svelte";
    import RoleIcon from "./profile/RoleIcon.svelte";
    import WithRole from "./profile/WithRole.svelte";
    import ReminderBuilder from "./ReminderBuilder.svelte";
    import RepliesTo from "./RepliesTo.svelte";
    import ReportMessage from "./ReportMessage.svelte";
    import ThreadSummary from "./ThreadSummary.svelte";
    import TimeAndTicks from "./TimeAndTicks.svelte";
    import TipBuilder from "./TipBuilder.svelte";
    import TipThumbnail from "./TipThumbnail.svelte";
    import UnresolvedReply from "./UnresolvedReply.svelte";

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
        editing: boolean;
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
        editing,
        canStartThread,
        senderTyping,
        dateFormatter = (date) => client.toShortTimeString(date),
        collapsed = false,
        threadRootMessage,
        isThreadRoot = false,
        senderContext,
        onExpandMessage = undefined,
        supportsEdit,
        supportsReply,
        onReplyTo,
        onEditMessage,
        onCollapseMessage,
        onRetrySend,
        onDeleteFailedMessage,
        onRemovePreview,
        onGoToMessageIndex,
    }: Props = $props();

    let msgElement: HTMLElement | undefined;
    let messageMenu: ChatMessageMenu | undefined;
    let componentMounted = true;

    let multiUserChat = chatType === "group_chat" || chatType === "channel";
    let showEmojiPicker = $state(false);
    let debug = false;
    let crypto =
        msg.content.kind === "crypto_content" ||
        msg.content.kind === "prize_content" ||
        msg.content.kind === "p2p_swap_content";
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
    let streak = $derived(sender?.streak ?? 0);
    let chitEarned = $derived(sender?.totalChitEarned ?? 0);
    let hasAchievedMaxStreak = $derived((sender?.maxStreak ?? 0) >= 365);

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

    function doubleClickMessage() {
        if (failed || msg.deleted || !$dclickReply) return;

        if (me) {
            editMessage();
        } else if (confirmed) {
            reply();
        }
    }

    function tipMessage(ledger: string) {
        tipping = ledger;
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

    // Multiple generic app actions use a real chooser in every classic tab. This is independent of
    // the query-only manual-extraction QC seam: model-backed users must be able to pick an action too.
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

    // A per-user-keys app the user hasn't linked opens the proper pairing modal (AiAppLinkModal: a
    // high-entropy claim token, countdown, and "Check connection" that only reports success once my_ai_app_keys
    // actually shows the key). `linkModalApp` renders it; `linkModalResolve` bridges its async result
    // back to this imperative flow so the propose that triggered it resumes on success.
    let linkModalApp = $state<AiAppRegistration | undefined>(undefined);
    let linkModalPurpose = $state<"connect" | "recovery">("connect");
    let linkModalPreviousPublicKey = $state<string | undefined>(undefined);
    let linkModalPreviousKeyVersion = $state<bigint | undefined>(undefined);
    let linkModalResolve: ((linked: boolean) => void) | undefined;

    function closeLinkModal(linked: boolean) {
        linkModalApp = undefined;
        linkModalPurpose = "connect";
        linkModalPreviousPublicKey = undefined;
        linkModalPreviousKeyVersion = undefined;
        const resolve = linkModalResolve;
        linkModalResolve = undefined;
        resolve?.(linked);
    }

    // The modal only resolves `true` once the key is registered, so the flow can re-propose on the
    // strength of this answer alone.
    function linkApp(app: AiAppRegistration): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            linkModalResolve = resolve;
            linkModalPurpose = "connect";
            linkModalPreviousPublicKey = undefined;
            linkModalPreviousKeyVersion = undefined;
            linkModalApp = app;
        });
    }

    onDestroy(() => {
        const resolve = linkModalResolve;
        linkModalResolve = undefined;
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
                linkModalResolve = resolve;
                linkModalPurpose = "recovery";
                linkModalPreviousPublicKey = resolution.previousConnection.publicKey;
                linkModalPreviousKeyVersion = resolution.previousConnection.keyVersion;
                linkModalApp = resolution.app;
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

    // Busy flag for an in-flight propose, so the trigger (the auto-propose chip) can show progress:
    // the on-device model's first call cold-loads a multi-GB runtime and, with no token streaming,
    // otherwise reads as a frozen UI. Also guards against a double-run.
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

    // The decisions live in runProposeFlow (utils/aiActionRunner), shared with the mobile tree; this
    // component supplies only the surfaces this tree has — the manual-QC prompt, action chooser, and
    // link modal. The two trees each kept their own copy of the flow until one was fixed and the other
    // was not, and the propose button on the forgotten tree quietly did nothing.
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
        const capturedAuthor = me ? "You" : senderDisplayName || "Unknown member";
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
            // Svelte may reuse this component for another message. Every stale early return must
            // release the single-flight UI or the replacement message can never run local AI.
            if (componentMounted && localAiMessageRun === run && !terminalStatusSet) {
                setLocalAiMessageStatus(undefined);
            }
        }
    }

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
    }

    function openUserProfile(ev: Event) {
        if (sender?.kind === "bot") {
            botProfile = {
                botId: sender.userId,
                chatId,
                onClose: () => (botProfile = undefined),
            };
        } else {
            ev.target?.dispatchEvent(
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
                    // The round-trip failed — most often a confirm whose deposit to the app's inbox
                    // errored. The canister now leaves the card Pending (it does NOT commit "confirmed"
                    // on a failed deposit), so surface the failure and let the still-live buttons retry.
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
    let maxWidthFraction = $derived($screenWidth === ScreenWidth.ExtraLarge ? 0.7 : 0.8);
    let mediaDimensions = $derived(client.extractDimensionsFromMessageContent(msg.content));
    let mediaWidth = $derived(
        mediaDimensions !== undefined
            ? reservedMediaWidth(mediaDimensions.width, mediaDimensions.height)
            : undefined,
    );
    let inert = $derived(
        msg.content.kind === "deleted_content" ||
            msg.content.kind === "blocked_content" ||
            msg.content.kind === "restricted_content" ||
            collapsed,
    );
    // Auto-propose: the matcher (utils/autoPropose.ts) flagged this message as matching a
    // registered action's trigger keywords — render the under-bubble chip. Tapping it re-uses the
    // exact same propose path as the message menu.
    let canTip = $derived(!me && confirmed && !inert && !failed);
    let inThread = $derived(threadRootMessage !== undefined);
    let threadRootMessageIndex = $derived(
        isThreadRoot ? undefined : threadRootMessage?.messageIndex,
    );
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
    let fill = $derived(client.fillMessage(msg));
    let showAvatar = $derived($screenWidth !== ScreenWidth.ExtraExtraSmall);
    let translated = $derived($translationsStore.has(msg.messageId));
    let threadSummary = $derived(msg.thread);
    let msgUrl = $derived(
        `${routeForMessage($chatListScopeStore.kind, { chatId }, msg.messageIndex)}?open=true`,
    );
    let isProposal = $derived(msg.content.kind === "proposal_content");
    let isActionCard = $derived(msg.content.kind === "action_card_content");
    let isPrize = $derived(msg.content.kind === "prize_content");
    let isP2PSwap = $derived(msg.content.kind === "p2p_swap_content");
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
    let senderDisplayName = $derived(
        client.getDisplayName(
            msg.sender,
            $selectedCommunityMembersStore,
            $selectedChatWebhooksStore,
        ),
    );
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
</script>

{#if botProfile !== undefined}
    <BotProfile {...botProfile} />
{/if}

{#if tipping !== undefined}
    <TipBuilder ledger={tipping} onClose={() => (tipping = undefined)} {msg} {messageContext} />
{/if}

{#if aiActionChooser !== undefined}
    {@const candidates = aiActionChooser.candidates}
    <Overlay dismissible onClose={() => closeChooser(undefined)}>
        <ModalContent closeIcon hideFooter onClose={() => closeChooser(undefined)}>
            {#snippet header()}
                <Translatable resourceKey={i18nKey("aiApps.chooseAction")} />
            {/snippet}
            {#snippet body()}
                <div class="ai-action-choices">
                    {#each candidates as candidate (`${candidate.app.id}-${candidate.action.name}`)}
                        <Button fill secondary onClick={() => closeChooser(candidate)}>
                            <span class="ai-action-choice-label">
                                <span class="ai-action-choice-title">
                                    {candidate.app.manifest.name} — {candidate.action.name}
                                </span>
                                {#if candidate.action.description.length > 0}
                                    <span class="ai-action-choice-description">
                                        {candidate.action.description}
                                    </span>
                                {/if}
                            </span>
                        </Button>
                    {/each}
                </div>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

{#if linkModalApp !== undefined}
    <AiAppLinkModal
        app={linkModalApp}
        purpose={linkModalPurpose}
        previousPublicKey={linkModalPreviousPublicKey}
        previousKeyVersion={linkModalPreviousKeyVersion}
        onLinked={() => closeLinkModal(true)}
        onDismiss={() => closeLinkModal(false)}
    />
{/if}

{#if showEmojiPicker && canReact}
    <Overlay onClose={() => (showEmojiPicker = false)} dismissible>
        <ModalContent hideFooter hideHeader fill>
            {#snippet body()}
                <div class="emoji-header">
                    <h4><Translatable resourceKey={i18nKey("chooseReaction")} /></h4>
                    <span
                        title={$_("close")}
                        class="close-emoji"
                        onclick={() => (showEmojiPicker = false)}
                    >
                        <HoverIcon>
                            <Close size={$iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    </span>
                </div>
                <EmojiPicker
                    onEmojiSelected={selectReaction}
                    onSkintoneChanged={(tone) => quickReactions.reload(tone)}
                    supportCustom={true}
                    mode={"reaction"}
                />
            {/snippet}
        </ModalContent>
    </Overlay>
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

{#if expiresAt === undefined || percentageExpired < 100}
    <div out:fade|local={{ duration: 1000 }} class="message-wrapper" class:last>
        {#if senderContext?.kind === "bot" && senderContext.command !== undefined}
            <div class="bot-context">
                <BotMessageContext
                    botName={senderDisplayName}
                    botCommand={senderContext.command}
                    finalised={senderContext.finalised}
                />
            </div>
        {/if}
        <IntersectionObserverComponent>
            {#snippet children(intersecting)}
                <div
                    bind:this={msgElement}
                    class="message"
                    class:me
                    data-index={failed ? "" : msg.messageIndex}
                    data-id={failed ? "" : msg.messageId}
                    id={failed ? "" : `event-${eventIndex}`}
                >
                    {#if showAvatar && (!isActionCard || !$mobileWidth)}
                        <div class="avatar-col">
                            {#if first}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div class="avatar" onclick={openUserProfile}>
                                    <Avatar
                                        maxStreak={hasAchievedMaxStreak}
                                        url={client.userAvatarUrl(sender)}
                                        userId={msg.sender}
                                        size={$mobileWidth ? AvatarSize.Small : AvatarSize.Default}
                                    />
                                </div>
                            {/if}
                        </div>
                    {/if}

                    <div
                        class="bubble-wrapper"
                        style={`--max-width: ${maxWidthFraction * 100}%;` +
                            (mediaWidth !== undefined ? ` --media-width: ${mediaWidth};` : "")}
                        class:clamped={mediaWidth !== undefined}
                        class:actionCard={isActionCard}
                        class:p2pSwap={isP2PSwap}
                        class:proposal={isProposal && !inert}
                    >
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div
                            ondblclick={doubleClickMessage}
                            use:longpress={() => messageMenu?.showMenu()}
                            class="message-bubble"
                            class:focused
                            class:editing
                            class:fill={fill && !inert}
                            class:me
                            class:inert
                            class:collapsed
                            class:first
                            class:last
                            class:readByMe
                            class:crypto
                            class:failed
                            class:bot={senderContext?.kind === "bot"}
                            class:thread={inThread}
                            class:rtl={$rtlStore}
                        >
                            {#if first && !isProposal && !isPrize}
                                <div class="sender" class:fill class:rtl={$rtlStore}>
                                    <Link underline={"never"} onClick={openUserProfile}>
                                        <h4 class="username" class:fill class:crypto>
                                            {senderDisplayName}
                                        </h4>

                                        <Badges
                                            uniquePerson={sender?.isUniquePerson}
                                            diamondStatus={sender?.diamondStatus}
                                            {streak}
                                            {chitEarned}
                                        />
                                        <BotBadge
                                            bot={senderContext?.kind === "bot"}
                                            webhook={senderContext?.kind === "webhook"}
                                        />
                                        {#if sender !== undefined && multiUserChat}
                                            <WithRole
                                                userId={sender.userId}
                                                chatMembers={$selectedCommunityMembersStore}
                                                communityMembers={$selectedCommunityMembersStore}
                                            >
                                                {#snippet children(communityRole, chatRole)}
                                                    <RoleIcon
                                                        level="community"
                                                        popup
                                                        role={communityRole}
                                                    />
                                                    <RoleIcon
                                                        level={chatType === "channel"
                                                            ? "channel"
                                                            : "group"}
                                                        popup
                                                        role={chatRole}
                                                    />
                                                {/snippet}
                                            </WithRole>
                                        {/if}
                                    </Link>
                                    {#if senderTyping}
                                        <span class="typing">
                                            <Typing />
                                        </span>
                                    {/if}
                                </div>
                            {/if}
                            {#if msg.forwarded}
                                <div class="forwarded">
                                    <div>
                                        <ForwardIcon
                                            size={$iconSize}
                                            color={me
                                                ? "var(--currentChat-msg-me-muted)"
                                                : "var(--currentChat-msg-muted)"}
                                        />
                                    </div>
                                    <div class="text">{"Forwarded"}</div>
                                </div>
                            {/if}
                            {#if msg.repliesTo !== undefined && !inert}
                                {#if msg.repliesTo.kind === "rehydrated_reply_context"}
                                    <RepliesTo
                                        {readonly}
                                        {chatId}
                                        {intersecting}
                                        {onRemovePreview}
                                        {onGoToMessageIndex}
                                        repliesTo={msg.repliesTo}
                                    />
                                {:else}
                                    <UnresolvedReply />
                                {/if}
                            {/if}

                            <ChatMessageContent
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

                            {#if !inert}
                                <TimeAndTicks
                                    {pinned}
                                    prize={isPrize}
                                    fill={fill && !isPrize}
                                    {timestamp}
                                    {expiresAt}
                                    {percentageExpired}
                                    {me}
                                    bot={sender?.kind === "bot"}
                                    {accepted}
                                    {failed}
                                    deleted={msg.deleted}
                                    {undeleting}
                                    {readByThem}
                                    {crypto}
                                    {chatType}
                                    {dateFormatter}
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
                                <pre>intersecting: {intersecting}</pre>
                                <pre>ephemeral: {ephemeral}</pre>
                            {/if}
                        </div>

                        {#if showChatMenu && intersecting}
                            <ChatMessageMenu
                                bind:this={messageMenu}
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
                                {threadRootMessage}
                                {isThreadRoot}
                                {canStartThread}
                                {multiUserChat}
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
                                {selectQuickReaction}
                                showEmojiPicker={() => {
                                    showEmojiPicker = true;
                                }}
                                {canReact}
                                {onCollapseMessage}
                                onReply={reply}
                                {onRetrySend}
                                {onDeleteFailedMessage}
                                onReplyPrivately={replyPrivately}
                                onEditMessage={editMessage}
                                onTipMessage={tipMessage}
                                onReportMessage={reportMessage}
                                onCancelReminder={cancelReminder}
                                onRunAiAction={runAiActionHandler}
                                onProcessWithAi={canProcessWithAi
                                    ? processMessageWithAi
                                    : undefined}
                                onRemindMe={remindMe}
                            />
                        {/if}

                        {#if ephemeral}
                            <EphemeralNote />
                        {/if}
                    </div>

                    {#if !collapsed && !msg.deleted && canReact && !failed && (!isActionCard || !$mobileWidth)}
                        <div class="actions" class:touch={isTouchOnlyDevice}>
                            <div class="reaction" onclick={() => (showEmojiPicker = true)}>
                                <HoverIcon>
                                    <EmoticonOutline size={$iconSize} color={"var(--icon-txt)"} />
                                </HoverIcon>
                            </div>
                        </div>
                    {/if}
                </div>

                {#if threadSummary !== undefined && !inThread}
                    <ThreadSummary
                        {chatId}
                        threadRootMessageIndex={msg.messageIndex}
                        selected={($routeStore.kind === "global_chat_selected_route" ||
                            $routeStore.kind === "selected_channel_route") &&
                            msg.messageIndex === $routeStore.messageIndex &&
                            $routeStore.open}
                        {threadSummary}
                        indent={showAvatar}
                        {me}
                        url={msgUrl}
                    />
                {/if}

                {#if msg.reactions.length > 0 && !inert}
                    <div class="message-reactions" class:me class:indent={showAvatar}>
                        {#each msg.reactions as { reaction, userIds } (reaction)}
                            <MessageReaction
                                onClick={() => toggleReaction(false, reaction)}
                                {reaction}
                                {intersecting}
                                {userIds}
                            />
                        {/each}
                    </div>
                {/if}

                {#if tips.length > 0 && !inert}
                    <div class="tips" class:indent={showAvatar}>
                        {#each tips as [ledger, userTips]}
                            <TipThumbnail onClick={tipMessage} {canTip} {ledger} {userTips} />
                        {/each}
                    </div>
                {/if}

                {#if autoProposeSuggestionList.length > 0}
                    <div class="auto-propose-list" class:me class:indent={showAvatar}>
                        {#each autoProposeSuggestionList as suggestion (autoProposeSuggestionActionKey(suggestion))}
                            <AutoProposeChip
                                {me}
                                title={autoProposeSuggestionLabel(
                                    suggestion,
                                    autoProposeSuggestionList,
                                )}
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
                    </div>
                {/if}

                {#if localAiMessageStatus !== undefined}
                    <div
                        class="local-ai-working"
                        class:me
                        class:indent={showAvatar}
                        role="status"
                        aria-live="polite"
                        data-testid="message-local-ai-status"
                    >
                        <span class={`pill ${localAiMessageStatus.kind}`}>
                            {#if localAiMessageStatus.kind === "processing"}
                                <Spinner size="1rem" foregroundColour="var(--primary)" />
                            {/if}
                            {localAiMessageStatus.message}
                        </span>
                    </div>
                {/if}

                {#if proposing && !activeAutoProposeSuggestionVisible}
                    <!-- Menu-triggered propose has no active chip, even when this message also has
                         suggestions. Surface the in-flight work instead of leaving only dimmed chips. -->
                    <div class="propose-working" class:me class:indent={showAvatar}>
                        <span class="pill">
                            <Spinner size={"1rem"} foregroundColour={"var(--primary)"} />
                            <Translatable resourceKey={autoProposeBusyResourceKey} />
                        </span>
                    </div>
                {/if}
            {/snippet}
        </IntersectionObserverComponent>
    </div>
{/if}

<style lang="scss">
    $size: 10px;

    $avatar-width: toRem(56);
    $avatar-width-mob: toRem(43);

    @keyframes show-bubble-menu {
        0% {
            z-index: -1;
            opacity: 0;
        }
        1% {
            z-index: 1;
            opacity: 0;
        }
        100% {
            z-index: 1;
            opacity: 1;
        }
    }

    @include mobile() {
        :global(.bubble-wrapper .menu) {
            display: none;
        }
    }

    @include not-mobile() {
        :global(.bubble-wrapper .menu) {
            display: flex;
            z-index: -1;
            opacity: 0;
        }

        // Keeps hover menu showing if context menu is clicked!
        :global(.bubble-wrapper .menu:has(.menu-icon.open)) {
            border-color: var(--primary);
            z-index: 1;
            opacity: 1;
        }

        @media (hover: hover) {
            :global(.bubble-wrapper:hover .menu:not(:has(.menu-icon.open))) {
                animation: show-bubble-menu 200ms ease-in-out forwards;
            }
        }
    }

    :global(.message .sender .never) {
        display: inline-flex;
        gap: $sp2;
        align-items: center;
    }

    :global(.message .avatar .avatar) {
        margin: 0;
    }

    :global(.message-bubble .content a) {
        text-decoration: underline;
    }

    :global(.message-bubble .content ul) {
        margin: 0 $sp4;
    }

    :global(.message-bubble a) {
        color: inherit;
    }

    :global(.message-bubble.crypto a) {
        color: inherit;
    }

    :global(.message-bubble.first .menu) {
        top: -24px;
    }

    :global(.actions .reaction .wrapper) {
        padding: 6px;
    }

    .message-wrapper {
        &.last {
            margin-bottom: $sp4;
        }
    }

    .sender {
        margin-bottom: $sp1;

        &.fill {
            position: absolute;
            background-color: rgba(0, 0, 0, 0.3);
            color: #fff;
            padding: $sp4 $sp4;
            border-radius: 0 0 $sp4 0;
            z-index: 1;

            &.rtl {
                right: 0;
                border-radius: 0 0 0 $sp4;
            }
        }

        .typing {
            color: var(--accent);
        }
    }

    .message-reactions,
    .tips {
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: 3px;

        &.indent {
            margin-left: $avatar-width;
            @include mobile() {
                margin-left: $avatar-width-mob;
            }
        }
    }

    // Viewport width does not identify the input device. A narrow desktop window still needs the
    // hover menu, so this later fine-pointer rule overrides the mobile-width display:none above.
    @media (hover: hover) and (pointer: fine) {
        :global(.bubble-wrapper .menu) {
            display: flex;
            z-index: -1;
            opacity: 0;
        }

        :global(.bubble-wrapper .menu:has(.menu-icon.open)) {
            border-color: var(--primary);
            z-index: 1;
            opacity: 1;
        }

        :global(.bubble-wrapper:hover .menu:not(:has(.menu-icon.open))) {
            z-index: 1;
            opacity: 1;
        }
    }

    .ai-action-choices {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        max-height: 60vh;
        overflow-y: auto;
    }

    .ai-action-choice-label {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: $sp1;
        min-width: 0;
        text-align: start;
    }

    .ai-action-choice-title {
        @include font(bold, normal, fs-90);
    }

    .ai-action-choice-description {
        @include font(book, normal, fs-70);
        color: var(--txt-light);
        white-space: normal;
    }

    .auto-propose-list {
        display: flex;
        flex-wrap: wrap;
        gap: $sp1;
        justify-content: flex-start;

        &.me {
            justify-content: flex-end;
        }

        &.indent {
            margin-left: $avatar-width;
            @include mobile() {
                margin-left: $avatar-width-mob;
            }
        }
    }

    .propose-working,
    .local-ai-working {
        display: flex;
        justify-content: flex-start;
        margin-top: 2px;

        &.me {
            justify-content: flex-end;
        }

        &.indent {
            margin-left: $avatar-width;
            @include mobile() {
                margin-left: $avatar-width-mob;
            }
        }

        .pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 2px 10px;
            border-radius: 999px;
            background-color: var(--input-bg);
            border: var(--bw) solid var(--bd);
            color: var(--txt-light);
            font-size: 0.75rem;
        }
    }

    .bot-context {
        display: flex;
        margin-inline-start: $avatar-width;
        margin-bottom: $sp2;
        margin-top: $sp2;

        @include mobile() {
            margin-inline-start: $avatar-width-mob;
        }
    }

    .message {
        display: flex;
        justify-content: flex-start;
        margin-bottom: $sp2;
        position: relative;

        .avatar-col {
            flex: 0 0 $avatar-width;

            @include mobile() {
                flex: 0 0 $avatar-width-mob;
            }

            .avatar {
                cursor: pointer;
            }
        }

        .actions {
            display: none;
            opacity: 0.3;
            padding: 0 $sp3;
            align-items: center;
            justify-content: center;
            transition: opacity 200ms ease-in-out;
        }

        .actions.touch {
            display: flex;
        }

        @include mobile() {
            .actions:not(.touch) {
                display: flex;
            }
        }
    }

    .bubble-wrapper {
        position: relative;
        max-width: var(--max-width);
        min-width: 90px;

        @include mobile() {
            &.actionCard {
                box-sizing: border-box;
                flex: 1 1 0;
                width: auto;
                max-width: 100%;
                min-width: 0;

                .message-bubble {
                    box-sizing: border-box;
                    width: 100%;
                    max-width: 100%;
                    min-width: 0;
                    overflow-x: hidden;
                }
            }
        }

        // media messages: hug the image (media width + bubble padding) so
        // captions and reply quotes cannot widen the bubble past it
        &.clamped {
            max-width: min(var(--max-width), calc(var(--media-width) + toRem(24)));
        }

        &.p2pSwap {
            width: 350px;
        }

        &.proposal {
            max-width: 800px;
        }

        &.proposal,
        &.p2pSwap {
            .message-bubble {
                width: 100%;
            }
        }
    }

    .message-bubble {
        $radius: var(--currentChat-msg-r1);
        $inner-radius: var(--currentChat-msg-r2);
        transition:
            box-shadow ease-out 500ms,
            background-color ease-in-out 200ms,
            border ease-in-out 300ms,
            transform ease-in-out 200ms;
        position: relative;
        padding: toRem(8) toRem(12) toRem(8) toRem(12);
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        @include font(book, normal, fs-100);
        border-radius: $radius;
        border: var(--currentChat-msg-bd);
        box-shadow: var(--currentChat-msg-sh);

        :global(.markdown-wrapper) {
            word-break: break-word;
        }

        .username {
            color: inherit;
            color: var(--txt);
            display: inline;

            &.fill {
                color: #fff;
            }
        }

        &:not(.readByMe) {
            box-shadow: 0 0 0 5px var(--notificationBar-bg);
        }

        &.last:not(.first) {
            border-radius: $inner-radius $radius $radius $radius;
        }
        &.first:not(.last) {
            border-radius: $radius $radius $radius $inner-radius;
        }
        &:not(.first):not(.last) {
            border-radius: $inner-radius $radius $radius $inner-radius;
        }

        &.me {
            background-color: var(--currentChat-msg-me-bg);
            color: var(--currentChat-msg-me-txt);

            .username {
                color: var(--currentChat-msg-me-txt);
            }

            &.inert {
                .username {
                    color: var(--txt);
                }
            }
        }

        &.rtl {
            &.last:not(.first) {
                border-radius: $radius $inner-radius $radius $radius;
            }
            &.first:not(.last) {
                border-radius: $radius $radius $inner-radius $radius;
            }
            &:not(.first):not(.last) {
                border-radius: $radius $inner-radius $inner-radius $radius;
            }
        }

        &.fill {
            padding: 0;
            border: none;
            line-height: 0;
        }

        &.focused {
            box-shadow: 0 0 0 4px var(--currentChat-msg-focus);
            transition:
                background-color ease-in-out 200ms,
                border ease-in-out 300ms,
                transform ease-in-out 200ms;
        }

        &.editing {
            box-shadow: 0 0 0 4px var(--currentChat-msg-focus);
        }

        &.inert {
            opacity: 0.8;
            color: var(--currentChat-msg-txt);
            background-color: var(--currentChat-msg-inert);
        }

        &.collapsed {
            cursor: pointer;
        }

        &:after {
            content: "";
            display: table;
            clear: both;
        }

        .forwarded {
            color: var(--currentChat-msg-muted);
            display: flex;
            gap: $sp1;
            align-items: center;
            @include font-size(fs-80);
            font-style: italic;
            .text {
                margin-bottom: $sp2;
            }
        }

        &.me .forwarded {
            color: var(--currentChat-msg-me-muted);
        }

        &.failed {
            background-color: var(--error);
        }
    }

    .emoji-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: $sp3 $sp4;
        background-color: var(--section-bg);

        .close-emoji {
            flex: 0 0 20px;
        }
    }
</style>
