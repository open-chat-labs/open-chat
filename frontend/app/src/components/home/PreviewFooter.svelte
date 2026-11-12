
<script lang="ts">
    import { navigate } from "@utils/navigation";
    import { isLocked, mobileWidth, type MultiUserChat, type OpenChat, platformModeratorStore, publish, isPreviewingCommunity, selectedCommunitySummaryStore } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import Button from "../Button.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import AccessGateIconsForChat from "./access/AccessGateIconsForChat.svelte";
    import { freezeLabel, freezeTarget, setFrozen } from "@src/logic/moderation/freeze";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        joining: MultiUserChat | undefined;
        lapsed: boolean;
    }

    let { chat, joining, lapsed }: Props = $props();

    let isFrozen = $derived(client.isChatOrCommunityFrozen(chat, $selectedCommunitySummaryStore));
    let previewingCommunity = $derived(
        $selectedCommunitySummaryStore !== undefined &&
            isPreviewingCommunity($selectedCommunitySummaryStore),
    );
    let gates = $derived(client.accessGatesForChat(chat));
    let locked = $derived(gates.some((g) => isLocked(g)));

    let freezingInProgress = $state(false);

    function joinGroup() {
        publish("joinGroup", chat);
    }

    // a channel of a community being previewed cancels the community's preview (client.cancelPreview)
    function cancelPreview() {
        const path = client.cancelPreview(chat.id);
        if (previewingCommunity || $mobileWidth || !client.selectDefaultChat(false)) {
            navigate(path);
        }
    }

    // freezing a channel freezes its community (logic/moderation/freeze)
    async function setChatFrozen(frozen: boolean) {
        const target = freezeTarget(chat.id);
        freezingInProgress = true;
        try {
            toastStore.showOutcome(await setFrozen(client, target, frozen));
        } finally {
            freezingInProgress = false;
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
    {#if $platformModeratorStore}
        {#if isFrozen}
            <Button loading={freezingInProgress} secondary small onClick={() => setChatFrozen(false)}>
                <Translatable resourceKey={freezeLabel(freezeTarget(chat.id).kind, true)} />
            </Button>
        {:else}
            <Button loading={freezingInProgress} secondary small onClick={() => setChatFrozen(true)}>
                <Translatable resourceKey={freezeLabel(freezeTarget(chat.id).kind, false)} />
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
