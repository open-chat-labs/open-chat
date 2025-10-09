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
        type UserOrUserGroup,
    } from "openchat-client";
    import page from "page";
    import { getContext, tick } from "svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import AboutAccessGates from "./AboutAccessGates.svelte";
    import AccessGates from "./AccessGates.svelte";
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
        | "add_members"
        | "details"
        | "general_setup"
        | "rules"
        | "access_gates"
        | "about_access_gates";

    let {
        embeddedContent,
        candidateGroup = $bindable(client.createCandidateGroup("group", embeddedContent)),
    }: Props = $props();
    let step = $state<Step>("add_members");
    let title = $derived(getTitle());
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

    function getTitle() {
        switch (step) {
            case "about_access_gates":
                return i18nKey("Access gates description");
            case "add_members":
                return i18nKey("Add members");
            case "access_gates":
                return i18nKey("Access gates");
            case "details":
                return i18nKey("group.addGroupInfo", undefined, candidateGroup.level, true);
            case "general_setup":
                return i18nKey("GeneralSetup");
            case "rules":
                return i18nKey("Rules");
        }
    }

    function onBack() {
        switch (step) {
            case "about_access_gates":
                step = "access_gates";
                break;
            case "access_gates":
                step = "details";
                break;
            case "general_setup":
                step = "details";
                break;
            case "details":
                step = "add_members";
                break;
            case "add_members":
                publish("closeModalPage");
                break;
            case "rules":
                step = "details";
                break;
        }
    }

    function deleteMember(user: UserOrUserGroup): void {
        if (user.kind !== "user") return;
        candidateMembers = candidateMembers.filter((m) => m.user.userId !== user.userId);
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
                step = "details";
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

<SlidingPageContent
    {onBack}
    {title}
    subtitle={step === "about_access_gates" ? undefined : i18nKey("Create group")}>
    {#if step === "add_members"}
        <AddGroupMembers
            onDeleteUser={deleteMember}
            bind:candidateMembers
            {candidateGroup}
            onNext={() => (step = "details")} />
    {:else if step === "details"}
        <GroupInfo
            {rulesValid}
            {nameValid}
            {busy}
            {onCreateGroup}
            minNameLength={MIN_NAME_LENGTH}
            maxNameLength={MAX_NAME_LENGTH}
            onDeleteUser={deleteMember}
            onGeneralSetup={() => (step = "general_setup")}
            onRules={() => (step = "rules")}
            onAccessGates={() => (step = "access_gates")}
            {onBack}
            bind:candidateMembers
            bind:candidateGroup
            {valid} />
    {:else if step === "general_setup"}
        <GeneralSetup {onBack} bind:candidateGroup />
    {:else if step === "rules"}
        <Rules valid={rulesValid} maxLength={MAX_RULES_LENGTH} {onBack} bind:candidateGroup />
    {:else if step === "access_gates"}
        <AccessGates
            onLearnMore={() => (step = "about_access_gates")}
            {onBack}
            bind:candidateGroup />
    {:else if step === "about_access_gates"}
        <AboutAccessGates />
    {/if}
</SlidingPageContent>
