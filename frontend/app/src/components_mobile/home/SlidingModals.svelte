<script lang="ts">
    import { communityPreviewState, groupPreviewState } from "@src/utils/preview.svelte";
    import {
        OpenChat,
        selectedChatMembersStore,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        subscribe,
        type ChannelIdentifier,
        type ChatSummary,
        type ChitEarnedGate,
        type CommunitySummary,
        type DirectChatSummary,
        type EventWrapper,
        type ExternalBot,
        type FullWebhookDetails,
        type GrantedBotPermissions,
        type GroupChatSummary,
        type Message,
        type MessageContext,
        type MultiUserChat,
        type MultiUserChatIdentifier,
        type NamedAccount,
        type NeuronGate,
        type PaymentGate,
        type PublicProfile,
        type ReadonlySet,
        type TokenBalanceGate,
        type UserGroupDetails,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import BotDetailsPage from "../bots/BotDetailsPage.svelte";
    import BotInstaller from "../bots/install/BotInstaller.svelte";
    import WebhookModal from "../bots/WebhookModal.svelte";
    import AccessGatesEvaluator from "./access/AccessGatesEvaluator.svelte";
    import AboutAccessGates from "./access_gates/AboutAccessGates.svelte";
    import AccessGates from "./access_gates/AccessGates.svelte";
    import BalanceGates from "./access_gates/BalanceGates.svelte";
    import EditBalanceGate from "./access_gates/EditBalanceGate.svelte";
    import EditChitGate from "./access_gates/EditChitGate.svelte";
    import EditNeuronGate from "./access_gates/EditNeuronGate.svelte";
    import EditPaymentGate from "./access_gates/EditPaymentGate.svelte";
    import NeuronGates from "./access_gates/NeuronGates.svelte";
    import PaymentGates from "./access_gates/PaymentGates.svelte";
    import AddCommunityMembers from "./communities/createOrUpdate/AddCommunityMembers.svelte";
    import Channels from "./communities/createOrUpdate/Channels.svelte";
    import CommunityInfo from "./communities/createOrUpdate/CommunityInfo.svelte";
    import CommunityPermissions from "./communities/createOrUpdate/Permissions.svelte";
    import CommunitySummaryComponent from "./communities/details/CommunitySummary.svelte";
    import ConfirmDeleteCommunity from "./communities/details/ConfirmDelete.svelte";
    import EditUserGroup from "./communities/details/EditUserGroup.svelte";
    import UserGroup from "./communities/details/UserGroup.svelte";
    import UserGroups from "./communities/details/UserGroups.svelte";
    import AddGroupMembers from "./createOrUpdateGroup/AddGroupMembers.svelte";
    import GroupInfo from "./createOrUpdateGroup/GroupInfo.svelte";
    import GroupPermissions from "./createOrUpdateGroup/Permissions.svelte";
    import ConfirmDeleteChat from "./groupdetails/ConfirmDelete.svelte";
    import Convert from "./groupdetails/Convert.svelte";
    import Converted from "./groupdetails/Converted.svelte";
    import DirectChatDetails from "./groupdetails/DirectChatDetails.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import { UpdateGroupOrCommunityState } from "./groupOrCommunity.svelte";
    import StreakInsuranceBuy from "./insurance/StreakInsuranceBuy.svelte";
    import BotsList from "./membership/BotsList.svelte";
    import InviteAndShare from "./membership/InviteAndShare.svelte";
    import MemberManagement from "./membership/MemberManagement.svelte";
    import NewMessage from "./NewMessage.svelte";
    import PinnedMessages from "./pinned/PinnedMessages.svelte";
    import PollBuilder from "./PollBuilder.svelte";
    import PrizeContentBuilder from "./PrizeContentBuilder.svelte";
    import ProposalGroupFilters from "./ProposalGroupFilters.svelte";
    import Rules from "./Rules.svelte";
    import SlidingPage from "./SlidingPage.svelte";
    import Thread from "./thread/Thread.svelte";
    import ThreadPreviews from "./thread/ThreadPreviews.svelte";
    import Upgrade from "./upgrade/Upgrade.svelte";
    import About from "./user_profile/About.svelte";
    import Appearance from "./user_profile/Appearance.svelte";
    import AppSettings from "./user_profile/AppSettings.svelte";
    import BotConfig from "./user_profile/BotConfig.svelte";
    import ChatsAndVideo from "./user_profile/ChatsAndVideo.svelte";
    import ChitRewards from "./user_profile/ChitRewards.svelte";
    import ClearCache from "./user_profile/ClearCache.svelte";
    import CommunitySettings from "./user_profile/CommunitySettings.svelte";
    import DeleteAccount from "./user_profile/DeleteAccount.svelte";
    import Share from "./user_profile/Share.svelte";
    import UserInformation from "./user_profile/UserInformation.svelte";
    import Verify from "./user_profile/Verify.svelte";
    import ActiveCallParticipants from "./video/ActiveCallParticipants.svelte";
    import EditRecipient from "./wallet/EditRecipient.svelte";
    import ManageRecipients from "./wallet/ManageRecipients.svelte";
    import ReceiveCrypto from "./wallet/ReceiveCrypto.svelte";
    import SendCrypto from "./wallet/SendCrypto.svelte";
    import SwapToken from "./wallet/SwapCrypto.svelte";
    import TokenPage from "./wallet/TokenPage.svelte";
    import WalletSettings from "./wallet/WalletSettings.svelte";
    import type { TokenState } from "./wallet/walletState.svelte";
    import { expectBackPress } from "../../utils/native/notification_channels";
    /**
     * It is tempting to think that this can completely replace the right panel on mobile but it's not quite so simple.
     * It can replace everything _that is not represented by it's own route_. That is because at the moment
     * we have view transitions backed into the router and also done manually in the sliding page. So if we represent
     * a route with a sliding modal we end up with clunky double transitions. That could be solved by implementing the
     * sliding modal transition with a different automated view transition. Maybe. But for the moment I'd rather let
     * sleeping dogs lie.
     */

    const client = getContext<OpenChat>("client");
    type SlidingModalType =
        | {
              kind: "show_video_call_participants";

              chatId: MultiUserChatIdentifier;
              messageId: bigint;
              isOwner: boolean;
          }
        | {
              kind: "invite_and_share";
              collection: MultiUserChat | CommunitySummary;
              view: "invite" | "share";
          }
        | {
              kind: "show_bot";
              bot: ExternalBot;
              collection?: ChatSummary | CommunitySummary;
              grantedPermissions?: GrantedBotPermissions;
          }
        | { kind: "show_pinned"; chat: MultiUserChat; pinned: ReadonlySet<number> }
        | {
              kind: "install_bot";
              bot: ExternalBot;
              collection: ChatSummary | CommunitySummary;
              installedWithPermissions?: GrantedBotPermissions;
          }
        | { kind: "user_groups"; community: CommunitySummary }
        | { kind: "streak_insurance" }
        | { kind: "create_poll"; messageContext: MessageContext }
        | { kind: "create_prize"; messageContext: MessageContext }
        | { kind: "evaluate_community_access_gate" }
        | { kind: "evaluate_group_access_gate" }
        | { kind: "proposal_filters"; chat: ChatSummary }
        | { kind: "show_bots"; collection: MultiUserChat | CommunitySummary }
        | { kind: "register_webhook"; chat: MultiUserChat }
        | { kind: "update_webhook"; chat: MultiUserChat; webhook: FullWebhookDetails }
        | { kind: "regenerate_webhook"; chat: MultiUserChat; webhook: FullWebhookDetails }
        | { kind: "user_group"; community: CommunitySummary; userGroup: UserGroupDetails }
        | { kind: "edit_user_group"; community: CommunitySummary; userGroup: UserGroupDetails }
        | { kind: "community_details"; community: CommunitySummary }
        | { kind: "delete_chat"; chat: MultiUserChat }
        | { kind: "delete_community"; community: CommunitySummary }
        | { kind: "converted_to_community"; name: string; channelId: ChannelIdentifier }
        | { kind: "convert_to_community"; chat: GroupChatSummary }
        | { kind: "open_thread"; chat: ChatSummary; msg: EventWrapper<Message> }
        | { kind: "show_threads" }
        | {
              kind: "show_members";
              collection: MultiUserChat | CommunitySummary;
              view: "members" | "add" | "lapsed" | "blocked";
          }
        | { kind: "edit_recipient"; account: NamedAccount; onComplete: () => void }
        | { kind: "add_recipient"; account?: NamedAccount; onComplete: () => void }
        | { kind: "manage_recipients" }
        | { kind: "wallet_settings" }
        | { kind: "swap_token"; tokenState: TokenState }
        | { kind: "send_token"; tokenState: TokenState }
        | { kind: "receive_token"; tokenState: TokenState }
        | { kind: "token_page"; tokenState: TokenState }
        | { kind: "direct_chat_details"; chat: DirectChatSummary }
        | { kind: "group_chat_details"; chat: MultiUserChat }
        | { kind: "new_message" }
        | { kind: "update_community_add_members" }
        | { kind: "update_community_details" }
        | { kind: "update_community_channels" }
        | { kind: "update_group_add_members" }
        | { kind: "update_group_details" }
        | { kind: "update_rules"; data: UpdateGroupOrCommunityState }
        | { kind: "update_group_permissions" }
        | { kind: "update_community_permissions" }
        | { kind: "update_access_gates"; data: UpdateGroupOrCommunityState }
        | { kind: "update_neuron_gates"; data: UpdateGroupOrCommunityState }
        | { kind: "update_payment_gates"; data: UpdateGroupOrCommunityState }
        | { kind: "update_balance_gates"; data: UpdateGroupOrCommunityState }
        | { kind: "update_neuron_gate"; data: UpdateGroupOrCommunityState; gate: NeuronGate }
        | { kind: "update_payment_gate"; data: UpdateGroupOrCommunityState; gate: PaymentGate }
        | { kind: "update_balance_gate"; data: UpdateGroupOrCommunityState; gate: TokenBalanceGate }
        | { kind: "update_chit_gate"; data: UpdateGroupOrCommunityState; gate: ChitEarnedGate }
        | { kind: "access_gates_learn_more" }
        | { kind: "add_group_members" }
        | { kind: "user_profile_chats_and_video" }
        | { kind: "user_profile_share" }
        | { kind: "user_profile_about" }
        | { kind: "user_profile_appearance" }
        | { kind: "user_profile_verify" }
        | { kind: "user_profile_community" }
        | { kind: "user_profile_bot_config" }
        | { kind: "user_profile_chit" }
        | { kind: "user_profile_delete_account" }
        | { kind: "user_profile_cache_management" }
        | { kind: "app_settings" }
        | { kind: "upgrade_diamond" }
        | { kind: "user_information"; profile: PublicProfile };

    let modalStack = $state<SlidingModalType[]>([]);
    let top = $derived(modalStack[modalStack.length - 1]);
    function push(modal: SlidingModalType) {
        if (!modalStack.find((m) => m.kind === modal.kind)) {
            modalStack.push(modal);
        }
    }

    function pop() {
        modalStack.pop();
    }

    onMount(() => {
        // Expect user to press back in the app, handle that behaviour here.
        if (client.isNativeApp()) {
            expectBackPress(pop).catch(console.error);
        }

        const unsubs = [
            subscribe("createPoll", (messageContext) =>
                push({ kind: "create_poll", messageContext }),
            ),
            subscribe("createPrize", (messageContext) =>
                push({ kind: "create_prize", messageContext }),
            ),
            subscribe("streakInsurance", () => push({ kind: "streak_insurance" })),
            subscribe("evaluateCommunityAccessGate", () =>
                push({ kind: "evaluate_community_access_gate" }),
            ),
            subscribe("evaluateGroupAccessGate", () =>
                push({ kind: "evaluate_group_access_gate" }),
            ),
            subscribe("upgrade", () => push({ kind: "upgrade_diamond" })),
            subscribe("showProposalFilters", () => {
                if ($selectedChatSummaryStore !== undefined) {
                    push({ kind: "proposal_filters", chat: $selectedChatSummaryStore });
                }
            }),
            subscribe("showVideoCallParticipants", ({ chatId, messageId, isOwner }) =>
                push({ kind: "show_video_call_participants", chatId, messageId, isOwner }),
            ),
            subscribe("showPinned", ({ chat, pinned }) =>
                push({ kind: "show_pinned", chat, pinned }),
            ),
            subscribe("installBot", ({ bot, collection, installedWithPermissions }) =>
                push({ kind: "install_bot", bot, collection, installedWithPermissions }),
            ),
            subscribe("showBot", ({ bot, collection, grantedPermissions }) =>
                push({ kind: "show_bot", bot, collection, grantedPermissions }),
            ),
            subscribe("showBots", (collection) => push({ kind: "show_bots", collection })),
            subscribe("registerWebhook", (chat) => push({ kind: "register_webhook", chat })),
            subscribe("updateWebhook", ({ chat, hook }) =>
                push({ kind: "update_webhook", chat, webhook: hook }),
            ),
            subscribe("regenerateWebhook", ({ chat, hook }) =>
                push({ kind: "regenerate_webhook", chat, webhook: hook }),
            ),
            subscribe("addGroupMembers", () => push({ kind: "update_group_add_members" })),
            subscribe("addCommunityMembers", () => push({ kind: "update_community_add_members" })),
            subscribe("inviteAndShare", ({ collection, view }) =>
                push({ kind: "invite_and_share", collection, view }),
            ),
            subscribe("showUserGroups", () => {
                if ($selectedCommunitySummaryStore !== undefined) {
                    push({ kind: "user_groups", community: $selectedCommunitySummaryStore });
                }
            }),
            subscribe("showUserGroup", (userGroup) => {
                if ($selectedCommunitySummaryStore !== undefined) {
                    push({
                        kind: "user_group",
                        community: $selectedCommunitySummaryStore,
                        userGroup,
                    });
                }
            }),
            subscribe("editUserGroup", (userGroup) => {
                if ($selectedCommunitySummaryStore !== undefined) {
                    push({
                        kind: "edit_user_group",
                        community: $selectedCommunitySummaryStore,
                        userGroup,
                    });
                }
            }),
            subscribe("communityDetails", () => {
                if ($selectedCommunitySummaryStore !== undefined) {
                    push({ kind: "community_details", community: $selectedCommunitySummaryStore });
                }
            }),
            subscribe("deleteChat", (chat) => push({ kind: "delete_chat", chat })),
            subscribe("deleteCommunityMobile", (community) =>
                push({ kind: "delete_community", community }),
            ),
            subscribe("convertedGroupToCommunity", ({ name, channelId }) =>
                push({ kind: "converted_to_community", name, channelId }),
            ),
            subscribe("convertGroupToCommunity", (chat) =>
                push({ kind: "convert_to_community", chat }),
            ),
            subscribe("openThread", ({ chat, msg }) => push({ kind: "open_thread", chat, msg })),
            subscribe("showThreads", () => push({ kind: "show_threads" })),
            subscribe("showMembers", ({ collection, view }) =>
                push({ kind: "show_members", collection, view }),
            ),
            subscribe("editRecipient", ({ account, onComplete }) =>
                push({ kind: "edit_recipient", account, onComplete }),
            ),
            subscribe("addRecipient", ({ account, onComplete }) =>
                push({ kind: "add_recipient", account, onComplete }),
            ),
            subscribe("manageRecipients", () => push({ kind: "manage_recipients" })),
            subscribe("walletSettings", () => push({ kind: "wallet_settings" })),
            subscribe("swapToken", (tokenState) =>
                push({ kind: "swap_token", tokenState: tokenState as unknown as TokenState }),
            ),
            subscribe("sendToken", (tokenState) =>
                push({ kind: "send_token", tokenState: tokenState as unknown as TokenState }),
            ),
            subscribe("receiveToken", (tokenState) =>
                push({ kind: "receive_token", tokenState: tokenState as unknown as TokenState }),
            ),
            subscribe("tokenPage", (tokenState) =>
                push({ kind: "token_page", tokenState: tokenState as unknown as TokenState }),
            ),
            subscribe("directChatDetails", (chat) => push({ kind: "direct_chat_details", chat })),
            subscribe("groupChatDetails", (chat) => push({ kind: "group_chat_details", chat })),
            subscribe("newMessage", () => push({ kind: "new_message" })),
            subscribe("addCommunityMembers", () => push({ kind: "update_community_add_members" })),
            subscribe("updateCommunity", () => push({ kind: "update_community_details" })),
            subscribe("updateCommunityChannels", () => push({ kind: "update_community_channels" })),
            subscribe("newChannel", () => push({ kind: "update_group_details" })),
            subscribe("newGroup", () => push({ kind: "update_group_details" })),
            subscribe("updateGroup", () => push({ kind: "update_group_details" })),
            subscribe("updateRules", (data) =>
                push({
                    kind: "update_rules",
                    data: data as unknown as UpdateGroupOrCommunityState,
                }),
            ),
            subscribe("updateGroupDetails", () => push({ kind: "update_group_details" })),

            subscribe("updateCommunityPermissions", () =>
                push({ kind: "update_community_permissions" }),
            ),
            subscribe("updateGroupPermissions", () => push({ kind: "update_group_permissions" })),
            subscribe("updateAccessGates", (data) =>
                push({
                    kind: "update_access_gates",
                    data: data as unknown as UpdateGroupOrCommunityState,
                }),
            ),
            subscribe("updateNeuronGates", (data) =>
                push({
                    kind: "update_neuron_gates",
                    data: data as unknown as UpdateGroupOrCommunityState,
                }),
            ),
            subscribe("updatePaymentGates", (data) =>
                push({
                    kind: "update_payment_gates",
                    data: data as unknown as UpdateGroupOrCommunityState,
                }),
            ),
            subscribe("updateTokenBalanceGates", (data) =>
                push({
                    kind: "update_balance_gates",
                    data: data as unknown as UpdateGroupOrCommunityState,
                }),
            ),
            subscribe("updateNeuronGate", ({ data, gate }) =>
                push({
                    kind: "update_neuron_gate",
                    gate,
                    data: data as unknown as UpdateGroupOrCommunityState,
                }),
            ),
            subscribe("updatePaymentGate", ({ data, gate }) =>
                push({
                    kind: "update_payment_gate",
                    gate,
                    data: data as unknown as UpdateGroupOrCommunityState,
                }),
            ),
            subscribe("updateTokenBalanceGate", ({ data, gate }) =>
                push({
                    kind: "update_balance_gate",
                    gate,
                    data: data as unknown as UpdateGroupOrCommunityState,
                }),
            ),
            subscribe("updateChitGate", ({ data, gate }) =>
                push({
                    kind: "update_chit_gate",
                    gate,
                    data: data as unknown as UpdateGroupOrCommunityState,
                }),
            ),
            subscribe("accessGatesLearnMore", () => push({ kind: "access_gates_learn_more" })),
            subscribe("appSettings", () => push({ kind: "app_settings" })),
            subscribe("userInformation", (profile) => push({ kind: "user_information", profile })),
            subscribe("userProfileShare", () => push({ kind: "user_profile_share" })),
            subscribe("userProfileVerify", () => push({ kind: "user_profile_verify" })),
            subscribe("userProfileCommunitySettings", () =>
                push({ kind: "user_profile_community" }),
            ),
            subscribe("userProfileChitRewards", () => push({ kind: "user_profile_chit" })),
            subscribe("userProfileAppearance", () => push({ kind: "user_profile_appearance" })),
            subscribe("userProfileDeleteAccount", () =>
                push({ kind: "user_profile_delete_account" }),
            ),
            subscribe("userProfileBotConfig", () => push({ kind: "user_profile_bot_config" })),
            subscribe("userProfileCacheManagement", () =>
                push({ kind: "user_profile_cache_management" }),
            ),
            subscribe("userProfileAbout", () => push({ kind: "user_profile_about" })),
            subscribe("closeModalPage", pop),
            subscribe("closeModalStack", () => (modalStack = [])),
            subscribe("userProfileChatsAndVideo", () =>
                push({ kind: "user_profile_chats_and_video" }),
            ),
        ];
        return () => {
            unsubs.forEach((u) => u());
        };
    });
</script>

{#each modalStack as page}
    <SlidingPage top={page === top}>
        {#if page.kind === "user_profile_chats_and_video"}
            <ChatsAndVideo />
        {:else if page.kind === "user_profile_share"}
            <Share />
        {:else if page.kind === "user_profile_delete_account"}
            <DeleteAccount />
        {:else if page.kind === "user_profile_about"}
            <About />
        {:else if page.kind === "user_profile_appearance"}
            <Appearance />
        {:else if page.kind === "user_profile_cache_management"}
            <ClearCache />
        {:else if page.kind === "user_profile_verify"}
            <Verify />
        {:else if page.kind === "user_profile_bot_config"}
            <BotConfig />
        {:else if page.kind === "user_profile_chit"}
            <ChitRewards />
        {:else if page.kind === "user_profile_community"}
            <CommunitySettings />
        {:else if page.kind === "user_information"}
            <UserInformation profile={page.profile} />
        {:else if page.kind === "app_settings"}
            <AppSettings />
        {:else if page.kind === "update_group_add_members"}
            <AddGroupMembers />
        {:else if page.kind === "update_group_details"}
            <GroupInfo />
        {:else if page.kind === "update_rules"}
            <Rules data={page.data} />
        {:else if page.kind === "update_access_gates"}
            <AccessGates data={page.data} />
        {:else if page.kind === "update_group_permissions"}
            <GroupPermissions />
        {:else if page.kind === "update_community_permissions"}
            <CommunityPermissions />
        {:else if page.kind === "access_gates_learn_more"}
            <AboutAccessGates />
        {:else if page.kind === "update_neuron_gates"}
            <NeuronGates data={page.data} />
        {:else if page.kind === "update_balance_gates"}
            <BalanceGates data={page.data} />
        {:else if page.kind === "update_neuron_gate"}
            <EditNeuronGate data={page.data} gate={page.gate} />
        {:else if page.kind === "update_payment_gates"}
            <PaymentGates data={page.data} />
        {:else if page.kind === "update_payment_gate"}
            <EditPaymentGate data={page.data} gate={page.gate} />
        {:else if page.kind === "update_balance_gate"}
            <EditBalanceGate data={page.data} gate={page.gate} />
        {:else if page.kind === "update_chit_gate"}
            <EditChitGate data={page.data} gate={page.gate} />
        {:else if page.kind === "update_community_add_members"}
            <AddCommunityMembers />
        {:else if page.kind === "update_community_details"}
            <CommunityInfo />
        {:else if page.kind === "update_community_channels"}
            <Channels />
        {:else if page.kind === "new_message"}
            <NewMessage />
        {:else if page.kind === "direct_chat_details"}
            <DirectChatDetails chat={page.chat} />
        {:else if page.kind === "group_chat_details"}
            <GroupDetails chat={page.chat} memberCount={$selectedChatMembersStore.size} />
        {:else if page.kind === "token_page"}
            <TokenPage tokenState={page.tokenState} />
        {:else if page.kind === "receive_token"}
            <ReceiveCrypto tokenState={page.tokenState} />
        {:else if page.kind === "send_token"}
            <SendCrypto onClose={pop} tokenState={page.tokenState} />
        {:else if page.kind === "swap_token"}
            <SwapToken onClose={pop} inToken={page.tokenState} />
        {:else if page.kind === "manage_recipients"}
            <ManageRecipients />
        {:else if page.kind === "add_recipient"}
            <EditRecipient account={page.account} onClose={page.onComplete} />
        {:else if page.kind === "edit_recipient"}
            <EditRecipient account={page.account} onClose={page.onComplete} />
        {:else if page.kind === "wallet_settings"}
            <WalletSettings />
        {:else if page.kind === "show_threads"}
            <ThreadPreviews />
        {:else if page.kind === "open_thread"}
            <Thread rootEvent={page.msg} chat={page.chat} />
        {:else if page.kind === "convert_to_community"}
            <Convert chat={page.chat} />
        {:else if page.kind === "converted_to_community"}
            <Converted name={page.name} channelId={page.channelId} />
        {:else if page.kind === "delete_chat"}
            <ConfirmDeleteChat chat={page.chat} />
        {:else if page.kind === "delete_community"}
            <ConfirmDeleteCommunity community={page.community} />
        {:else if page.kind === "show_members"}
            <MemberManagement collection={page.collection} view={page.view} />
        {:else if page.kind === "community_details"}
            <CommunitySummaryComponent community={page.community} />
        {:else if page.kind === "user_groups"}
            <UserGroups community={page.community} />
        {:else if page.kind === "user_group"}
            <UserGroup community={page.community} userGroup={page.userGroup} />
        {:else if page.kind === "edit_user_group"}
            <EditUserGroup community={page.community} original={page.userGroup} />
        {:else if page.kind === "invite_and_share"}
            <InviteAndShare collection={page.collection} view={page.view} />
        {:else if page.kind === "register_webhook"}
            <WebhookModal chat={page.chat} mode={"register"} />
        {:else if page.kind === "update_webhook"}
            <WebhookModal chat={page.chat} mode={"update"} bind:webhook={page.webhook} />
        {:else if page.kind === "regenerate_webhook"}
            <WebhookModal chat={page.chat} mode={"regenerate"} bind:webhook={page.webhook} />
        {:else if page.kind === "show_bots"}
            <BotsList collection={page.collection} />
        {:else if page.kind === "show_bot"}
            <BotDetailsPage
                bot={page.bot}
                collection={page.collection}
                grantedPermissions={page.grantedPermissions} />
        {:else if page.kind === "install_bot"}
            <BotInstaller
                bot={page.bot}
                collection={page.collection}
                installedWithPermissions={page.installedWithPermissions} />
        {:else if page.kind === "show_pinned"}
            <PinnedMessages chat={page.chat} pinned={page.pinned} />
        {:else if page.kind === "show_video_call_participants"}
            <ActiveCallParticipants
                chatId={page.chatId}
                messageId={page.messageId}
                isOwner={page.isOwner} />
        {:else if page.kind === "proposal_filters"}
            <ProposalGroupFilters selectedChat={page.chat} />
        {:else if page.kind === "upgrade_diamond"}
            <Upgrade />
        {:else if page.kind === "streak_insurance"}
            <StreakInsuranceBuy onClose={pop} />
        {:else if page.kind === "create_poll"}
            <PollBuilder messageContext={page.messageContext} onClose={pop} />
        {:else if page.kind === "create_prize"}
            <PrizeContentBuilder context={page.messageContext} onClose={pop} />
        {:else if page.kind === "evaluate_community_access_gate"}
            <AccessGatesEvaluator
                gates={communityPreviewState.gatesToEvaluate}
                onClose={() => {
                    communityPreviewState.reset();
                    pop();
                }}
                onSuccess={(res) => {
                    communityPreviewState.doJoinCommunity(client, res);
                    pop();
                }} />
        {:else if page.kind === "evaluate_group_access_gate"}
            <AccessGatesEvaluator
                gates={groupPreviewState.gatesToEvaluate}
                onClose={() => {
                    groupPreviewState.reset();
                    pop();
                }}
                onSuccess={(res) => {
                    groupPreviewState.doJoinGroup(client, res);
                    pop();
                }} />
        {/if}
    </SlidingPage>
{/each}
