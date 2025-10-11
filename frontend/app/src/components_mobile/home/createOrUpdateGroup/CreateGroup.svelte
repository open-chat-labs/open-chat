<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import {
        chatListScopeStore,
        OpenChat,
        publish,
        routeForChatIdentifier,
        type CandidateGroupChat,
        type CandidateMember,
        type MultiUserChatIdentifier,
        type NeuronGate,
    } from "openchat-client";
    import page from "page";
    import { getContext, tick } from "svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import AboutAccessGates from "./access_gates/AboutAccessGates.svelte";
    import AccessGates from "./access_gates/AccessGates.svelte";
    import EditNeuronGate from "./access_gates/EditNeuronGate.svelte";
    import NeuronGates from "./access_gates/NeuronGates.svelte";
    import AddGroupMembers from "./AddGroupMembers.svelte";
    import GeneralSetup from "./GeneralSetup.svelte";
    import GroupInfo from "./GroupInfo.svelte";
    import Rules from "./Rules.svelte";

    const MAX_RULES_LENGTH = 1024;
    const MIN_NAME_LENGTH = 3;
    const MAX_NAME_LENGTH = 40;

    const client = getContext<OpenChat>("client");

    interface Props {
        candidateGroup?: CandidateGroupChat;
        embeddedContent: boolean;
        onClose: () => void;
    }

    type Step =
        | { kind: "add_neuron_gate"; gate: NeuronGate }
        | { kind: "add_members" }
        | { kind: "details" }
        | { kind: "general_setup" }
        | { kind: "rules" }
        | { kind: "access_gates" }
        | { kind: "neuron_gate" }
        | { kind: "payment_gate" }
        | { kind: "token_balance_gate" }
        | { kind: "about_access_gates" };

    let {
        embeddedContent,
        candidateGroup = $bindable(client.createCandidateGroup("group", embeddedContent)),
    }: Props = $props();
    let step = $state<Step>({ kind: "add_members" });
    let [title, subtitle] = $derived(getTitles());
    let candidateMembers = $state<CandidateMember[]>([]);
    let busy = $state(false);
    let rulesValid = $derived(
        !candidateGroup.rules.enabled ||
            (candidateGroup.rules.text.length > 0 &&
                candidateGroup.rules.text.length < MAX_RULES_LENGTH),
    );
    let nameValid = $derived(
        candidateGroup.name.length >= MIN_NAME_LENGTH &&
            candidateGroup.name.length <= MAX_NAME_LENGTH,
    );
    let valid = $derived(rulesValid && nameValid);

    function getTitles() {
        switch (step.kind) {
            case "add_neuron_gate":
                return [i18nKey("Provide gate values")];
            case "neuron_gate":
            case "payment_gate":
            case "token_balance_gate":
                return [i18nKey("Access gate details")];
            case "about_access_gates":
                return [i18nKey("Access gates description")];
            case "add_members":
                return [i18nKey("Add members"), i18nKey("Create group")];
            case "access_gates":
                return [i18nKey("Access gates")];
            case "details":
                return [
                    i18nKey("group.addGroupInfo", undefined, candidateGroup.level, true),
                    i18nKey("Create group"),
                ];
            case "general_setup":
                return [i18nKey("GeneralSetup"), i18nKey("Create group")];
            case "rules":
                return [i18nKey("Rules")];
        }
    }

    function onBack() {
        switch (step.kind) {
            case "add_neuron_gate":
                step = { kind: "neuron_gate" };
                break;
            case "neuron_gate":
            case "payment_gate":
            case "token_balance_gate":
            case "about_access_gates":
                step = { kind: "access_gates" };
                break;
            case "rules":
            case "general_setup":
            case "access_gates":
                step = { kind: "details" };
                break;
            case "details":
                step = { kind: "add_members" };
                break;
            case "add_members":
                publish("closeModalPage");
                break;
        }
    }

    function onCreateGroup() {
        busy = true;

        const level = candidateGroup.level;

        client
            .createGroupChat($state.snapshot(candidateGroup))
            .then((resp) => {
                if (resp.kind !== "success") {
                    const resourceKey = client.groupCreationErrorMessage(resp, level);
                    if (resourceKey)
                        toastStore.showFailureToast({
                            ...resourceKey,
                            level,
                            lowercase: true,
                        });
                } else {
                    return optionallyInviteUsers(resp.canisterId)
                        .catch((_err) => {
                            toastStore.showFailureToast(i18nKey("inviteUsersFailed"));
                        })
                        .then(() => {
                            onGroupCreated(resp.canisterId);
                        });
                }
            })
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("groupCreationFailed"));
                console.error("Error creating group: ", err);
                step = { kind: "details" };
            })
            .finally(() => (busy = false));
    }

    function optionallyInviteUsers(chatId: MultiUserChatIdentifier): Promise<void> {
        if (candidateMembers.length === 0) {
            return Promise.resolve();
        }
        return client
            .inviteUsers(
                chatId,
                candidateMembers.map(({ user }) => user.userId),
            )
            .then((resp) => {
                if (!resp) {
                    Promise.reject("Unable to invite users to the new group");
                }
            });
    }

    function onGroupCreated(canisterId: MultiUserChatIdentifier) {
        const url = routeForChatIdentifier($chatListScopeStore.kind, canisterId);
        publish("closeModalPage");
        tick().then(() => page(url)); // trigger the selection of the chat
    }
</script>

<SlidingPageContent {onBack} {title} {subtitle}>
    {#if step.kind === "add_members"}
        <AddGroupMembers
            onDeleteUser={deleteMember}
            bind:candidateMembers
            {candidateGroup}
            onNext={() => (step = { kind: "details" })} />
    {:else if step.kind === "details"}
        <GroupInfo
            {rulesValid}
            {nameValid}
            {busy}
            {onCreateGroup}
            minNameLength={MIN_NAME_LENGTH}
            maxNameLength={MAX_NAME_LENGTH}
            onDeleteUser={deleteMember}
            onGeneralSetup={() => (step = { kind: "general_setup" })}
            onRules={() => (step = { kind: "rules" })}
            onAccessGates={() => (step = { kind: "access_gates" })}
            {onBack}
            bind:candidateMembers
            bind:candidateGroup
            {valid} />
    {:else if step.kind === "general_setup"}
        <GeneralSetup {onBack} bind:candidateGroup />
    {:else if step.kind === "rules"}
        <Rules valid={rulesValid} maxLength={MAX_RULES_LENGTH} {onBack} bind:candidateGroup />
    {:else if step.kind === "access_gates"}
        <AccessGates
            onLearnMore={() => (step = { kind: "about_access_gates" })}
            onNeuronGate={() => (step = { kind: "neuron_gate" })}
            onPaymentGate={() => (step = { kind: "payment_gate" })}
            onTokenBalanceGate={() => (step = { kind: "token_balance_gate" })}
            {onBack}
            bind:candidateGroup />
    {:else if step.kind === "about_access_gates"}
        <AboutAccessGates />
    {:else if step.kind === "neuron_gate"}
        <NeuronGates
            onAddNeuronGate={(gate) => (step = { kind: "add_neuron_gate", gate })}
            bind:candidateGroup />
    {:else if step.kind === "token_balance_gate"}
        token balance
    {:else if step.kind === "payment_gate"}
        payment gate
    {:else if step.kind === "add_neuron_gate"}
        <EditNeuronGate {onBack} bind:gateConfig={candidateGroup.gateConfig} gate={step.gate} />
    {/if}
</SlidingPageContent>
