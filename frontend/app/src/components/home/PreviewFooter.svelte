<script lang="ts">
    import {
        isLocked,
        type MultiUserChat,
        type OpenChat,
        platformModerator,
        publish,
        routeForScope,
        selectedCommunity,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";
    import AccessGateIconsForChat from "./access/AccessGateIconsForChat.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        joining: MultiUserChat | undefined;
        lapsed: boolean;
    }

    let { chat, joining, lapsed }: Props = $props();

    let isFrozen = $derived(client.isChatOrCommunityFrozen(chat, $selectedCommunity));
    let previewingCommunity = $derived(
        $selectedCommunity?.membership.role === "none" || $selectedCommunity?.membership.lapsed,
    );
    let gates = $derived(client.accessGatesForChat(chat));
    let locked = $derived(gates.some((g) => isLocked(g)));

    let freezingInProgress = $state(false);

    function joinGroup() {
        publish("joinGroup", {
            group: chat,
            select: false,
        });
    }

    function cancelPreview() {
        if (previewingCommunity && $selectedCommunity) {
            client.removeCommunity($selectedCommunity.id);
        } else {
            if (!chat.public) {
                client.declineInvitation(chat.id);
            }
            client.removeChat(chat.id);
        }
        page(routeForScope(client.getDefaultScope()));
    }

    function freeze() {
        freezingInProgress = true;
        switch (chat.kind) {
            case "group_chat":
                client
                    .freezeGroup(chat.id, undefined)
                    .then((success) => {
                        if (!success) {
                            toastStore.showFailureToast(i18nKey("failedToFreezeGroup"));
                        } else {
                            toastStore.showSuccessToast(i18nKey("chatFrozen"));
                        }
                    })
                    .finally(() => (freezingInProgress = false));
                break;

            case "channel":
                if ($selectedCommunity) {
                    client
                        .freezeCommunity($selectedCommunity.id, undefined)
                        .then((success) => {
                            if (!success) {
                                toastStore.showFailureToast(i18nKey("failedToFreezeCommunity"));
                            } else {
                                toastStore.showSuccessToast(i18nKey("communityFrozen"));
                            }
                        })
                        .finally(() => (freezingInProgress = false));
                }
                break;
        }
    }

    function unfreeze() {
        freezingInProgress = true;

        switch (chat.kind) {
            case "group_chat":
                client
                    .unfreezeGroup(chat.id)
                    .then((success) => {
                        if (!success) {
                            toastStore.showFailureToast(i18nKey("failedToUnfreezeGroup"));
                        } else {
                            toastStore.showSuccessToast(i18nKey("Chat unfrozen"));
                        }
                    })
                    .finally(() => (freezingInProgress = false));

            case "channel":
                if ($selectedCommunity) {
                    client
                        .unfreezeCommunity($selectedCommunity.id)
                        .then((success) => {
                            if (!success) {
                                toastStore.showFailureToast(i18nKey("failedToUnfreezeCommunity"));
                            } else {
                                toastStore.showSuccessToast(i18nKey("communityUnfrozen"));
                            }
                        })
                        .finally(() => (freezingInProgress = false));
                }
        }
    }
</script>

<div class="preview">
    <div class="gate">
        <AccessGateIconsForChat {gates} />
    </div>
    {#if lapsed}
        <div class="lapsed">
            <Translatable resourceKey={i18nKey("access.lapsed.label")} />
        </div>
    {/if}
    {#if $platformModerator}
        {#if isFrozen}
            <Button loading={freezingInProgress} secondary small onClick={unfreeze}>
                <Translatable
                    resourceKey={chat.kind === "group_chat"
                        ? i18nKey("unfreezeGroup")
                        : i18nKey("unfreezeCommunity")} />
            </Button>
        {:else}
            <Button loading={freezingInProgress} secondary small onClick={freeze}>
                <Translatable
                    resourceKey={chat.kind === "group_chat"
                        ? i18nKey("freezeGroup")
                        : i18nKey("freezeCommunity")} />
            </Button>
        {/if}
    {/if}
    {#if !lapsed}
        <Button secondary small onClick={cancelPreview}>
            <Translatable resourceKey={i18nKey("leave")} />
        </Button>
    {/if}
    <Button
        loading={joining !== undefined}
        disabled={locked || joining !== undefined}
        small
        onClick={joinGroup}>
        <Translatable
            resourceKey={locked
                ? i18nKey("access.lockedGate", undefined, chat.level, true)
                : lapsed
                  ? i18nKey("access.lapsed.rejoin", undefined, chat.level, true)
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

    .lapsed {
        @include font(bold, normal, fs-100);
    }
</style>
