<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import Button from "../Button.svelte";
    import { isLocked, type MultiUserChat, type OpenChat } from "openchat-client";
    import { toastStore } from "../../stores/toast";
    import page from "page";
    import { routeForScope } from "../../routes";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import AccessGateIconsForChat from "./access/AccessGateIconsForChat.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chat: MultiUserChat;
    export let joining: MultiUserChat | undefined;
    export let lapsed: boolean;

    $: platformModerator = client.platformModerator;
    $: isFrozen = client.isFrozen(chat.id);
    $: selectedCommunity = client.selectedCommunity;
    $: previewingCommunity = $selectedCommunity?.membership.role === "none";
    $: gates = client.accessGatesForChat(chat).map((gc) => ({ level: gc.level, ...gc.gate }));
    $: locked = gates.some((g) => isLocked(g));

    $: console.log("Lapsed: ", lapsed);

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
                toastStore.showFailureToast(i18nKey("failedToFreezeGroup"));
            }
            freezingInProgress = false;
        });
    }

    function unfreezeGroup() {
        if (chat.id.kind !== "group_chat") return;
        freezingInProgress = true;
        client.unfreezeGroup(chat.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("failedToUnfreezeGroup"));
            }
            freezingInProgress = false;
        });
    }
</script>

<div class="preview">
    <div class="gate">
        <AccessGateIconsForChat {gates} />
    </div>
    {#if $platformModerator}
        {#if isFrozen}
            <Button loading={freezingInProgress} secondary small on:click={unfreezeGroup}>
                <Translatable resourceKey={i18nKey("unfreezeGroup")} />
            </Button>
        {:else}
            <Button loading={freezingInProgress} secondary small on:click={freezeGroup}>
                <Translatable resourceKey={i18nKey("freezeGroup")} />
            </Button>
        {/if}
    {/if}
    <Button secondary small on:click={cancelPreview}>
        <Translatable resourceKey={i18nKey("leave")} />
    </Button>
    <Button
        loading={joining !== undefined}
        disabled={locked || joining !== undefined}
        small
        on:click={joinGroup}>
        <Translatable
            resourceKey={locked
                ? i18nKey("access.lockedGate", undefined, chat.level, true)
                : i18nKey("joinGroup", undefined, chat.level, true)} />
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

        .gate {
            position: absolute;
            left: 0;
        }
    }
</style>
