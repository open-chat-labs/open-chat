<script lang="ts">
    import {
        subscribe,
        type ChitEarnedGate,
        type NeuronGate,
        type PaymentGate,
        type PublicProfile,
        type TokenBalanceGate,
    } from "openchat-client";
    import { onMount } from "svelte";
    import AboutAccessGates from "./createOrUpdateGroup/access_gates/AboutAccessGates.svelte";
    import AccessGates from "./createOrUpdateGroup/access_gates/AccessGates.svelte";
    import BalanceGates from "./createOrUpdateGroup/access_gates/BalanceGates.svelte";
    import EditBalanceGate from "./createOrUpdateGroup/access_gates/EditBalanceGate.svelte";
    import EditChitGate from "./createOrUpdateGroup/access_gates/EditChitGate.svelte";
    import EditNeuronGate from "./createOrUpdateGroup/access_gates/EditNeuronGate.svelte";
    import EditPaymentGate from "./createOrUpdateGroup/access_gates/EditPaymentGate.svelte";
    import NeuronGates from "./createOrUpdateGroup/access_gates/NeuronGates.svelte";
    import PaymentGates from "./createOrUpdateGroup/access_gates/PaymentGates.svelte";
    import AddGroupMembers from "./createOrUpdateGroup/AddGroupMembers.svelte";
    import GeneralSetup from "./createOrUpdateGroup/GeneralSetup.svelte";
    import GroupInfo from "./createOrUpdateGroup/GroupInfo.svelte";
    import Rules from "./createOrUpdateGroup/Rules.svelte";
    import SlidingPage from "./SlidingPage.svelte";
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

    type SlidingModalType =
        | { kind: "update_group_add_members" }
        | { kind: "update_group_details" }
        | { kind: "update_group_rules" }
        | { kind: "update_group_general_setup" }
        | { kind: "update_group_access_gates" }
        | { kind: "update_group_neuron_gates" }
        | { kind: "update_group_payment_gates" }
        | { kind: "update_group_balance_gates" }
        | { kind: "update_group_edit_neuron_gate"; gate: NeuronGate }
        | { kind: "update_group_edit_payment_gate"; gate: PaymentGate }
        | { kind: "update_group_edit_balance_gate"; gate: TokenBalanceGate }
        | { kind: "update_group_edit_chit_gate"; gate: ChitEarnedGate }
        | { kind: "update_group_gates_learn" }
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
            subscribe("newGroup", () => push({ kind: "update_group_add_members" })),
            subscribe("updateGroup", () => push({ kind: "update_group_details" })),
            subscribe("updateGroupRules", () => push({ kind: "update_group_rules" })),
            subscribe("updateGroupDetails", () => push({ kind: "update_group_details" })),
            subscribe("updateGroupGeneralSetup", () =>
                push({ kind: "update_group_general_setup" }),
            ),
            subscribe("updateGroupAccessGates", () => push({ kind: "update_group_access_gates" })),
            subscribe("updateGroupNeuronGates", () => push({ kind: "update_group_neuron_gates" })),
            subscribe("updateGroupPaymentGates", () =>
                push({ kind: "update_group_payment_gates" }),
            ),
            subscribe("updateGroupTokenBalanceGates", () =>
                push({ kind: "update_group_balance_gates" }),
            ),
            subscribe("updateGroupEditNeuronGate", (gate) =>
                push({ kind: "update_group_edit_neuron_gate", gate }),
            ),
            subscribe("updateGroupEditPaymentGate", (gate) =>
                push({ kind: "update_group_edit_payment_gate", gate }),
            ),
            subscribe("updateGroupEditTokenBalanceGate", (gate) =>
                push({ kind: "update_group_edit_balance_gate", gate }),
            ),
            subscribe("updateGroupEditChitGate", (gate) =>
                push({ kind: "update_group_edit_chit_gate", gate }),
            ),
            subscribe("updateGroupGatesLearnMore", () =>
                push({ kind: "update_group_gates_learn" }),
            ),
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
        {:else if page.kind === "update_group_rules"}
            <Rules />
        {:else if page.kind === "update_group_general_setup"}
            <GeneralSetup />
        {:else if page.kind === "update_group_access_gates"}
            <AccessGates />
        {:else if page.kind === "update_group_gates_learn"}
            <AboutAccessGates />
        {:else if page.kind === "update_group_neuron_gates"}
            <NeuronGates />
        {:else if page.kind === "update_group_balance_gates"}
            <BalanceGates />
        {:else if page.kind === "update_group_edit_neuron_gate"}
            <EditNeuronGate gate={page.gate} />
        {:else if page.kind === "update_group_payment_gates"}
            <PaymentGates />
        {:else if page.kind === "update_group_edit_payment_gate"}
            <EditPaymentGate gate={page.gate} />
        {:else if page.kind === "update_group_edit_balance_gate"}
            <EditBalanceGate gate={page.gate} />
        {:else if page.kind === "update_group_edit_chit_gate"}
            <EditChitGate gate={page.gate} />
        {/if}
    </SlidingPage>
{/each}
