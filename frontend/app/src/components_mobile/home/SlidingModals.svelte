<script lang="ts">
    import {
        subscribe,
        type ChitEarnedGate,
        type DirectChatSummary,
        type NamedAccount,
        type NeuronGate,
        type PaymentGate,
        type PublicProfile,
        type TokenBalanceGate,
    } from "openchat-client";
    import { onMount } from "svelte";
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
    import AddGroupMembers from "./createOrUpdateGroup/AddGroupMembers.svelte";
    import GeneralSetup from "./createOrUpdateGroup/GeneralSetup.svelte";
    import GroupInfo from "./createOrUpdateGroup/GroupInfo.svelte";
    import GroupPermissions from "./createOrUpdateGroup/Permissions.svelte";
    import DirectChatDetails from "./groupdetails/DirectChatDetails.svelte";
    import { UpdateGroupOrCommunityState } from "./groupOrCommunity.svelte";
    import NewMessage from "./NewMessage.svelte";
    import Rules from "./Rules.svelte";
    import SlidingPage from "./SlidingPage.svelte";
    import ThreadPreviews from "./thread/ThreadPreviews.svelte";
    import About from "./user_profile/About.svelte";
    import Appearance from "./user_profile/Appearance.svelte";
    import BotConfig from "./user_profile/BotConfig.svelte";
    import ChatsAndVideo from "./user_profile/ChatsAndVideo.svelte";
    import ChitRewards from "./user_profile/ChitRewards.svelte";
    import ClearCache from "./user_profile/ClearCache.svelte";
    import CommunitySettings from "./user_profile/CommunitySettings.svelte";
    import DeleteAccount from "./user_profile/DeleteAccount.svelte";
    import ProfileSettings from "./user_profile/ProfileSettings.svelte";
    import Share from "./user_profile/Share.svelte";
    import Verify from "./user_profile/Verify.svelte";
    import EditRecipient from "./wallet/EditRecipient.svelte";
    import ManageRecipients from "./wallet/ManageRecipients.svelte";
    import ReceiveCrypto from "./wallet/ReceiveCrypto.svelte";
    import SendCrypto from "./wallet/SendCrypto.svelte";
    import SwapToken from "./wallet/SwapCrypto.svelte";
    import TokenPage from "./wallet/TokenPage.svelte";
    import WalletSettings from "./wallet/WalletSettings.svelte";
    import type { TokenState } from "./wallet/walletState.svelte";
    /**
     * It is tempting to think that this can completely replace the right panel on mobile but it's not quite so simple.
     * It can replace everything _that is not represented by it's own route_. That is because at the moment
     * we have view transitions backed into the router and also done manually in the sliding page. So if we represent
     * a route with a sliding modal we end up with clunky double transitions. That could be solved by implementing the
     * sliding modal transition with a different automated view transition. Maybe. But for the moment I'd rather let
     * sleeping dogs lie.
     */

    type SlidingModalType =
        | { kind: "show_threads" }
        | { kind: "edit_recipient"; account: NamedAccount; onComplete: () => void }
        | { kind: "add_recipient"; account?: NamedAccount; onComplete: () => void }
        | { kind: "manage_recipients" }
        | { kind: "wallet_settings" }
        | { kind: "swap_token"; tokenState: TokenState }
        | { kind: "send_token"; tokenState: TokenState }
        | { kind: "receive_token"; tokenState: TokenState }
        | { kind: "token_page"; tokenState: TokenState }
        | { kind: "direct_chat_details"; chat: DirectChatSummary }
        | { kind: "new_message" }
        | { kind: "update_community_add_members" }
        | { kind: "update_community_details" }
        | { kind: "update_community_channels" }
        | { kind: "update_group_add_members" }
        | { kind: "update_group_details" }
        | { kind: "update_rules"; data: UpdateGroupOrCommunityState }
        | { kind: "update_group_general_setup" }
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
        | { kind: "user_profile_settings"; profile: PublicProfile };

    let modalStack = $state<SlidingModalType[]>([]);
    let top = $derived(modalStack[modalStack.length - 1]);
    function push(modal: SlidingModalType) {
        modalStack.push(modal);
    }

    function pop() {
        modalStack.pop();
    }

    onMount(() => {
        const unsubs = [
            subscribe("showThreads", () => push({ kind: "show_threads" })),
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
            subscribe("newMessage", () => push({ kind: "new_message" })),
            subscribe("newCommunity", () => push({ kind: "update_community_add_members" })),
            subscribe("updateCommunity", () => push({ kind: "update_community_details" })),
            subscribe("updateCommunityDetails", () => push({ kind: "update_community_details" })),
            subscribe("updateCommunityChannels", () => push({ kind: "update_community_channels" })),
            subscribe("newChannel", () => push({ kind: "update_group_add_members" })),
            subscribe("newGroup", () => push({ kind: "update_group_add_members" })),
            subscribe("updateGroup", () => push({ kind: "update_group_details" })),
            subscribe("updateRules", (data) =>
                push({
                    kind: "update_rules",
                    data: data as unknown as UpdateGroupOrCommunityState,
                }),
            ),
            subscribe("updateGroupDetails", () => push({ kind: "update_group_details" })),
            subscribe("updateGroupGeneralSetup", () =>
                push({ kind: "update_group_general_setup" }),
            ),
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
            subscribe("userProfileSettings", (profile) =>
                push({ kind: "user_profile_settings", profile }),
            ),
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
        {:else if page.kind === "user_profile_settings"}
            <ProfileSettings profile={page.profile} />
        {:else if page.kind === "update_group_add_members"}
            <AddGroupMembers />
        {:else if page.kind === "update_group_details"}
            <GroupInfo />
        {:else if page.kind === "update_rules"}
            <Rules data={page.data} />
        {:else if page.kind === "update_group_general_setup"}
            <GeneralSetup />
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
        {/if}
    </SlidingPage>
{/each}
