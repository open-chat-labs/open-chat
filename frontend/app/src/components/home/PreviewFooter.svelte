<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import Button from "../Button.svelte";
    import GroupGateIcon from "./AccessGateIcon.svelte";
    import type { MultiUserChat, OpenChat } from "openchat-client";
    import { toastStore } from "../../stores/toast";
    import { _ } from "svelte-i18n";
    import { interpolateLevel } from "../../utils/i18n";
    import page from "page";
    import { routeForScope } from "../../routes";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chat: MultiUserChat;
    export let joining: MultiUserChat | undefined;

    $: isFrozen = client.isFrozen(chat.id);
    $: selectedCommunity = client.selectedCommunity;
    $: previewingCommunity = $selectedCommunity?.membership.role === "none";

    let isPlatformModerator = client.isPlatformModerator();
    let freezingInProgress = false;

    function joinGroup() {
        dispatch("joinGroup", {
            group: chat,
            select: true,
        });
    }

    function cancelPreview() {
        if (previewingCommunity && $selectedCommunity) {
            client.removeCommunity($selectedCommunity.id);
            page(routeForScope(client.getDefaultScope()));
        } else {
            client.removeChat(chat.id);
            if (!chat.public) {
                client.declineInvitation(chat.id);
            }
        }
    }

    function freezeGroup() {
        if (chat.id.kind !== "group_chat") return;
        freezingInProgress = true;
        client.freezeGroup(chat.id, undefined).then((success) => {
            if (!success) {
                toastStore.showFailureToast("failedToFreezeGroup");
            }
            freezingInProgress = false;
        });
    }

    function unfreezeGroup() {
        if (chat.id.kind !== "group_chat") return;
        freezingInProgress = true;
        client.unfreezeGroup(chat.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast("failedToUnfreezeGroup");
            }
            freezingInProgress = false;
        });
    }
</script>

<div class="preview">
    <div class="gate">
        <GroupGateIcon on:upgrade gate={chat.gate} />
    </div>
    {#if isPlatformModerator}
        {#if isFrozen}
            <Button
                loading={freezingInProgress}
                secondary={true}
                small={true}
                on:click={unfreezeGroup}>
                {$_("unfreezeGroup")}
            </Button>
        {:else}
            <Button
                loading={freezingInProgress}
                secondary={true}
                small={true}
                on:click={freezeGroup}>
                {$_("freezeGroup")}
            </Button>
        {/if}
    {/if}
    <Button secondary={true} small={true} on:click={cancelPreview}>
        {$_("leave")}
    </Button>
    <Button
        loading={joining !== undefined}
        disabled={joining !== undefined}
        small={true}
        on:click={joinGroup}>
        {interpolateLevel("joinGroup", chat.level, true)}
    </Button>
</div>

<style lang="scss">
    .preview {
        height: 42px;
        color: var(--txt);
        @include font(book, normal, fs-100);
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        position: relative;
        justify-content: flex-end;
        gap: $sp3;
        @include mobile() {
            justify-content: center;
        }

        .gate {
            position: absolute;
            left: 0;
        }
    }
</style>
