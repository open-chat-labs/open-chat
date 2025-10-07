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
    import AddGroupMembers from "./AddGroupMembers.svelte";
    import GroupInfo from "./GroupInfo.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        candidateGroup?: CandidateGroupChat;
        embeddedContent: boolean;
        onClose: () => void;
    }

    type Step = "add_members" | "details";

    let {
        embeddedContent,
        candidateGroup = $bindable(client.createCandidateGroup("group", embeddedContent)),
    }: Props = $props();
    let step = $state<Step>("add_members");
    let title = $derived(getTitle());
    let detailsValid = $state(false);
    let candidateMembers = $state<CandidateMember[]>([]);
    let busy = $state(false);

    function getTitle() {
        switch (step) {
            case "add_members":
                return i18nKey("Add members");
            case "details":
                return i18nKey("group.addGroupInfo", undefined, candidateGroup.level, true);
        }
    }

    function onBack() {
        switch (step) {
            case "details":
                step = "add_members";
                break;
            case "add_members":
                publish("closeModalPage");
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

<SlidingPageContent {onBack} {title} subtitle={i18nKey("Create group")}>
    {#if step === "add_members"}
        <AddGroupMembers
            onDeleteUser={deleteMember}
            bind:candidateMembers
            {candidateGroup}
            onNext={() => (step = "details")} />
    {:else if step === "details"}
        <GroupInfo
            {busy}
            {onCreateGroup}
            onDeleteUser={deleteMember}
            bind:candidateMembers
            onBack={() => (step = "add_members")}
            bind:candidateGroup
            bind:valid={detailsValid} />
    {/if}
</SlidingPageContent>
